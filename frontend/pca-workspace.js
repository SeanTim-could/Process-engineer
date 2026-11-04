// Account-local PCA baselines; measurements remain immutable, models travel in workspace files.
var PCAWorkspace = (() => {
  const R=Se(),h=R.createElement,M=PCAMath;
  const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('PCA设置格式无效。');return v;};
  function normalize(value){
    if(value===undefined)return {version:1,revision:0,models:[]};
    if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.models)||value.models.length>30)throw new Error('PCA模型列表无效，最多保存30个模型。');
    const ids=new Set();return {version:1,revision:value.revision,models:value.models.map(m=>{
      if(!m||!/^pca_[\w-]{1,80}$/.test(m.id)||ids.has(m.id)||!/^[-\w]{1,40}$/.test(m.unitId)||!Array.isArray(m.columns)||m.columns.length<2||m.columns.length>40||!Number.isFinite(Date.parse(m.createdAt)))throw new Error('PCA模型记录无效。');
      ids.add(m.id);const keys=new Set(),columns=m.columns.map(c=>{if(!c||!/^\w{1,100}$/.test(c.key)||keys.has(c.key))throw new Error('PCA变量顺序无效。');keys.add(c.key);return {key:c.key,label:text(c.label,200),unit:text(c.unit??'',100)};});
      const model=M.validate(m.model);if(model.center.length!==columns.length)throw new Error('PCA模型变量数量不匹配。');
      return {id:m.id,name:text(m.name,100),unitId:m.unitId,sourceId:text(m.sourceId,200),unitName:text(m.unitName,120),sourceName:text(m.sourceName,200),group:text(m.group,100),from:text(m.from,23),to:text(m.to,23),createdAt:m.createdAt,columns,model,excludedCount:Number.isSafeInteger(m.excludedCount)&&m.excludedCount>=0?m.excludedCount:0,droppedCount:Number.isSafeInteger(m.droppedCount)&&m.droppedCount>=0?m.droppedCount:0};
    })};
  }
  function catalog(state){
    const units=state.settings.units.filter(u=>!u.archived);
    return {units:units.map(u=>({id:u.id,name:u.name})),sources:DataAnalysis.sources(state).flatMap(s=>{
      const rows=s.id.startsWith('raw:')?null:state.datasets[s.id]?.points;
      return units.filter(u=>s.id.startsWith('raw:')?s.id==='raw:'+u.id:state.datasets[s.id]?.dataset.unitIds.includes(u.id)).map(u=>({...s,id:s.id,unitId:u.id,name:u.name+' · '+(s.id.startsWith('raw:')?'历史日报':'Excel / PI'),groups:rows?[...new Set(rows.filter(r=>r.unit===u.id).map(r=>r.group))].sort():[''],columns:s.columns.map(c=>({key:c.key,label:c.label,unit:c.unit??''}))}));
    })};
  }
  function data(state,choice,columns){
    const source=catalog(state).sources.find(s=>s.id===choice.sourceId&&s.unitId===choice.unitId);if(!source)throw new Error('请选择当前装置的数据来源。');
    const group=text(choice.group??'',100);if(!source.groups.includes(group))throw new Error('请选择数据分组。');
    const range={from:text(choice.from??'',23),to:text(choice.to??'',23)},start=AnalysisMath.time(range.from),end=AnalysisMath.time(range.to);if(start===null||end===null||start>end)throw new Error('请填写有效的起止时间。');
    const input=DataAnalysis.series(state,source.id).points;
    const rows=input.filter(r=>columns.some(c=>Object.hasOwn(r.values,c.key))&&r.unit===source.unitId&&r.group===group&&r.time>=start&&r.time<end+(choice.exact==='1'?1:60000)).sort((a,b)=>a.time-b.time);
    if(rows.length>100000)throw new Error('PCA时段超过10万个样本，请缩短时间范围。');
    const selected=AnalysisPointMath.apply(source.id,rows,state.analytics?.excludedPoints??[]),complete=selected.filter(r=>columns.every(c=>AnalysisMath.finite(r.values[c.key])));
    return {source,rows:complete,total:rows.length,droppedCount:rows.length-complete.length};
  }
  function match(columns,source){
    return columns.map(c=>{
      const same=source.columns.find(v=>v.key===c.key&&v.label===c.label&&v.unit===c.unit),matches=source.columns.filter(v=>v.label===c.label&&v.unit===c.unit);
      if(same)return same;if(matches.length===1)return matches[0];throw new Error('分析数据缺少模型变量或单位不一致：'+c.label);
    });
  }
  async function request(req){
    const state=$r().state,saved=normalize(state.analytics?.pca),params=new URL(req.url).searchParams,cat=catalog(state);
    if(req.method==='GET'){
      if(!params.get('modelId'))return Response.json({...cat,...saved});
      const baseline=saved.models.find(m=>m.id===params.get('modelId'));if(!baseline)throw new Error('基准模型已不存在。');
      const choice=Object.fromEntries(params);if(choice.unitId!==baseline.unitId)throw new Error('分析装置必须与基准模型一致。');
      const source=cat.sources.find(s=>s.id===choice.sourceId&&s.unitId===choice.unitId);if(!source)throw new Error('请选择分析数据来源。');
      const columns=match(baseline.columns,source),selected=data(state,choice,columns),sampleRow=params.has('at')?selected.rows.find(r=>r.time===Number(params.get('at'))):selected.rows.at(-1),sample=sampleRow?{...M.project(baseline.model,columns.map(c=>sampleRow.values[c.key])),time:sampleRow.time}:null;
      if(params.get('detail')==='1'){if(!sample)throw new Error('所选采样已变化，请刷新分析。');return Response.json({sample});}
      const result=M.analyze(baseline.model,selected.rows.map(r=>columns.map(c=>r.values[c.key])),{compact:true});
      return Response.json({modelId:baseline.id,total:selected.total,droppedCount:selected.droppedCount,columns:baseline.columns,...result,sample,points:result.points.map((p,i)=>({...p,time:selected.rows[i].time}))});
    }
    if(req.method!=='PUT')throw new Error('PCA操作无效。');
    const body=await Ha(req);if(body.expectedRevision!==saved.revision)throw new Error('PCA模型已被其他操作更新，请刷新后重试。');
    let models=[...saved.models];
    if(body.action==='delete'){
      if(!models.some(m=>m.id===body.id))throw new Error('基准模型已不存在。');models=models.filter(m=>m.id!==body.id);
    }else if(body.action==='train'){
      if(models.length>=30)throw new Error('最多保存30个模型，请先删除不再使用的模型。');
      const c=body.config,source=cat.sources.find(s=>s.id===c?.sourceId&&s.unitId===c.unitId);if(!source)throw new Error('请选择建模数据来源。');
      if(!Array.isArray(c.keys)||c.keys.length<2||c.keys.length>40||new Set(c.keys).size!==c.keys.length||c.keys.some(k=>!source.columns.some(v=>v.key===k)))throw new Error('请选择2至40个建模变量。');
      const columns=c.keys.map(k=>source.columns.find(v=>v.key===k)),selected=data(state,c,columns),name=text(c.name??'',100).trim();if(!name)throw new Error('请填写基准模型名称。');
      if(!Array.isArray(c.exclusions)||c.exclusions.length>20)throw new Error('排除区段设置无效。');
      const exclusions=c.exclusions.map(r=>{const a=AnalysisMath.time(r.from),b=AnalysisMath.time(r.to);if(a===null||b===null||a>b)throw new Error('请完整填写排除区段的起止时间。');return [a,b+60000];});
      const training=selected.rows.filter(r=>!exclusions.some(([a,b])=>r.time>=a&&r.time<b)),model=M.train(training.map(r=>columns.map(c=>r.values[c.key])),{threshold:Number(c.threshold),confidence:Number(c.confidence)});
      const baseline={id:'pca_'+crypto.randomUUID(),name,unitId:c.unitId,unitName:cat.units.find(u=>u.id===c.unitId).name,sourceId:c.sourceId,sourceName:source.name,group:c.group,from:c.from,to:c.to,columns,model,excludedCount:selected.rows.length-training.length,droppedCount:selected.droppedCount,createdAt:new Date().toISOString()};models.push(baseline);
    }else throw new Error('PCA操作无效。');
    const next=normalize({...saved,revision:saved.revision+1,models});qt().analytics={...DataAnalysis.normalize(state.analytics),pca:next};return Response.json({...cat,...next});
  }
  async function api(params={},body){const response=await T0('/api/pca'+(body?'':'?'+new URLSearchParams(params)),{method:body?'PUT':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),value=await response.json();if(!response.ok)throw new Error(value.error);return value;}
  return {normalize,request,api,match};
})();
