// Window formulas evaluate the existing safe expression tree once, using each
// reference's cumulative quantity. No window result is stored as a time sample.
var IntervalFormulas=(()=>{
 const R=Se(),h=R.createElement,finite=Number.isFinite,is=column=>column?.formula?.calculationMode==='interval',DAY=86400000,OFFSET=28800000,trendCache=new WeakMap();
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
 const cumulativeUnit=unit=>xr(unit)?.totalUnit??unit;
 function inputMethod(column){
  const meta=xr(column.unit);
  if(meta?.dimension==='percentage')return 'mean';
  return column.kind==='counter'?'difference':meta?.totalUnit?'integral':['sum','difference'].includes(column.aggregation)?column.aggregation:lc(column).method;
 }
 const failure=(message,unit='',operands=[])=>({value:null,unit,operands,reason:message});
 function evaluate(column,range,state=$r().state,visiting=new Set()){
  const formula=column.formula,home=formula?.interval,operands=[],unit=cumulativeUnit(column.unit);
  if(!is(column)||!home)return failure('请选择区间累计值公式。',unit);
  if(!finite(range?.from)||!finite(range?.to)||range.to<=range.from)return failure('请选择有效的起止时间。',unit);
  const id=home.datasetId+':'+column.key;if(visiting.has(id))return failure('公式存在循环引用。',unit);
  const next=new Set([...visiting,id]);
  try{
   const ast=TE(formula.expression,name=>formula.bindings[name]),memo=new Map();
   const result=Jh(ast,{}, {},new Map(),(name,binding)=>{
    if(memo.has(name))return memo.get(name);
    let operand,basis;
    try{
     const sourceId=binding.datasetId??home.datasetId,unitId=binding.unitId??home.unitId,entry=state.datasets[sourceId],input=entry?.dataset.columns.find(c=>c.key===binding.key);
     if(!input||entry.dataset.role!=='ledger'||entry.dataset.status!=='ready'||!entry.dataset.unitIds.includes(unitId)||!state.settings.units.some(u=>u.id===unitId&&!u.archived))throw new Error('引用装置、数据集或指标已不可用。');
     const method=inputMethod(input),cumulative=['sum','difference','integral'].includes(method);
     basis=cumulative?'cumulative':'mean';
     let amount,inputUnit,detail,group=binding.group;
     if(is(input)){
      if(cumulative){
       const nested=evaluate(input,range,state,next);if(!finite(nested.value))throw new Error(nested.reason);
       amount=nested.value;inputUnit=nested.unit;detail='区间公式累计量';
      }else{
       const trend=daily(input,range,state);if(!finite(trend.mean))throw new Error(trend.reason??'所选时段没有有效均值。');
       amount=trend.mean;inputUnit=input.unit;detail='区间均值';
      }
      group=input.formula.interval.group;
     }else{
      const sourceRows=input.formula?FormulaDailyData.view(state,sourceId,entry.points,{columns:[input]}):entry.points,candidates=sourceRows.filter(p=>p.unit===unitId&&Object.hasOwn(p.values,binding.key)),groups=[...new Set(candidates.map(p=>p.group))];
      if(group===undefined)group=!binding.datasetId&&groups.includes(home.group)?home.group:groups.length===1?groups[0]:undefined;
      if(group===undefined)throw new Error(groups.length?'存在多个分组，请选择具体采样点。':'所选指标没有数据。');
      const rows=PointExclusions.apply(sourceId,candidates.filter(p=>p.group===group).sort((a,b)=>a.time-b.time)),stats=Qs(rows,{...input,...input.formula&&method==='integral'?{flowBasis:'daily'}:{},aggregation:cumulative?method:'mean'},range);
      amount=cumulative?(method==='integral'?stats.coverage?.value:stats.sourceValue):stats.sourceMean;
      inputUnit=method==='integral'?cumulativeUnit(input.unit):input.unit;detail=cumulative?stats.label:'区间均值';
      if(!finite(amount))throw new Error(cumulative?'所选时段没有有效累计量（缺测、时长不足或累计表重置）。':'所选时段没有有效均值。');
     }
     const target=cumulative?cumulativeUnit(binding.unit):binding.unit,value=o3(amount,inputUnit,target,formula.percentageMode);
     operand={name,sourceId,unitId,group,value:ro(amount,inputUnit,target),unit:target,detail,basis};operands.push(operand);
     const answer=Fr(value);memo.set(name,answer);return answer;
    }catch(error){
     operand={name,value:null,unit:basis==='mean'?binding.unit:cumulativeUnit(binding.unit),basis,reason:error.message};operands.push(operand);
     const answer={value:null,issue:{kind:'missing',message:'“'+name+'”：'+error.message}};memo.set(name,answer);return answer;
    }
   });
   if(result.issue)return failure(result.issue.message,unit,operands);
   const value=ro(qK(result.value,formula.resultUnit,formula.percentageMode),cumulativeUnit(formula.resultUnit),unit);
   return finite(value)?{value,unit,operands,reason:null}:failure('计算结果超出有效数值范围。',unit,operands);
  }catch(error){return failure(error.message,unit,operands);}
 }
 function compare(column,range,state=$r().state){
  const current=evaluate(column,range,state),previousRange=PeriodMath.previous(range),previous=previousRange?evaluate(column,previousRange,state):failure('请选择有效的起止时间。',column.unit);
  return {range:previousRange?range:null,previousRange,current:{mean:current.value,count:finite(current.value)?1:0},previous:{mean:previous.value,count:finite(previous.value)?1:0},status:!previousRange?'no-range':!finite(current.value)?'no-current':!finite(previous.value)?'no-previous':'ok'};
 }
 // Build a read-only point calculation of just this recipe's dependency graph.
 // Daily means and cumulative accounting share a recipe, but never a result.
 function pointView(column,state,masked=true){
  const home=column.formula.interval,entries=new Map(),required=new Map(),visiting=new Set();
  function visit(id,key){
   const token=id+':'+key;if(required.has(token))return;if(visiting.has(token))throw new Error('公式存在循环引用。');
   const entry=state.datasets[id],input=id===home.datasetId&&key===column.key?column:entry?.dataset.columns.find(c=>c.key===key);
   if(!entry||!input)return;
   entries.set(id,entry);visiting.add(token);
   for(const binding of Object.values(input.formula?.bindings??{}))visit(binding.datasetId??id,binding.key);
   visiting.delete(token);required.set(token,input);
  }
  visit(home.datasetId,column.key);
  const signature=[...entries].map(([id,e])=>({id,entry:e,dataset:e.dataset,points:e.points,updatedAt:e.dataset.updatedAt})),revision=state.analytics?.exclusionRevision??0,scope=AccountAuth.storageKey(),cached=trendCache.get(column);
  if(cached&&cached.revision===revision&&cached.scope===scope&&cached.settings===state.settings&&cached.masked===masked&&signature.length===cached.signature.length&&signature.every((v,i)=>Object.keys(v).every(k=>v[k]===cached.signature[i][k])))return cached.view;
  const projected={...state,datasets:{}};
  for(const [id,entry]of entries){
   const columns=entry.dataset.columns.filter(c=>!c.formula||required.has(id+':'+c.key)).map(c=>required.get(id+':'+c.key)??c);
   if(id===home.datasetId&&!columns.some(c=>c.key===column.key))columns.push(column);
   const perPoint=columns.map(c=>is(c)?{...c,formula:{...c.formula,calculationMode:'point',matching:{...eg(c.formula),targetGroup:c.formula.interval.group}}}:c);
   const points=structuredClone(masked?PointExclusions.apply(id,entry.points):entry.points);
   projected.datasets[id]={dataset:{...entry.dataset,columns:perPoint},points:Ho(perPoint,points)};
  }
  CrossUnit.recalculate(projected);
  const computed=projected.datasets[home.datasetId]?.points??[],view=(masked?PointExclusions.apply(home.datasetId,computed):computed).filter(p=>p.unit===home.unitId&&p.group===home.group&&Object.hasOwn(p.values,column.key)).sort((a,b)=>a.time-b.time);
  trendCache.set(column,{signature,revision,scope,settings:state.settings,masked,view});return view;
 }
 function daily(column,range,state=$r().state){
  try{
   const home=column.formula.interval,rows=FormulaDailyData.daily(state,home.datasetId,column).filter(p=>p.unit===home.unitId&&p.group===home.group&&(!range||p.time>=range.from&&p.time<range.to)),points=rows.map(p=>({time:p.time,value:p.values[column.key],count:p.dailySampleCounts?.[column.key]??0,missing:finite(p.values[column.key])?0:1,...p.excludedValues?{excludedValues:p.excludedValues}:{}})),valid=points.filter(p=>finite(p.value));
   const mean=valid.length?valid.reduce((mean,p,i)=>mean+(p.value-mean)/(i+1),0):null;
   return {points,mean,count:valid.length,missing:points.length-valid.length,sampleCount:valid.reduce((n,p)=>n+p.count,0),min:valid.length?Math.min(...valid.map(p=>p.value)):null,max:valid.length?Math.max(...valid.map(p=>p.value)):null,reason:valid.length?null:'当前时段暂无有效日均值。'};
  }catch(error){return {points:[],mean:null,count:0,missing:0,min:null,max:null,reason:error.message};}
 }
 function meanComparison(column,range,state=$r().state){
  const current=daily(column,range,state),previousRange=PeriodMath.previous(range),previous=previousRange?daily(column,previousRange,state):{mean:null,count:0};
  return {range:previousRange?range:null,previousRange,current:{mean:current.mean,count:current.count},previous:{mean:previous.mean,count:previous.count},status:!previousRange?'no-range':!finite(current.mean)?'no-current':!finite(previous.mean)?'no-previous':'ok'};
 }
 function stats(column,range){
  const trend=daily(column,range),value=trend.mean;
  return {value,unit:column.unit,label:'每日计算结果均值',detail:'公式指标使用每日计算结果。',count:trend.count,missing:trend.missing,totalCount:trend.count+trend.missing,rawUnit:column.unit,last:trend.points.filter(p=>finite(p.value)).at(-1)?.value??null,min:trend.min,max:trend.max,coverage:null,mean:value,meanUnit:column.unit,sourceMean:value,canTotal:false,totalValue:null,sourceValue:value,sourceUnit:column.unit,trend};
 }
 function preview(state,id,column,body){
  if(!is(column))return null;
  const range=yr(body.from,body.to),interval=evaluate(column,range,state),valid=finite(interval.value)?1:0;
  return Response.json({column,referenceRevision:CrossUnit.revision($r().state),coverage:[],summary:{total:1,valid,missing:1-valid,errors:0},allCount:1,points:[],references:interval.operands,resultUnit:column.formula.resultUnit,interval:{...interval,range,dailyUnit:column.unit,daily:daily(column,range,state)}});
 }
 function Mode({value,onChange}){return h('div',{className:'interval-formula-mode'},h('label',{className:'form-label'},'计算口径',h('select',{'aria-label':'公式计算口径',value,onChange:e=>onChange(e.target.value)},h('option',{value:'point'},'逐点计算'),h('option',{value:'interval'},'区间累计值计算'))),h('p',{className:'small muted'},value==='interval'?'折线显示每日逐点计算结果的均值；区间汇总值优先使用各输入的区间累计量；百分数等无累计量的输入使用区间均值，再代入公式。':'按每个采样时间的输入值计算。'))}
 function Operands({value}){return !value.operands.length?null:h('div',{className:'table-wrap'},h('table',{className:'data-table interval-formula-inputs'},h('thead',null,h('tr',null,h('th',null,'公式引用'),h('th',null,'代入值（累计量 / 均值）'))),h('tbody',null,...value.operands.map(o=>h('tr',{key:o.name},h('td',null,o.name,h('small',{className:'history-file'},o.basis==='mean'?'区间均值':'区间累计量')),h('td',{title:o.detail},finite(o.value)?PeriodComparison.number(o.value)+' '+o.unit:o.reason))))));}
 function Result({value,comparison}){return h(R.Fragment,null,h('div',{className:'mean-period-row interval-formula-result'},h('b',null,h('small',{className:'stat-value-label'},'区间汇总值'),h('span',{'data-interval-value':value.value??''},PeriodComparison.number(value.value)),h('small',null,value.unit)),comparison&&h(PeriodComparison.Values,{result:comparison,unit:value.unit,current:value.value,basis:'按区间累计值代入公式',previousLabel:'上期结果'})),value.reason&&h('p',{className:'note-line',role:'status'},value.reason),h(Operands,{value}));}
 function Preview({value}){const column={key:'result',label:'每日计算结果均值',unit:value?.dailyUnit??value?.unit??''},series=value?.daily?{column,...LiveSeries.sample(value.daily.points.map(p=>({time:p.time,values:{result:p.value},...p.excludedValues?{excludedValues:{result:Object.values(p.excludedValues)[0]}}:{}})),'result')}:null;return value?h('section',{className:'formula-preview','aria-label':'公式计算预览'},h('h4',null,'区间累计值计算'),h('p',{className:'small muted'},finite(value.range.from)&&finite(value.range.to)?AnalysisMath.exactLocal(value.range.from).replace('T',' ')+' — '+AnalysisMath.exactLocal(value.range.to-1).replace('T',' '):'请选择起止时间'),value.daily&&h('p',null,'均值：'+PeriodComparison.number(value.daily.mean)+' '+column.unit),series&&h(LiveChart.Chart,{series,config:{compact:true},color:'#168577',title:'每日计算结果均值',pin:false,bare:true,showPoints:true,disabled:true}),h(Result,{value})):null;}
 function Value({column,from,to}){const trend=daily(column,yr(from,to));return h('span',null,'每日结果均值：'+PeriodComparison.number(trend.mean)+' '+column.unit);}
 function TableValue({value}){return h('b',{'data-interval-summary':value.value??''},PeriodComparison.number(value.value)+' '+value.unit);}
 function KPISummary({column}){return h('span',null,is(column)?'区间汇总值':'均值');}
 function KPIValue({column,stats,range}){
  const value=stats.interval??evaluate(column,range);
  return h(R.Fragment,null,h('span',{'data-kpi-summary':value.value??''},nt(value.value,3),h('small',null,value.unit)),h(PeriodComparison.Values,{result:compare(column,range),unit:value.unit,current:value.value,basis:'累计量优先，其余指标使用区间均值',previousLabel:'上期汇总值'}));
 }
 function svg(column,range,trend=daily(column,range)){
  const escape=AnalysisPlots.escape,number=PeriodComparison.number,tr=Surface.t,height=520;
  const rows=trend.points.map(p=>({time:p.time,values:{[column.key]:p.value},...p.excludedValues?{excludedValues:p.excludedValues}:{}})),series={column,...LiveSeries.sample(rows,column.key)},config={from:finite(range?.from)?AnalysisMath.exactLocal(range.from):'',to:finite(range?.to)?AnalysisMath.exactLocal(range.to-1):'',width:1000},annual=YearlyMeans.model({sourceId:column.formula.interval.datasetId,unitId:column.formula.interval.unitId,group:column.formula.interval.group,keys:[column.key]},[column],column.unit,{period:"raw",range}).refs,g=LiveChart.geometry(series,config,annual);
  const chart=series.points.length?'<g transform="translate(0 110)">'+g.ticks.map(t=>'<line x1="'+g.L+'" x2="'+g.E+'" y1="'+g.y(t.value)+'" y2="'+g.y(t.value)+'" stroke="#e5edf1" stroke-dasharray="3 5"/><text x="'+(g.L-10)+'" y="'+(g.y(t.value)+4)+'" text-anchor="end">'+escape(t.label)+'</text>').join('')+ChartAxes.timeTicks(g.x0,g.x1,g.E-g.L,6).map(t=>'<text x="'+g.x(t.value)+'" y="339" text-anchor="'+(g.x(t.value)>g.E-25?'end':g.x(t.value)<g.L+25?'start':'middle')+'">'+escape(t.label)+'</text>').join('')+YearlyMeans.svg(annual,{L:g.L,E:g.E,y:g.y})+'<path data-daily-mean-series="true" d="'+g.path+'" fill="none" stroke="#168577" stroke-width="2"/>'+ (series.points.length<=80?series.points:[]).map(p=>'<circle data-daily-mean-point="'+p.time+'" data-daily-mean-value="'+p.value+'" cx="'+g.x(p.time)+'" cy="'+g.y(p.value)+'" r="3" fill="#168577"/>').join('')+'<text x="'+((g.L+g.E)/2)+'" y="380" text-anchor="middle">'+escape(tr('时间（北京时间）')+' · '+tr('每日均值'))+'</text><text x="18" y="180" transform="rotate(-90 18 180)" text-anchor="middle">'+escape(column.unit)+'</text></g>':'<text x="30" y="270">'+escape(tr(trend.reason??'当前时段暂无有效日均值。'))+'</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 '+height+'" role="img" data-complete-chart="1" aria-label="'+escape(column.label+' '+tr('每日均值'))+'"><g font-family="Arial,Microsoft YaHei,sans-serif" font-size="12" fill="#243b31"><text x="30" y="35" font-size="20">'+escape(column.label+' · '+tr('每日均值折线'))+'</text><text x="30" y="65">'+escape(finite(range?.from)&&finite(range?.to)?AnalysisMath.exactLocal(range.from)+' — '+AnalysisMath.exactLocal(range.to-1):'全部时间')+'</text><text x="30" y="100" font-size="24">'+escape(tr('均值'))+' '+escape(number(trend.mean)+' '+column.unit)+'</text>'+chart+'</g></svg>';
 }
 function Card({column,range,exportUrl,frame,onZoom}){
  PointExclusions.useVersion();const [error,setError]=R.useState(''),[zoom,setZoom]=R.useState(null),signature=JSON.stringify([column.formula.interval,column.key,range]),active=zoom?.signature===signature?zoom.range:range,isZoom=active!==range;
  const trend=!isZoom&&frame?.daily||daily(column,active),previousMean=!isZoom&&frame?.meanComparison||meanComparison(column,active),sourceId=column.formula.interval.datasetId,title=frame?.config.title||Surface.chartTitle({sourceId},[column]);
  const config={sourceId,unitId:column.formula.interval.unitId,keys:[column.key],group:column.formula.interval.group,compact:true,palette:frame?.config.palette??'coast',from:finite(active?.from)?AnalysisMath.exactLocal(active.from):'',to:finite(active?.to)?AnalysisMath.exactLocal(active.to-1):''},annual=YearlyMeans.use(config,[column],column.unit,{period:'raw',range:active}),series={column,...LiveSeries.sample(trend.points.map(p=>({time:p.time,values:{[column.key]:p.value},...p.excludedValues?{excludedValues:p.excludedValues}:{}})),column.key)},color=(AnalysisPlots.palettes[config.palette]??AnalysisPlots.palettes.coast)[0];
  function selectRange(next){if(onZoom)onZoom(next);else setZoom({signature,range:{from:AnalysisMath.time(next.from),to:AnalysisMath.time(next.to)+1}});}
  async function save(png){try{setError('');const node=new DOMParser().parseFromString(svg(column,active,trend),'image/svg+xml').documentElement;await AnalysisPlots.saveSvg(node,title,png);}catch(e){setError(e.message);}}
  return h('section',{className:'panel auto-chart-card compact-chart-card interval-formula-card','data-column-key':column.key},h('div',{className:'panel-head'},h('div',null,h('h3',null,title,h('span',{className:'badge neutral'},column.unit)),h('p',null,'每日均值折线')),h(YearlyMeans.Header,{model:annual},!frame&&h(OverviewCards.Tools),exportUrl&&h(Dashboard.LegacyPin,{url:exportUrl,title:column.label}),h(PointExclusions.Tools,{...config,allGroups:false,to:finite(active?.to)?AnalysisMath.local(active.to-1):'',title:column.label}),h('button',{className:'button small-button','aria-label':'导出'+column.label+'图表',onClick:()=>save(true)},'PNG'),h('button',{className:'button small-button','aria-label':'导出'+column.label+'SVG',onClick:()=>save(false)},'导出 SVG'))),error&&h('p',{role:'alert',className:'error-banner'},error),
   isZoom&&h('button',{className:'button small-button',onClick:()=>setZoom(null)},'恢复所选时段'),
   h('div',{className:'auto-chart-stat'},h('div',{className:'mean-period-row'},h('b',null,h('small',{className:'stat-value-label'},'均值'),h('span',{'data-interval-mean':trend.mean??''},PeriodComparison.number(trend.mean)),h('small',null,column.unit)),h(PeriodComparison.Values,{result:previousMean,unit:column.unit,current:trend.mean,basis:'所选时段每日计算结果的算术均值'}))),
   h('div',{'data-interval-daily-chart':'true'},h(LiveChart.Chart,{series,config,color,title:column.label+' · 每日均值',pin:false,bare:true,showPoints:true,yearlyModel:annual,onZoom:selectRange})),
   h('p',{className:'small muted interval-daily-basis'},'公式指标按每日结果用于分析，原始指标保留原始采样点。'));
 }
 return {is,configuration,decorate,validate,presence,evaluate,compare,stats,preview,pointView,daily,meanComparison,KPISummary,KPIValue,TableValue,Mode,Preview,Value,Card,svg};
})();
