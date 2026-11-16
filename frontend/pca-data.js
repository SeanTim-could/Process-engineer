// PCA measurements have their own workspace collection. Analysis adapters below
// expose read-only copies; production/LIMS imports never write this collection.
var PCAData=(()=>{
 const owns=id=>typeof id==='string'&&/^ds_pca_[\w-]{1,100}$/.test(id),finite=Number.isFinite;
 const str=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw new Error(label+'格式无效。');return v;};
 function selection(value,length){
  if(!Number.isInteger(length)||length<1||length>20000)throw new Error('PCA样本数量无效。');
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
  if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.datasets)||value.datasets.length>20)throw new Error('PCA独立数据仓库无效，最多20份数据。');
  const ids=new Set();let total=0;
  const datasets=value.datasets.map(e=>{
   if(!e||!owns(e.id)||ids.has(e.id)||!/^[-\w]{1,40}$/.test(e.unitId)||!Array.isArray(e.columns)||e.columns.length<2||e.columns.length>80||!Array.isArray(e.points)||!e.points.length||e.points.length>20000||!finite(Date.parse(e.createdAt))||!finite(Date.parse(e.updatedAt)))throw new Error('PCA独立数据格式无效，每份需要2至80个变量、1至20000个样本。');ids.add(e.id);total+=e.points.length;
   const keys=new Set(),columns=e.columns.map(c=>{if(!c||!/^\w{1,100}$/.test(c.key)||keys.has(c.key))throw new Error('PCA变量编号重复或无效。');keys.add(c.key);return {key:c.key,label:str(c.label,200,'变量名称'),unit:str(c.unit??'',100,'变量单位')};});
   const seen=new Set(),points=e.points.map(p=>{if(!p||!Number.isSafeInteger(p.time)||Math.abs(p.time)>8640000000000000||typeof p.group!=='string'||p.group.length>100||!p.values||Array.isArray(p.values)||Object.keys(p.values).some(k=>!keys.has(k)))throw new Error('PCA采样记录无效。');const identity=JSON.stringify([p.time,p.group]);if(seen.has(identity))throw new Error('PCA数据存在同一分组、同一时间的重复样本，请先核对。');seen.add(identity);return {unit:e.unitId,time:p.time,group:p.group,values:Object.fromEntries(columns.map(c=>{const v=p.values[c.key]??null;if(v!==null&&!finite(v))throw new Error('PCA变量必须为数值或空白。');return [c.key,v];}))};});
   return {id:e.id,name:str(e.name,120,'数据名称'),filename:str(e.filename,200,'文件名'),sheet:str(e.sheet,100,'工作表'),unitId:e.unitId,unitName:str(e.unitName,120,'装置名称'),columns,points,selection:selection(e.selection,points.length),...(e.importReport===undefined?{}:{importReport:importReport(e.importReport,points.length)}),createdAt:e.createdAt,updatedAt:e.updatedAt};
  });if(total>100000)throw new Error('PCA数据仓库最多10万个原始样本。');return {version:1,revision:value.revision,datasets};
 }
 const store=state=>state.analytics?.pcaData??{version:1,revision:0,datasets:[]};
 const find=(state,id)=>store(state).datasets.find(e=>e.id===id);
 function selected(e,filter=e.selection){const excluded=new Set(filter.excluded);return e.points.filter((p,i)=>i>=filter.from&&i<=filter.to&&!excluded.has(i));}
 function meta(e){const rows=selected(e),times=rows.map(p=>p.time);return {id:e.id,name:'PCA独立 · '+e.name,filename:e.filename,sheet:e.sheet,origin:'pca',role:'ledger',scope:'pca',status:'ready',unitIds:[e.unitId],groups:[...new Set(rows.map(p=>p.group))],count:rows.length,expectedCount:rows.length,start:times.length?Math.min(...times):e.points[0].time,end:times.length?Math.max(...times):e.points.at(-1).time,createdAt:e.createdAt,updatedAt:e.updatedAt,columns:e.columns.map((c,i)=>({...c,index:i+1,header:c.label+(c.unit?' ('+c.unit+')':''),source:'production',module:'custom:PCA独立数据',kind:'reading',aggregation:'mean',enabled:true,recognized:true,scale:1,limit:null,showTotal:false}))};}
 function series(state,id,{raw=false}={}){const e=find(state,id);if(!e)throw new Error('PCA独立数据已不存在，请重新选择。');return {dataset:meta(e),points:structuredClone(raw?e.points:selected(e))};}
 function units(items=[],state=$r().state){const result=items.map(u=>({...u}));for(const e of store(state).datasets){const index=result.findIndex(u=>u.id===e.unitId);if(index<0)result.push({id:e.unitId,name:e.unitName,archived:false});else if(result[index].archived)result[index]={...result[index],archived:false};}return result;}
 const analysisPage=page=>['pca','timeseries','capability','plotting','charts','analysis','comparison'].includes(page);
 function workspace(value,page){return analysisPage(page)?{...value,units:units(value.units),datasets:[...value.datasets,...store($r().state).datasets.map(meta)]}:value;}
 function list(value){return analysisPage(Surface.currentPage())?[...value,...store($r().state).datasets.map(meta)]:value;}
 function sources(state){return store(state).datasets.map(e=>{const view=meta(e);return {id:e.id,name:'PCA独立 · '+e.unitName+' · '+e.name,unitId:e.unitId,unitName:e.unitName,columns:e.columns,groups:view.groups,start:view.start,end:view.end,updatedAt:e.updatedAt,origin:'pca'};});}
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
 async function request(req){
  const state=$r().state,current=normalize(state.analytics?.pcaData),params=new URL(req.url).searchParams;
  if(req.method==='GET'){const e=params.has('id')?current.datasets.find(e=>e.id===params.get('id')):null;if(params.has('id')&&!e)throw new Error('PCA独立数据已不存在。');return Response.json(e?{dataset:e,revision:current.revision}:{...current,datasets:current.datasets.map(e=>({...e,points:undefined,count:e.points.length,selectedCount:selected(e).length}))});}
  if(req.method!=='PUT')throw new Error('PCA数据操作无效。');const input=await req.text();if(input.length>64*1024*1024)throw new Error('PCA导入内容过大，请减少变量或样本。');const body=JSON.parse(input);if(body.expectedRevision!==current.revision)throw new Error('PCA数据已更新，请刷新后重试。');let datasets=[...current.datasets];
  if(body.action==='import'){const now=new Date().toISOString(),unit=state.settings.units.find(u=>u.id===body.dataset?.unitId)||units([],state).find(u=>u.id===body.dataset?.unitId);if(!unit)throw new Error('请选择装置。');datasets.push({...body.dataset,id:'ds_pca_'+crypto.randomUUID(),unitName:unit.name,createdAt:now,updatedAt:now});}
  else if(body.action==='select'){const i=datasets.findIndex(e=>e.id===body.id);if(i<0)throw new Error('PCA独立数据已不存在。');const e=datasets[i],next=selection(body.selection,e.points.length);datasets[i]={...e,selection:next,updatedAt:new Date().toISOString()};}
  else if(body.action==='delete'){if(!datasets.some(e=>e.id===body.id))throw new Error('PCA独立数据已不存在。');datasets=datasets.filter(e=>e.id!==body.id);}
  else throw new Error('PCA数据操作无效。');const next=normalize({version:1,revision:current.revision+1,datasets});qt().analytics={...DataAnalysis.normalize(state.analytics),pcaData:next};return Response.json(next);
 }
 async function api(params={},body){const r=await T0('/api/pca-data'+(body?'':'?'+new URLSearchParams(params)),{method:body?'PUT':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
 return {owns,normalize,selection,selected,store,find,meta,series,units,workspace,list,sources,paste,parse,request,api,analysisPage};
})();
