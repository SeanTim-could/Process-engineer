// Permanent removal is a separate, reviewed operation over one archived unit.
var UnitRemoval=(()=>{
 const R=Se(),h=R.createElement;
 let committedPlan=null;
 const removedSource=(id,unit,ids)=>id==='raw:'+unit||ids.has(id);
 function plan(state,unitId){
  const unit=state.settings.units.find(u=>u.id===unitId);if(!unit?.archived)throw new Error('请先删除并保存此装置，再执行永久删除。');
  if(state.settings.units.length<2)throw new Error('请先新增一个装置，再永久删除最后一个装置。');
  const next=structuredClone(state),removed=new Set(),primary=new Set(),counts={points:0,records:0,reports:0,datasets:0,charts:0,dependentFormulas:0};
  next.settings.units=next.settings.units.filter(u=>u.id!==unitId);
  for(const [id,entry]of Object.entries(next.datasets)){
   if(entry.dataset.unitIds[0]===unitId)primary.add(id);
   const rows=entry.points.filter(p=>p.unit!==unitId),owners=entry.dataset.unitIds.filter(id=>id!==unitId);counts.points+=entry.points.length-rows.length;
   if(!owners.length||rows.length!==entry.points.length&&!rows.length&&entry.dataset.role!=='ledger'){delete next.datasets[id];removed.add(id);counts.datasets++;continue;}
   if(rows.length!==entry.points.length||owners.length!==entry.dataset.unitIds.length){const times=rows.map(p=>p.time);entry.points=rows;entry.dataset={...entry.dataset,unitIds:owners,count:rows.length,expectedCount:rows.length,start:times.length?times.reduce((a,b)=>Math.min(a,b),Infinity):0,end:times.length?times.reduce((a,b)=>Math.max(a,b),-Infinity):0,groups:[...new Set(rows.map(p=>p.group))].sort(),updatedAt:new Date().toISOString()};}
  }
  const filter=(key,test)=>{const old=next[key]??[];next[key]=old.filter(test);return old.length-next[key].length;};
  counts.records=filter('records',r=>r.unit!==unitId);counts.reports=filter('reports',r=>r.unit!==unitId)+filter('metricReports',r=>r.unitId!==unitId);
  next.focusNotes=Object.fromEntries(Object.entries(next.focusNotes??{}).filter(([k])=>!k.startsWith(unitId+':')));
  next.importLog=(next.importLog??[]).map(log=>({...log,units:log.units.filter(id=>id!==unitId)})).filter(log=>log.units.length);
  if(next.lastRun)next.lastRun={...next.lastRun,results:next.lastRun.results.filter(r=>r.unit!==unitId&&r.unitId!==unitId)};
  if(next.lastRun&&!next.lastRun.results.length)next.lastRun=null;
  const fallback=next.settings.units.find(u=>!u.archived),source=Object.values(next.datasets).find(e=>e.dataset.role==='ledger'&&e.dataset.unitIds.includes(fallback?.id));
  for(const key of ['view','limsView'])if(next[key]&&(next[key].unitId===unitId||removed.has(next[key].sourceId)))next[key]={...next[key],unitId:fallback?.id??'',sourceId:source?.dataset.id??'raw',group:source?.dataset.groups[0]??''};
  if(next.comparison)next.comparison={...next.comparison,lines:next.comparison.lines.filter(l=>l.unitId!==unitId&&!removedSource(l.datasetId,unitId,removed))};
  const sync=ExcelSync.normalize(next.excelSync);next.excelSync={...sync,target:sync.target.unitId===unitId?{unitId:fallback?.id??'',group:'PI',source:'production'}:sync.target,targets:Object.fromEntries(Object.entries(sync.targets).filter(([id])=>id!==unitId)),sources:sync.sources.filter(s=>s.unitId!==unitId),dailyRows:sync.dailyRows.filter(s=>s.unitId!==unitId),liveGroups:sync.liveGroups.filter(s=>s.unitId!==unitId)};
  const analytics=DataAnalysis.normalize(next.analytics),touches=item=>item?.kind==='overlay'?item.layers.some(touches):item?.unitId===unitId||removedSource(item?.config?.sourceId??item?.sourceId,unitId,removed),ownsSource=id=>removedSource(id,unitId,removed)||primary.has(id);
  const charts=analytics.charts.filter(c=>!ownsSource(c.sourceId)),cards=analytics.dashboard.cards.filter(c=>!touches(c));counts.charts=analytics.charts.length-charts.length+analytics.dashboard.cards.length-cards.length;
  const drafts=Object.fromEntries(Object.entries(analytics.drafts).filter(([,d])=>!ownsSource(d.config?.sourceId)&&!ownsSource(d.workspace?.afterChoice?.sourceId)));
  next.analytics={...analytics,revision:analytics.revision+1,charts,drafts,yearlyMeans:(analytics.yearlyMeans??[]).filter(p=>p.unitId!==unitId&&!removedSource(p.sourceId,unitId,removed)),excludedPoints:analytics.excludedPoints.filter(p=>p.unit!==unitId&&!removedSource(p.sourceId,unitId,removed)),exclusionRevision:analytics.exclusionRevision+1,dashboard:{...analytics.dashboard,revision:analytics.dashboard.revision+1,cards},pca:{...analytics.pca,revision:analytics.pca.revision+1,models:analytics.pca.models.filter(m=>m.unitId!==unitId&&!removedSource(m.sourceId,unitId,removed))},oee:{...OEEWorkspace.normalize(analytics.oee),revision:(analytics.oee?.revision??0)+1,edits:(analytics.oee?.edits??[]).filter(e=>e.unitId!==unitId&&!removed.has(e.sourceId))}};
  for(const entry of Object.values(next.datasets))for(const column of entry.dataset.columns)if(Object.values(column.formula?.bindings??{}).some(b=>b.unitId===unitId||removed.has(b.datasetId)))counts.dependentFormulas++;
  const validated=DC({format:'process-studio-offline',version:1,state:next});
  return {state:validated,counts,unitId,name:unit.name,removed:[...removed],token:vC(JSON.stringify([unitId,state]))};
 }
 async function request(req){
  if(req.method!=='POST')throw new Error('永久删除操作无效。');const body=await Ha(req),state=$r().state,review=plan(state,body.unitId);
  if(body.action==='review')return Response.json({unitId:review.unitId,name:review.name,counts:review.counts,token:review.token});
  if(body.action!=='delete'||body.token!==review.token)throw new Error('工作台数据已变化，请重新核对永久删除范围。');
  if(body.confirmName!==review.name)throw new Error('请准确输入装置名称以确认永久删除。');
  Object.assign(qt(),review.state);committedPlan={...review,scope:AccountAuth.storageKey()};return Response.json({ok:true,unitId:review.unitId,counts:review.counts});
 }
 function committed(state){
  const deleted=committedPlan;committedPlan=null;if(!deleted||deleted.scope!==AccountAuth.storageKey()||state.settings.units.some(u=>u.id===deleted.unitId))return;
  ExcelSync.stopTarget(deleted.unitId);AnalysisDrafts.reset(state.analytics?.drafts);ViewDefaults.forgetUnit(deleted.unitId,deleted.removed);
  try{const key='workbench-live-selection:'+deleted.scope,value=JSON.parse(localStorage.getItem(key)||'{}');if(value.groups)delete value.groups[deleted.unitId];if(value.unitId===deleted.unitId)value.unitId=state.settings.units.find(u=>!u.archived)?.id??'';localStorage.setItem(key,JSON.stringify(value));}catch{}
  const prefix=deleted.scope+':overview-layout:v1:';for(const key of Object.keys(localStorage))if(key.startsWith(prefix))try{const [source,unit]=JSON.parse(key.slice(prefix.length));if(unit===deleted.unitId||deleted.removed.includes(source))localStorage.removeItem(key);}catch{}
  Dashboard.notify();
 }
 async function api(body){const response=await T0('/api/unit-removal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
 function Control({unit,draft}){
  const [review,setReview]=R.useState(null),[name,setName]=R.useState(''),[busy,setBusy]=R.useState(false),[error,setError]=R.useState(''),dirty=JSON.stringify(draft)!==JSON.stringify($r().state.settings);
  async function open(){setError('');setBusy(true);try{await Ei();setReview(await api({action:'review',unitId:unit.id}));setName('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function remove(){setBusy(true);setError('');try{await api({action:'delete',unitId:unit.id,token:review.token,confirmName:name});location.reload();}catch(e){setError(e.message);setBusy(false);}}
  return h(R.Fragment,null,h('button',{type:'button',className:'button small-button metric-delete',disabled:busy||dirty,title:dirty?'请先保存设置，再永久删除':'永久删除装置及其历史数据','aria-label':'永久删除装置'+unit.name,onClick:open},'永久删除'),!review&&error&&h('span',{role:'alert'},error),review&&h(Vr,{title:'永久删除装置',onClose:()=>!busy&&setReview(null),dismissOnBackdrop:false,closeDisabled:busy},h('div',{className:'modal-body'},h('p',null,'将从当前工作台永久删除：'+review.name),h('ul',null,h('li',null,'采样记录（含导入档案）：'+review.counts.points),h('li',null,'日报记录：'+review.counts.records),h('li',null,'月报与快照：'+review.counts.reports),h('li',null,'相关图表：'+review.counts.charts)),h('p',null,'同时移除该装置的OEE、PCA和同步配置。此操作无法在工作台中恢复；已有导出文件保留。'),review.counts.dependentFormulas>0&&h('p',null,'其他装置有 '+review.counts.dependentFormulas+' 个公式引用此装置，删除后将提示来源缺失，请重新配置引用。'),h('label',{className:'form-label'},'输入装置名称确认永久删除',h('input',{'aria-label':'确认永久删除的装置名称',value:name,disabled:busy,onChange:e=>setName(e.target.value)})),error&&h('p',{role:'alert',className:'error-banner'},error)),h('div',{className:'modal-footer'},h('button',{type:'button',className:'button',disabled:busy,onClick:()=>setReview(null)},'取消'),h('button',{type:'button',className:'button metric-delete',disabled:busy||name!==review.name,onClick:remove},busy?'正在永久删除…':'确认永久删除'))));
 }
 return {request,committed,Control};
})();
