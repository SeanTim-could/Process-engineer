// Window formulas evaluate the existing safe expression tree once, using each
// reference's cumulative quantity. No window result is stored as a time sample.
var IntervalFormulas=(()=>{
 const R=Se(),h=R.createElement,finite=Number.isFinite,is=column=>column?.formula?.calculationMode==='interval';
 function configuration(value){
  if(value.calculationMode===undefined)return {};
  if(!['point','interval'].includes(value.calculationMode))throw new Error('公式计算口径无效。');
  if(value.calculationMode==='point')return {calculationMode:'point'};
  const location=CrossUnit.validateLocation(value.interval??{}),group=value.interval?.group;
  if(!location.datasetId||typeof group!=='string'||group.length>80)throw new Error('区间公式所属装置或分组无效。');
  return {calculationMode:'interval',interval:{...location,group}};
 }
 function decorate(column,body,dataset){
  const mode=body.calculationMode??dataset.columns.find(c=>c.key===column.key)?.formula?.calculationMode??'point';
  if(!['point','interval'].includes(mode))throw new Error('公式计算口径无效。');
  // Keep old recipes byte-compatible unless the caller explicitly selects a mode.
  if(mode==='point')return {...column,formula:{...column.formula,...body.calculationMode?{calculationMode:'point'}:{}}};
  const unitId=body.unitId??dataset.unitIds[0];if(!dataset.unitIds.includes(unitId))throw new Error('请选择当前数据集中的装置。');
  const extra=configuration({calculationMode:mode,interval:{datasetId:dataset.id,unitId,group:String(body.group??'')}});
  return {...column,formula:{...column.formula,...extra}};
 }
 function validate(state){
  for(const entry of Object.values(state.datasets)){
   if(entry.dataset.role!=='ledger'||entry.dataset.status!=='ready')continue;
   for(const column of entry.dataset.columns){
    if(!column.formula||is(column))continue;
    for(const binding of Object.values(column.formula.bindings)){
     const dependency=state.datasets[binding.datasetId??entry.dataset.id]?.dataset.columns.find(c=>c.key===binding.key);
     if(is(dependency))throw new Error('逐点公式不能引用区间计算指标“'+dependency.label+'”；请切换为区间累计值计算。');
    }
   }
  }
 }
 function presence(columns,rows){
  for(const column of columns.filter(is)){
   const home=column.formula.interval;
   for(const row of rows){
    delete row.values[column.key];delete row.calculationIssues?.[column.key];delete row.calculationMatches?.[column.key];
    if(row.unit===home.unitId&&row.group===home.group)row.values[column.key]=null;
   }
  }
  return rows;
 }
 const failure=(message,unit='',operands=[])=>({value:null,unit,operands,reason:message});
 function evaluate(column,range,state=$r().state,visiting=new Set()){
  const formula=column.formula,home=formula?.interval,operands=[],unit=column.unit;
  if(!is(column)||!home)return failure('请选择区间累计值公式。',unit);
  if(!finite(range?.from)||!finite(range?.to)||range.to<=range.from)return failure('请选择有效的起止时间。',unit);
  const id=home.datasetId+':'+column.key;if(visiting.has(id))return failure('公式存在循环引用。',unit);
  const next=new Set([...visiting,id]);
  try{
   const ast=TE(formula.expression,name=>formula.bindings[name]),memo=new Map();
   const result=Jh(ast,{}, {},new Map(),(name,binding)=>{
    if(memo.has(name))return memo.get(name);
    let operand;
    try{
     const sourceId=binding.datasetId??home.datasetId,unitId=binding.unitId??home.unitId,entry=state.datasets[sourceId],input=entry?.dataset.columns.find(c=>c.key===binding.key);
     if(!input||entry.dataset.role!=='ledger'||entry.dataset.status!=='ready'||!entry.dataset.unitIds.includes(unitId)||!state.settings.units.some(u=>u.id===unitId&&!u.archived))throw new Error('引用装置、数据集或指标已不可用。');
     let amount,inputUnit,detail,group=binding.group;
     if(is(input)){
      const nested=evaluate(input,range,state,next);if(!finite(nested.value))throw new Error(nested.reason);
      amount=nested.value;inputUnit=input.unit;detail='区间公式结果';group=input.formula.interval.group;
     }else{
      const candidates=entry.points.filter(p=>p.unit===unitId&&Object.hasOwn(p.values,binding.key)),groups=[...new Set(candidates.map(p=>p.group))];
      if(group===undefined)group=!binding.datasetId&&groups.includes(home.group)?home.group:groups.length===1?groups[0]:undefined;
      if(group===undefined)throw new Error(groups.length?'存在多个分组，请选择具体采样点。':'没有可累计的数据。');
      const rows=PointExclusions.apply(sourceId,candidates.filter(p=>p.group===group).sort((a,b)=>a.time-b.time)),meta=xr(input.unit),method=input.kind==='counter'?'difference':meta?.totalUnit?'integral':['sum','difference'].includes(input.aggregation)?input.aggregation:lc(input).method;
      if(!['sum','difference','integral'].includes(method))throw new Error('此指标没有区间累计量；请使用流量、区间量或累计表读数，或选择逐点计算。');
      const stats=Qs(rows,{...input,aggregation:method},range);
      amount=method==='integral'?stats.coverage?.value:stats.sourceValue;inputUnit=method==='integral'?meta.totalUnit:input.unit;detail=stats.label;
      if(!finite(amount))throw new Error('所选时段没有有效累计量（缺测、时长不足或累计表重置）。');
     }
     const target=is(input)?binding.unit:xr(binding.unit)?.totalUnit??binding.unit,value=o3(amount,inputUnit,target,formula.percentageMode);
     operand={name,sourceId,unitId,group,value:ro(amount,inputUnit,target),unit:target,detail};operands.push(operand);
     const answer=Fr(value);memo.set(name,answer);return answer;
    }catch(error){
     operand={name,value:null,unit:xr(binding.unit)?.totalUnit??binding.unit,reason:error.message};operands.push(operand);
     const answer={value:null,issue:{kind:'missing',message:'“'+name+'”：'+error.message}};memo.set(name,answer);return answer;
    }
   });
   if(result.issue)return failure(result.issue.message,unit,operands);
   const value=ro(qK(result.value,formula.resultUnit,formula.percentageMode),formula.resultUnit,column.unit);
   return finite(value)?{value,unit,operands,reason:null}:failure('计算结果超出有效数值范围。',unit,operands);
  }catch(error){return failure(error.message,unit,operands);}
 }
 function compare(column,range,state=$r().state){
  const current=evaluate(column,range,state),previousRange=PeriodMath.previous(range),previous=previousRange?evaluate(column,previousRange,state):failure('请选择有效的起止时间。',column.unit);
  return {range:previousRange?range:null,previousRange,current:{mean:current.value,count:finite(current.value)?1:0},previous:{mean:previous.value,count:finite(previous.value)?1:0},status:!previousRange?'no-range':!finite(current.value)?'no-current':!finite(previous.value)?'no-previous':'ok'};
 }
 function stats(column,range){
  const interval=evaluate(column,range),value=interval.value,count=finite(value)?1:0;
  return {value,unit:column.unit,label:'区间计算值',detail:interval.reason??'先累计各输入指标，再代入公式。',count,missing:1-count,totalCount:1,rawUnit:column.unit,last:value,min:value,max:value,coverage:null,mean:value,meanUnit:column.unit,sourceMean:value,canTotal:false,totalValue:null,sourceValue:value,sourceUnit:column.unit,interval};
 }
 function preview(state,id,column,body){
  if(!is(column))return null;
  const range=yr(body.from,body.to),interval=evaluate(column,range,state),valid=finite(interval.value)?1:0;
  return Response.json({column,referenceRevision:CrossUnit.revision($r().state),coverage:[],summary:{total:1,valid,missing:1-valid,errors:0},allCount:1,points:[],references:interval.operands,resultUnit:column.formula.resultUnit,interval:{...interval,range}});
 }
 function Mode({value,onChange}){return h('div',{className:'interval-formula-mode'},h('label',{className:'form-label'},'计算口径',h('select',{'aria-label':'公式计算口径',value,onChange:e=>onChange(e.target.value)},h('option',{value:'point'},'逐点计算'),h('option',{value:'interval'},'区间累计值计算'))),h('p',{className:'small muted'},value==='interval'?'先累计所选时段内各输入指标，再代入公式。流量使用累计量，例如累计出料 ÷ 累计进料；结果随查看时段更新。':'按每个采样时间的输入值计算。'))}
 function Operands({value}){return !value.operands.length?null:h('div',{className:'table-wrap'},h('table',{className:'data-table interval-formula-inputs'},h('thead',null,h('tr',null,h('th',null,'公式引用'),h('th',null,'代入的区间累计值'))),h('tbody',null,...value.operands.map(o=>h('tr',{key:o.name},h('td',null,o.name),h('td',{title:o.detail},finite(o.value)?PeriodComparison.number(o.value)+' '+o.unit:o.reason))))));}
 function Result({value,comparison}){return h(R.Fragment,null,h('div',{className:'mean-period-row interval-formula-result'},h('b',null,h('small',{className:'stat-value-label'},'区间计算值'),h('span',{'data-interval-value':value.value??''},PeriodComparison.number(value.value)),h('small',null,value.unit)),comparison&&h(PeriodComparison.Values,{result:comparison,unit:value.unit,current:value.value,basis:'按区间累计值代入公式',previousLabel:'上期结果'})),value.reason&&h('p',{className:'note-line',role:'status'},value.reason),h(Operands,{value}));}
 function Preview({value}){return value?h('section',{className:'formula-preview','aria-label':'公式计算预览'},h('h4',null,'区间累计值计算'),h('p',{className:'small muted'},finite(value.range.from)&&finite(value.range.to)?AnalysisMath.exactLocal(value.range.from).replace('T',' ')+' — '+AnalysisMath.exactLocal(value.range.to-1).replace('T',' '):'请选择起止时间'),h(Result,{value})):null;}
 function Value({column,from,to}){const value=evaluate(column,yr(from,to));return h('span',{title:value.reason??'按区间累计值计算'},PeriodComparison.number(value.value)+' '+value.unit);}
 function svg(column,range,result=evaluate(column,range)){
  const escape=AnalysisPlots.escape,lines=result.operands.map(o=>o.name+'：'+(finite(o.value)?PeriodComparison.number(o.value)+' '+o.unit:o.reason)),height=200+lines.length*30;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 '+height+'" role="img" data-complete-chart="1" aria-label="'+escape(column.label)+'区间计算结果"><g font-family="Arial,Microsoft YaHei,sans-serif" fill="#168577"><text x="30" y="35" font-size="20">'+escape(column.label)+' · 区间累计值计算</text><text x="30" y="65" font-size="13">'+escape(finite(range?.from)&&finite(range?.to)?AnalysisMath.exactLocal(range.from)+' — '+AnalysisMath.exactLocal(range.to-1):'请选择起止时间')+'</text><text x="30" y="115" font-size="32">'+escape(PeriodComparison.number(result.value)+' '+result.unit)+'</text>'+[...(result.reason?[result.reason]:[]),...lines].map((line,i)=>'<text x="30" y="'+(155+i*30)+'" font-size="14">'+escape(line)+'</text>').join('')+'</g></svg>';
 }
 function Card({column,range,exportUrl,frame}){
  PointExclusions.useVersion();const [error,setError]=R.useState(''),value=frame?.interval??evaluate(column,range),comparison=frame?.comparison??compare(column,range),sourceId=column.formula.interval.datasetId,title=frame?.config.title||Surface.chartTitle({sourceId},[column]);
  async function save(png){try{setError('');const node=new DOMParser().parseFromString(svg(column,range,value),'image/svg+xml').documentElement;await AnalysisPlots.saveSvg(node,title,png);}catch(e){setError(e.message);}}
  return h('section',{className:'panel auto-chart-card compact-chart-card interval-formula-card','data-column-key':column.key},h('div',{className:'panel-head'},h('div',null,h('h3',null,title,h('span',{className:'badge neutral'},column.unit)),h('p',null,'区间累计值计算')),h('div',{className:'button-row chart-actions'},!frame&&h(OverviewCards.Tools),exportUrl&&h(Dashboard.LegacyPin,{url:exportUrl,title:column.label}),h('button',{className:'button small-button','aria-label':'导出'+column.label+'图表',onClick:()=>save(true)},'PNG'),h('button',{className:'button small-button',onClick:()=>save(false)},'导出 SVG'))),error&&h('p',{role:'alert',className:'error-banner'},error),h(Result,{value,comparison}));
 }
 return {is,configuration,decorate,validate,presence,evaluate,compare,stats,preview,Mode,Preview,Value,Card,svg};
})();
