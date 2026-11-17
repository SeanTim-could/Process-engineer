// PCA measurements have their own workspace collection. Analysis adapters below
// expose read-only copies; production/LIMS imports never write this collection.
var PCAData=(()=>{
 const owns=id=>typeof id==='string'&&/^ds_pca_[\w-]{1,100}$/.test(id),finite=Number.isFinite;
 const str=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw new Error(label+'格式无效。');return v;};
 function selection(value,length){
  if(!Number.isInteger(length)||length<1||length>100000)throw new Error('PCA样本数量无效。');
  const s=value??{from:0,to:length-1,excluded:[]};
  if(!s||!Number.isInteger(s.from)||!Number.isInteger(s.to)||s.from<0||s.to>=length||s.to<s.from||!Array.isArray(s.excluded)||s.excluded.length>length||new Set(s.excluded).size!==s.excluded.length||s.excluded.some(i=>!Number.isInteger(i)||i<0||i>=length))throw new Error('PCA样本筛选无效。');
  return {from:s.from,to:s.to,excluded:[...s.excluded].sort((a,b)=>a-b)};
 }
 function importReport(value,count){
  if(value===undefined)return undefined;
  if(!value||!Number.isInteger(value.sourceRows)||value.sourceRows<1||value.sourceRows>20000||!Array.isArray(value.skippedRows)||value.skippedRows.length+count!==value.sourceRows)throw new Error('PCA导入清理记录无效。');
  const seen=new Set();return {sourceRows:value.sourceRows,skippedRows:value.skippedRows.map(r=>{if(!r||!Number.isInteger(r.row)||r.row<2||r.row>1048576||seen.has(r.row))throw new Error('PCA导入清理行号无效。');seen.add(r.row);return {row:r.row,column:str(r.column,200,'异常变量名称'),value:str(r.value,200,'异常内容')};})};
 }
 function normalize(value){
  if(value===undefined)return {version:1,revision:0,datasets:[]};
  if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.datasets)||value.datasets.length>1000)throw new Error('PCA独立数据仓库无效，最多1000个导入批次。');
  const ids=new Set();let total=0;
  const datasets=value.datasets.map(e=>{
   if(!e||!owns(e.id)||ids.has(e.id)||!/^[-\w]{1,40}$/.test(e.unitId)||!Array.isArray(e.columns)||e.columns.length<2||e.columns.length>80||!Array.isArray(e.points)||!e.points.length||e.points.length>20000||!finite(Date.parse(e.createdAt))||!finite(Date.parse(e.updatedAt)))throw new Error('PCA独立数据格式无效，每份需要2至80个变量、1至20000个样本。');ids.add(e.id);total+=e.points.length;
   const keys=new Set(),columns=e.columns.map(c=>{if(!c||!/^\w{1,100}$/.test(c.key)||keys.has(c.key))throw new Error('PCA变量编号重复或无效。');keys.add(c.key);return {key:c.key,label:str(c.label,200,'变量名称'),unit:str(c.unit??'',100,'变量单位')};});
   const seen=new Set(),points=e.points.map(p=>{if(!p||!Number.isSafeInteger(p.time)||Math.abs(p.time)>8640000000000000||typeof p.group!=='string'||p.group.length>100||!p.values||Array.isArray(p.values)||Object.keys(p.values).some(k=>!keys.has(k)))throw new Error('PCA采样记录无效。');const identity=JSON.stringify([p.time,p.group]);if(seen.has(identity))throw new Error('PCA数据存在同一分组、同一时间的重复样本，请先核对。');seen.add(identity);return {unit:e.unitId,time:p.time,group:p.group,values:Object.fromEntries(columns.map(c=>{const v=p.values[c.key]??null;if(v!==null&&!finite(v))throw new Error('PCA变量必须为数值或空白。');return [c.key,v];}))};});
   return {id:e.id,name:str(e.name,120,'数据名称'),filename:str(e.filename,200,'文件名'),sheet:str(e.sheet,100,'工作表'),unitId:e.unitId,unitName:str(e.unitName,120,'装置名称'),columns,points,selection:selection(e.selection,points.length),...(e.importReport===undefined?{}:{importReport:importReport(e.importReport,points.length)}),createdAt:e.createdAt,updatedAt:e.updatedAt,...e.conflictPolicy===undefined?{}:{conflictPolicy:policy(e.conflictPolicy)}};
  });if(total>100000)throw new Error('PCA数据仓库最多10万个原始样本。');
  const unitSelections=(value.unitSelections??[]).map(e=>{if(!e||!/^[-\w]{1,40}$/.test(e.unitId)||!finite(Date.parse(e.updatedAt))||!Array.isArray(e.decisions)||e.decisions.length>100000)throw new Error('PCA装置筛选记录无效。');const seen=new Set();return {unitId:e.unitId,updatedAt:e.updatedAt,decisions:e.decisions.map(r=>{if(!r||!Number.isSafeInteger(r.time)||typeof r.group!=='string'||r.group.length>100||typeof r.included!=='boolean'||seen.has(identity(r)))throw new Error('PCA装置样本筛选无效。');seen.add(identity(r));return {time:r.time,group:r.group,included:r.included};})};});
  const resolutions=(value.resolutions??[]).map(e=>{if(!e||!/^[-\w]{1,40}$/.test(e.unitId)||!finite(Date.parse(e.updatedAt))||!Array.isArray(e.batchIds)||e.batchIds.length>1000||e.batchIds.some(id=>!owns(id)))throw new Error('PCA历史批次处理记录无效。');return {unitId:e.unitId,batchIds:[...new Set(e.batchIds)],policy:policy(e.policy),updatedAt:e.updatedAt};});
  if(new Set(unitSelections.map(e=>e.unitId)).size!==unitSelections.length||new Set(resolutions.map(e=>e.unitId)).size!==resolutions.length)throw new Error('PCA装置配置重复。');
  return {version:1,revision:value.revision,datasets,unitSelections,resolutions};
 }
 const store=state=>state.analytics?.pcaData??{version:1,revision:0,datasets:[]};
 const identity=p=>JSON.stringify([p.time,p.group]),unitId=id=>'ds_pca_unit_'+id,isUnit=id=>typeof id==='string'&&id.startsWith('ds_pca_unit_');
 function policy(value){if(!['new','old'].includes(value))throw new Error('请选择重叠样本使用新数据还是旧数据。');return value;}
 function combined(current,id){
  const batches=current.datasets.filter(e=>e.unitId===id);if(!batches.length)return null;
  const columns=[],columnMap=new Map(),usedKeys=new Set(),rows=new Map(),decisions=new Map((current.unitSelections??[]).find(e=>e.unitId===id)?.decisions.map(r=>[identity(r),r.included])??[]),resolution=(current.resolutions??[]).find(e=>e.unitId===id);let unresolved=0,overlaps=0;
  const history=[];
  for(const batch of batches){
   const occurrences=new Map(),keys=new Map();for(const c of batch.columns){const base=JSON.stringify([c.label.trim(),c.unit.trim()]),occurrence=occurrences.get(base)??0;occurrences.set(base,occurrence+1);const signature=base+':'+occurrence;let target=columnMap.get(signature);if(!target){let key=c.key,index=1;while(usedKeys.has(key))key='c_'+index++;target={...c,key};usedKeys.add(key);columnMap.set(signature,target);columns.push(target);}keys.set(c.key,target.key);}
   const off=new Set(batch.selection.excluded),chosenPolicy=batch.conflictPolicy??(resolution?.batchIds.includes(batch.id)?resolution.policy:null);let repeated=0;
   batch.points.forEach((p,index)=>{const key=identity(p),mapped=Object.fromEntries(batch.columns.map(c=>[keys.get(c.key),p.values[c.key]??null])),previous=rows.get(key),included=index>=batch.selection.from&&index<=batch.selection.to&&!off.has(index);if(previous){const collision=Object.keys(mapped).some(k=>Object.hasOwn(previous.values,k));if(collision){overlaps++;repeated++;if(!chosenPolicy)unresolved++;}previous.values=chosenPolicy==='new'?{...previous.values,...mapped}:{...mapped,...previous.values};if(chosenPolicy==='new'&&!included)previous.included=false;}else rows.set(key,{unit:id,time:p.time,group:p.group,values:mapped,included});});
   history.push({id:batch.id,name:batch.name,filename:batch.filename,sheet:batch.sheet,createdAt:batch.createdAt,count:batch.points.length,overlaps:repeated,conflictPolicy:chosenPolicy,...batch.importReport?{importReport:batch.importReport}:{}});
  }
  if(columns.length>80)throw new Error('同一装置的PCA变量合计超过80个，请核对变量名称和单位。');
  const points=[...rows.values()].sort((a,b)=>a.time-b.time||a.group.localeCompare(b.group)),included=[];points.forEach((p,i)=>{if(decisions.get(identity(p))??p.included)included.push(i);delete p.included;for(const c of columns)if(!Object.hasOwn(p.values,c.key))p.values[c.key]=null;});
  const from=included[0]??0,to=included.at(-1)??points.length-1,yes=new Set(included),excluded=points.flatMap((p,i)=>i>=from&&i<=to&&!yes.has(i)?[i]:[]),first=batches[0],last=batches.at(-1),updates=[...batches.map(e=>e.updatedAt),(current.unitSelections??[]).find(e=>e.unitId===id)?.updatedAt,resolution?.updatedAt].filter(Boolean);
  return {id:unitId(id),name:first.unitName+' · PCA数据',filename:last.filename,sheet:last.sheet,unitId:id,unitName:first.unitName,columns,points,selection:{from,to,excluded},createdAt:first.createdAt,updatedAt:updates.reduce((a,b)=>Date.parse(a)>Date.parse(b)?a:b),batches:history,overlaps,needsReview:unresolved,...batches.length===1&&first.importReport?{importReport:first.importReport}:{}};
 }
 function entries(current){return [...new Set(current.datasets.map(e=>e.unitId))].map(id=>combined(current,id));}
 function find(state,id){return isUnit(id)?combined(store(state),id.slice('ds_pca_unit_'.length)):store(state).datasets.find(e=>e.id===id);}
 function canonical(state,id){if(isUnit(id))return id;const batch=store(state).datasets.find(e=>e.id===id);return batch?unitId(batch.unitId):id;}

 function selected(e,filter=e.selection){const excluded=new Set(filter.excluded);return e.points.filter((p,i)=>i>=filter.from&&i<=filter.to&&!excluded.has(i));}
 function meta(e){const rows=selected(e),times=rows.map(p=>p.time);return {id:e.id,name:'PCA独立 · '+(e.batches?e.unitName:e.name),filename:e.filename,sheet:e.sheet,origin:'pca',role:'ledger',scope:'pca',status:'ready',unitIds:[e.unitId],groups:[...new Set(rows.map(p=>p.group))],count:rows.length,expectedCount:rows.length,start:times.length?Math.min(...times):e.points[0].time,end:times.length?Math.max(...times):e.points.at(-1).time,createdAt:e.createdAt,updatedAt:e.updatedAt,columns:e.columns.map((c,i)=>({...c,index:i+1,header:c.label+(c.unit?' ('+c.unit+')':''),source:'production',module:'custom:PCA独立数据',kind:'reading',aggregation:'mean',enabled:true,recognized:true,scale:1,limit:null,showTotal:false}))};}
 function migrateExclusions(current,points){
  if(!points.some(p=>owns(p.sourceId)&&!isUnit(p.sourceId)))return points;
  const cache=new Map(),mapped=points.map(p=>{if(!owns(p.sourceId)||isUnit(p.sourceId))return p;const batch=current.datasets.find(e=>e.id===p.sourceId),column=batch?.columns.find(c=>c.key===p.key);if(!batch||!column||p.unit!==batch.unitId)return p;if(!cache.has(batch.unitId))cache.set(batch.unitId,combined(current,batch.unitId));const occurrence=batch.columns.slice(0,batch.columns.indexOf(column)).filter(c=>c.label.trim()===column.label.trim()&&c.unit.trim()===column.unit.trim()).length,target=cache.get(batch.unitId).columns.filter(c=>c.label.trim()===column.label.trim()&&c.unit.trim()===column.unit.trim())[occurrence];return target?{...p,sourceId:unitId(batch.unitId),key:target.key}:p;});
  return [...new Map(mapped.map(p=>[AnalysisPointMath.identity(p),p])).values()];
 }
 function series(state,id,{raw=false}={}){
  const source=find(state,id);if(!source)throw new Error('PCA独立数据已不存在，请重新选择。');let e=source.batches?source:combined(store(state),source.unitId);
  if(e.needsReview)throw new Error('该装置历史批次存在重叠，请先到PCA独立数据中选择使用新数据还是旧数据。');if(!raw)e={...e,points:AnalysisPointMath.apply(e.id,e.points,migrateExclusions(store(state),state.analytics?.excludedPoints??[]))};
  // Historical saved charts keep their variable keys while reading the unit's
  // complete timeline. Model coefficients and original import batches stay fixed.
  if(!isUnit(id)){const targets=[],used=new Set(),occurrences=new Map();for(const c of source.columns){const signature=JSON.stringify([c.label.trim(),c.unit.trim()]),index=occurrences.get(signature)??0;occurrences.set(signature,index+1);const actual=e.columns.filter(v=>v.label.trim()===c.label.trim()&&v.unit.trim()===c.unit.trim())[index];if(actual){targets.push({column:c,actual:actual.key});used.add(c.key);}}for(const c of e.columns){if(targets.some(v=>v.actual===c.key))continue;let key=c.key,n=1;while(used.has(key))key='c_'+n++;used.add(key);targets.push({column:{...c,key},actual:c.key});}e={...e,id,columns:targets.map(v=>v.column),points:e.points.map(p=>({...p,values:Object.fromEntries(targets.map(v=>[v.column.key,p.values[v.actual]])),...p.excludedValues?{excludedValues:Object.fromEntries(targets.filter(v=>Object.hasOwn(p.excludedValues,v.actual)).map(v=>[v.column.key,p.excludedValues[v.actual]]))}:{}}))};}
  return {dataset:meta(e),points:structuredClone(raw?e.points:selected(e))};
 }
 function units(items=[],state=$r().state){const result=items.map(u=>({...u}));for(const e of store(state).datasets){const index=result.findIndex(u=>u.id===e.unitId);if(index<0)result.push({id:e.unitId,name:e.unitName,archived:false});else if(result[index].archived)result[index]={...result[index],archived:false};}return result;}
 const analysisPage=page=>['pca','timeseries','capability','plotting','charts','analysis','comparison'].includes(page);
 function workspace(value,page){return analysisPage(page)?{...value,units:units(value.units),datasets:[...value.datasets,...entries(store($r().state)).map(meta)]}:value;}
 function list(value){return analysisPage(Surface.currentPage())?[...value,...entries(store($r().state)).map(meta)]:value;}
 function sources(state){return entries(store(state)).map(e=>{const view=meta(e);return {id:e.id,name:'PCA独立 · '+e.unitName,unitId:e.unitId,unitName:e.unitName,columns:e.columns,groups:view.groups,start:view.start,end:view.end,updatedAt:e.updatedAt,origin:'pca'};});}
 function number(value){if(value===null||value===undefined||String(value).trim()==='')return null;const text=String(value).trim().replace(/,/g,'');if(['—','--','NA','N/A'].includes(text.toUpperCase()))return null;const n=Number(text.endsWith('%')?text.slice(0,-1):text);if(!finite(n))throw new Error('存在非数值内容：“'+String(value).slice(0,40)+'”。请选择数值变量列。');return n;}
 function timestamp(value){
  if(typeof value==='number'&&value>=1&&value<=80000)return Date.UTC(1899,11,30)+Math.round(value*86400000)-28800000;
  if(typeof value==='number'&&value>=1e11&&Number.isSafeInteger(value))return value;
  const result=St(value),part=String(value).match(/:\d{2}\.(\d+)(?!.*[Zz+-]\d{2})$/);return result+(part?Math.round(Number('0.'+part[1])*1000):0);
 }
 function paste(text){
  // Excel clipboard uses tabs; CSV uses commas. Detect the delimiter outside
  // quoted cells in the first record, retaining quoted newlines and commas.
  let quoted=false,delimiter=',';for(let i=0;i<text.length;i++){if(text[i]==='"'){if(quoted&&text[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted){if(text[i]==='\t'){delimiter='\t';break;}if(text[i]==='\r'||text[i]==='\n')break;}}
  if(delimiter===',')return h3(text);
  const rows=[],row=[];let cell='';quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}else if(c==='\t'&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push([...row]);row.length=0;cell='';}else cell+=c;}
  if(quoted)throw new Error('粘贴内容的引号未闭合。');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);if(rows[0]?.[0])rows[0][0]=rows[0][0].replace(/^\uFEFF/,'');return rows;
 }
 function parse(rows,config){
  if(Number(config.timeColumn)>=0&&Number(config.timeColumn)===Number(config.groupColumn))throw new Error('时间列与分组列不能相同。');
  const header=rows[config.headerRow??0];if(!Array.isArray(header))throw new Error('请选择表头行。');const indices=config.columns;if(!Array.isArray(indices)||indices.length<2||indices.length>80||new Set(indices).size!==indices.length)throw new Error('请选择2至80个数值变量。');
  const columns=indices.map((index,i)=>{const title=String(header[index]??'').trim();if(!title)throw new Error('选中的变量列缺少表头。');const match=title.match(/^(.*?)\s*[（(]([^()（）]*)[）)]\s*$/);return {key:'c_'+(i+1),label:(match?.[1]??title).trim(),unit:match?.[2]?.trim()??''};});
  const start=Number(config.timeColumn)<0?AnalysisMath.time(config.start):null,interval=Number(config.interval);if(Number(config.timeColumn)<0&&(start===null||!finite(interval)||interval<=0))throw new Error('没有时间列时，请填写真实采样开始时间和采样间隔（秒）。');
  const data=rows.slice((config.headerRow??0)+1).map((row,index)=>({row,index})).filter(({row})=>Array.isArray(row)&&row.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''));if(!data.length||data.length>20000)throw new Error('需要1至20000行样本。');
  const points=[],skippedRows=[];
  for(const {row,index}of data){
   const rowNumber=index+(config.headerRow??0)+2,values={};let invalid=null;
   for(let j=0;j<columns.length;j++){try{values[columns[j].key]=number(row[indices[j]]);}catch{invalid={row:rowNumber,column:columns[j].label,value:String(row[indices[j]]).slice(0,200)};break;}}
   // Textual tags, Excel errors and other nonnumeric cells exclude the whole
   // sample. Preserve time spacing; never turn a bad reading into a zero.
   if(invalid){skippedRows.push(invalid);continue;}
   let time;try{time=Number(config.timeColumn)<0?start+Math.round(index*interval*1000):timestamp(row[Number(config.timeColumn)]);}catch{throw new Error('第'+rowNumber+'行时间无法识别。');}
   points.push({time,group:Number(config.groupColumn)>=0?String(row[Number(config.groupColumn)]??''):config.group??'',values});
  }
  if(!points.length)throw new Error('已剔除全部'+skippedRows.length+'行非数值样本，没有可导入的数据。请核对表头和所选变量列。');
  return {columns,points,selection:selection(undefined,points.length),importReport:{sourceRows:data.length,skippedRows}};
 }
 function response(current){return {version:1,revision:current.revision,datasets:entries(current)};}
 function nextTime(current,id){const previous=combined(current,id);return new Date(Math.max(Date.now(),previous?Date.parse(previous.updatedAt)+1:0)).toISOString();}
 async function request(req){
  const state=$r().state,current=normalize(state.analytics?.pcaData),params=new URL(req.url).searchParams;
  if(req.method==='GET'){
   if(params.has('id')){const local={...state,analytics:{...state.analytics,pcaData:current}},e=find(local,canonical(local,params.get('id')));if(!e)throw new Error('PCA独立数据已不存在。');return Response.json({dataset:e,revision:current.revision});}
   return Response.json({...response(current),datasets:entries(current).map(e=>({...e,points:undefined,count:e.points.length,selectedCount:selected(e).length}))});
  }
  if(req.method!=='PUT')throw new Error('PCA数据操作无效。');const input=await req.text();if(input.length>64*1024*1024)throw new Error('PCA导入内容过大，请减少变量或样本。');const body=JSON.parse(input);if(body.expectedRevision!==current.revision)throw new Error('PCA数据已更新，请刷新后重试。');
  let next={...current,revision:current.revision+1},importedUnit=null,deletedIds=null;
  if(['preview','import'].includes(body.action)){
   const unit=state.settings.units.find(u=>u.id===body.dataset?.unitId)||units([],state).find(u=>u.id===body.dataset?.unitId);if(!unit)throw new Error('请选择装置。');const now=nextTime(current,unit.id),incoming=normalize({version:1,revision:0,datasets:[{...body.dataset,id:'ds_pca_'+crypto.randomUUID(),unitName:unit.name,createdAt:now,updatedAt:now}]}).datasets[0],existing=combined(current,unit.id);
   if(existing?.needsReview)throw new Error('请先处理该装置已有批次的重叠样本。');
   const oldTimes=new Set(existing?.points.map(identity)??[]),overlaps=incoming.points.filter(p=>oldTimes.has(identity(p))).length;
   // Preview is read-only. No duplicate is resolved until the user chooses.
   const proposed=normalize({...current,datasets:[...current.datasets,incoming]}),merged=combined(proposed,unit.id),preview={unitId:unit.id,existingCount:existing?.points.length??0,incomingCount:incoming.points.length,overlaps,added:incoming.points.length-overlaps,total:merged.points.length,columns:merged.columns};
   if(body.action==='preview')return Response.json({revision:current.revision,preview});
   if(overlaps)incoming.conflictPolicy=policy(body.conflictPolicy);else if(body.conflictPolicy!==undefined)incoming.conflictPolicy=policy(body.conflictPolicy);
   next={...next,datasets:[...current.datasets,incoming]};
   if(incoming.conflictPolicy==='new'){const prior=(current.unitSelections??[]).find(e=>e.unitId===unit.id);if(prior){const decisions=new Map(prior.decisions.map(r=>[identity(r),r])),yes=new Set(selected(incoming).map(identity));for(const p of incoming.points)if(!yes.has(identity(p)))decisions.set(identity(p),{time:p.time,group:p.group,included:false});next.unitSelections=[...(current.unitSelections??[]).filter(e=>e.unitId!==unit.id),{unitId:unit.id,updatedAt:now,decisions:[...decisions.values()]}];}}
   importedUnit=unit.id;
  }else if(body.action==='select'){
   const e=combined(current,body.id?.slice('ds_pca_unit_'.length));if(!e||!isUnit(body.id))throw new Error('请在PCA模块选择装置数据。');if(e.needsReview)throw new Error('请先处理重叠样本。');const filter=selection(body.selection,e.points.length),yes=new Set(selected(e,filter).map(identity)),value={unitId:e.unitId,updatedAt:nextTime(current,e.unitId),decisions:e.points.map(p=>({time:p.time,group:p.group,included:yes.has(identity(p))}))};next.unitSelections=[...(current.unitSelections??[]).filter(v=>v.unitId!==e.unitId),value];
  }else if(body.action==='resolve'){
   const e=combined(current,body.unitId);if(!e)throw new Error('PCA装置数据不存在。');const value={unitId:e.unitId,batchIds:current.datasets.filter(b=>b.unitId===e.unitId).map(b=>b.id),policy:policy(body.conflictPolicy),updatedAt:nextTime(current,e.unitId)};next.resolutions=[...(current.resolutions??[]).filter(v=>v.unitId!==e.unitId),value];
  }else if(body.action==='delete'){
   if(!isUnit(body.id))throw new Error('请在PCA模块选择要删除的装置数据。');const id=body.id.slice('ds_pca_unit_'.length);if(!current.datasets.some(e=>e.unitId===id))throw new Error('PCA独立数据已不存在。');deletedIds=new Set([body.id,...current.datasets.filter(e=>e.unitId===id).map(e=>e.id)]);next.datasets=current.datasets.filter(e=>e.unitId!==id);next.unitSelections=(current.unitSelections??[]).filter(e=>e.unitId!==id);next.resolutions=(current.resolutions??[]).filter(e=>e.unitId!==id);
  }else throw new Error('PCA数据操作无效。');
  next=normalize(next);const analytics=DataAnalysis.normalize(state.analytics);qt().analytics={...analytics,pcaData:next,...deletedIds?{excludedPoints:analytics.excludedPoints.filter(p=>!deletedIds.has(p.sourceId)),exclusionRevision:analytics.exclusionRevision+1}:{}};return Response.json({...response(next),...importedUnit?{imported:combined(next,importedUnit)}:{}});
 }
 async function api(params={},body){const r=await T0('/api/pca-data'+(body?'':'?'+new URLSearchParams(params)),{method:body?'PUT':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
 return {owns,normalize,selection,selected,store,find,canonical,migrateExclusions,meta,series,units,workspace,list,sources,paste,parse,request,api,analysisPage};
})();
