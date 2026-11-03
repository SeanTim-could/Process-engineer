// MDC belongs to a device; OEE loss records belong to an account/month/binding.
var OEEWorkspace=(()=>{
 const M=OEEMath;
 function unit(value){
  if(value===undefined)return {mdc:null,sourceId:'',key:'',group:''};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('MDC设置无效。');
  const mdc=value.mdc===null||value.mdc===undefined||value.mdc===''?null:Number(value.mdc),sourceId=value.sourceId??'',key=value.key??'',group=value.group??'';
  if(mdc!==null&&(!['number','string'].includes(typeof value.mdc)||!Number.isFinite(mdc)||mdc<=0||mdc>Number.MAX_SAFE_INTEGER))throw new Error('MDC须为大于0的有效数字，单位为吨/天。');
  if(typeof sourceId!=='string'||sourceId&&!/^ds_[\w-]{1,180}$/.test(sourceId)||typeof key!=='string'||key&&!/^\w{1,100}$/.test(key)||typeof group!=='string'||group.length>80||!!sourceId!==!!key)throw new Error('OEE出料流量配置无效。');
  return {mdc,sourceId,key,group};
 }
 const signature=value=>JSON.stringify([value.unitId,value.month,value.sourceId,value.key,value.group]);
 function normalize(value){
  if(value===undefined)return {version:1,revision:0,edits:[]};
  if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.edits)||value.edits.length>2000)throw new Error('OEE筛选记录无效。');
  const seen=new Set(),edits=value.edits.map(edit=>{
   if(!edit||!/^[-\w]{1,40}$/.test(edit.unitId??''))throw new Error('OEE筛选装置无效。');
   const binding=unit(edit),bounds=M.monthRange(edit.month,Date.now());
   if(!binding.sourceId)throw new Error('OEE筛选配置无效。');
   if(!Array.isArray(edit.losses)||edit.losses.length>128)throw new Error('每个装置每月最多128项OEE损失。');
   const lossIds=new Set(),losses=edit.losses.map(loss=>{
    if(!loss||!/^loss_[\w-]{1,80}$/.test(loss.id??'')||lossIds.has(loss.id)||typeof loss.name!=='string'||!loss.name.trim()||loss.name.length>80||typeof loss.counted!=='boolean'||loss.kind!=='range')throw new Error('OEE损失项目须选择出料流量时段。');
    lossIds.add(loss.id);const base={id:loss.id,name:loss.name.trim(),counted:loss.counted,kind:loss.kind};
    const [range]=M.union([loss]);if(range.from<bounds.from||range.to>bounds.end)throw new Error('损失时段须在当前统计月份内。');return {...base,...range};
   });
   const ranges=losses.filter(loss=>loss.kind==='range').sort((a,b)=>a.from-b.from);if(ranges.some((range,i)=>i>0&&range.from<ranges[i-1].to))throw new Error('损失时段不能重叠，以免重复计算损失。');
   const result={unitId:edit.unitId,month:edit.month,sourceId:binding.sourceId,key:binding.key,group:binding.group,losses},id=signature(result);
   if(seen.has(id))throw new Error('OEE筛选记录重复。');seen.add(id);return result;
  });return {version:1,revision:value.revision,edits};
 }
 function metadata(column){const rate=xr(column.unit),mass=rate?.totalUnit?xr(rate.totalUnit):null;return column.source!=='lims'&&column.kind!=='counter'&&column.kind!=='limit'&&mass?.dimension==='mass'?{...rate,totalUnit:mass.unit}:null;}
 function choices(state){
  const result=[];
  for(const entry of Object.values(state.datasets)){
   const d=entry.dataset;if(d.status!=='ready'||d.role!=='ledger')continue;
   for(const unitId of d.unitIds){
    if(!state.settings.units.some(u=>u.id===unitId&&!u.archived))continue;
    for(const c of d.columns.filter(metadata)){
     const groups=[...new Set(entry.points.filter(p=>p.unit===unitId&&Object.hasOwn(p.values,c.key)).map(p=>p.group))].sort();
     result.push({unitId,sourceId:d.id,key:c.key,label:c.label,unit:c.unit,groups});
    }
   }
  }return result;
 }
 function frame(state,device,month,edit,now,plot=false){
  const config=unit(device.oee),bounds=M.monthRange(month,now),base={unitId:device.id,name:device.name,mdc:config.mdc,config,bounds,edit:edit??{losses:[]}},entry=state.datasets[config.sourceId],column=entry?.dataset.columns.find(c=>c.key===config.key),meta=column?metadata(column):null;
  let status=!config.mdc?'未设置MDC':!config.sourceId?'未选择出料流量':!entry||entry.dataset.role!=='ledger'||entry.dataset.status!=='ready'||!entry.dataset.unitIds.includes(device.id)||!meta?'出料流量来源不可用':null;
  if(status)return {...base,status,actual:null,target:null,oee:null,points:[]};
  // Use the exact selected sampling group once, even if it is also hidden in
  // Overview. Readings, sibling columns, source statistics and masks stay intact.
  const rows=PointExclusions.apply(config.sourceId,entry.points.filter(p=>p.unit===device.id&&p.group===config.group&&Object.hasOwn(p.values,column.key))).sort((a,b)=>a.time-b.time),integrate=range=>{const result=HK(rows,column,range);return {...result,value:result.value===null?null:ro(result.value,meta.totalUnit,'t')};},summary=M.summarize({mdc:config.mdc,bounds,losses:base.edit.losses,integrate});
  status=!bounds.days?'该月份尚未开始':summary.actual===null?'暂无可积分的出料数据':summary.countedLoss===null?'所选损失时段数据未齐':!summary.losses.some(loss=>loss.counted)?'未计入损失（按100%显示）':summary.oee<0?'损失超过理论产能，请核对流量':summary.coverage<.999999?'已按所选损失计算，月数据未齐':'已按所选损失计算';
  let points=[];
  if(plot&&rows.length){
   let before,after;for(const row of rows){if(row.time<bounds.from)before=row;else if(row.time>bounds.to){after=row;break;}}
   const selected=rows.filter(p=>p.time>=bounds.from&&p.time<=bounds.to),plotRows=[...before?[before]:[],...selected,...after?[after]:[]],gap=HK(rows,column,bounds).maxGapHours*3600000,tagged=[];
   for(const p of plotRows){const previous=tagged.at(-1);if(previous&&gap&&p.time-previous.time>gap)tagged.push({time:previous.time+1,values:{[column.key]:null}});tagged.push(p);}
   points=LiveSeries.sample(tagged,column.key).points;
  }
  return {...base,...summary,status,mdcRate:ro(config.mdc,'t',meta.totalUnit)*(meta.seconds??3600)/86400,column:{key:column.key,label:column.label,unit:column.unit},points};
 }
 function compute(state,month,unitId,now=Date.now()){
  const saved=normalize(state.analytics?.oee),devices=state.settings.units.filter(u=>!u.archived),selected=devices.find(u=>u.id===unitId)??devices[0];
  const results=devices.map(device=>{const config=unit(device.oee),edit=saved.edits.find(e=>signature(e)===signature({...config,unitId:device.id,month}));return frame(state,device,month,edit,now,device===selected);});
  return {month,now,revision:saved.revision,units:results.map(({points,...rest})=>rest),chart:results.find(r=>r.unitId===selected?.id)??null};
 }
 async function request(req){
  const state=$r().state,url=new URL(req.url);
  if(req.method==='GET')return Response.json(url.searchParams.has('catalog')?{choices:choices(state)}:compute(state,url.searchParams.get('month')??br().slice(0,7),url.searchParams.get('unitId')));
  if(req.method!=='PUT')throw new Error('OEE操作无效。');
  const body=await Ha(req),saved=normalize(state.analytics?.oee);
  if(body.expectedRevision!==saved.revision)throw new Error('OEE筛选已在其他窗口更新，请刷新后重试。');
  const device=state.settings.units.find(u=>u.id===body.unitId&&!u.archived);if(!device)throw new Error('OEE装置不可用。');
  const config=unit(device.oee),entry=state.datasets[config.sourceId],column=entry?.dataset.columns.find(c=>c.key===config.key);
  if(!config.mdc||!entry||entry.dataset.status!=='ready'||entry.dataset.role!=='ledger'||!entry.dataset.unitIds.includes(device.id)||!column||!metadata(column))throw new Error('请先在指标设置中指定MDC和有效的生产出料流量。');
  if(JSON.stringify(unit(body.expectedConfig))!==JSON.stringify(config))throw new Error('MDC或出料流量设置已变化，请刷新OEE后重新选择损失时段。');
  const edit=normalize({version:1,revision:0,edits:[{...body.edit,...config,unitId:device.id,month:body.month}]}).edits[0],edits=saved.edits.filter(e=>signature(e)!==signature(edit));
  if(edit.losses.some(loss=>loss.to>M.monthRange(body.month).to))throw new Error('损失时段不能超过当前统计截止时间。');
  if(edit.losses.length)edits.push(edit);
  const next=normalize({...saved,revision:saved.revision+1,edits});qt().analytics={...state.analytics,oee:next};
  return Response.json(compute(state,body.month,device.id));
 }
 return {unit,normalize,metadata,choices,compute,request};
})();
