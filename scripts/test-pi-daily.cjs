// Real account-local IndexedDB/import/formula pipeline, using synthetic PI samples.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{fixture}=require('./workbench-browser-fixture.cjs');
(async()=>{
 const f=await fixture(),p=f.page,dir=await fs.mkdtemp(path.join(os.tmpdir(),'pi-daily-'));
 const time=s=>Date.parse(s+'+08:00'),stamp=(date,hour='00:00:00')=>time(date+'T'+hour),columns=[{key:'c_1',label:'温度',unit:'℃'},{key:'c_2',label:'流量',unit:'kg/h'}];
 const raw=(date,hour,value,flow=1000)=>({time:stamp(date,hour),values:{c_1:value,c_2:flow}});
 async function sync(group,rows,daily,extra={}){
  const start=await f.api('/api/excel-sync','POST',{action:'begin',target:{unitId:'mmp2',source:'production',group,...daily?{daily}:{}},sourceId:'b'.repeat(64),filename:'PI.xlsx',sheet:'PI',columns,count:rows.length,...extra});
  await f.api('/api/excel-sync','POST',{action:'rows',id:start.id,offset:0,rows:rows.map(r=>({...r,unit:'mmp2',group}))});
  return f.api('/api/excel-sync','POST',{action:'commit',id:start.id});
 }
 const backup=()=>f.api('/api/offline/backup'),data=async()=> (await backup()).state.datasets.ds_unit_mmp2;
 const values=(entry,group,key)=>entry.points.filter(p=>p.group===group).sort((a,b)=>a.time-b.time).map(p=>p.values[key]);
 try{
  await p.goto(f.site);
  await sync('历史日报',[raw('2026-10-25','08:00:00',100),raw('2026-10-26','08:00:00',80)]);
  await sync('对照',[raw('2026-10-25','08:00:00',900)]);
  const before=await data(),req={id:'ds_unit_mmp2',action:'preview',label:'温度倍数',unit:'℃',source:'production',expression:'[生产｜历史日报｜温度]*2',group:'历史日报',percentageMode:'ratio',expectedUpdatedAt:before.dataset.updatedAt};
  const preview=await f.api('/api/calculations','POST',req),saved=await f.api('/api/calculations','POST',{...req,action:'save',referenceRevision:preview.referenceRevision}),key=saved.column.key,originalFormula=saved.column.formula;
  assert.equal(originalFormula.bindings['生产｜历史日报｜温度'].group,'历史日报');
  const daily={enabled:true,group:'PI日均值',overwrite:false},rows=[raw('2026-10-26','23:55:00',0),raw('2026-10-27','00:00:00',10),raw('2026-10-27','12:00:00',30),raw('2026-10-28','08:00:00',50)];
  const first=await sync('PI',rows,daily);assert.equal(first.daily.added,3);assert.equal(first.added,4);
  let entry=await data();assert.equal(entry.dataset.columns.length,3);assert.deepEqual(entry.dataset.columns.find(c=>c.key===key).formula,originalFormula);
  assert.deepEqual(values(entry,'PI','c_1'),[0,10,30,50]);assert.deepEqual(values(entry,'PI',key),[0,20,60,100]);assert.deepEqual(values(entry,'PI日均值','c_1'),[0,20,50]);assert.deepEqual(values(entry,'PI日均值',key),[0,40,100]);assert.deepEqual(values(entry,'历史日报','c_1'),[100,80]);
  const oldRevision=(await backup()).workspaceRevision,repeated=await sync('PI',rows,daily);assert.equal(repeated.changed,false);assert.equal((await backup()).workspaceRevision,oldRevision);
  await sync('PI',[raw('2026-10-27','12:00:00',50)],daily);entry=await data();assert.deepEqual(values(entry,'PI日均值','c_1'),[0,30,50]);assert.deepEqual(values(entry,'PI日均值',key),[0,60,100]);
  const historical={enabled:true,group:'历史日报',overwrite:false},merge=await sync('PI',[raw('2026-10-26','23:55:00',0),raw('2026-10-27','12:00:00',50)],historical);assert.equal(merge.daily.conflicts,1);entry=await data();assert.deepEqual(values(entry,'历史日报','c_1'),[100,80,30]);assert.equal(entry.points.find(r=>r.group==='历史日报'&&r.values.c_1===80).time,stamp('2026-10-26','08:00:00'));
  await sync('PI',[raw('2026-10-27','12:00:00',70)],historical);assert.deepEqual(values(await data(),'历史日报','c_1'),[100,80,40]);
  const manual=await backup();manual.state.datasets.ds_unit_mmp2.points.find(r=>r.group==='历史日报'&&r.time===stamp('2026-10-27')).values.c_1=999;await f.api('/api/offline/restore','POST',manual);
  const keep=await sync('PI',[raw('2026-10-27','12:00:00',90)],historical);assert.equal(keep.daily.conflicts,1);assert.deepEqual(values(await data(),'历史日报','c_1'),[100,80,999]);
  await sync('PI',[raw('2026-10-27','12:00:00',90)],{...historical,overwrite:true});assert.deepEqual(values(await data(),'历史日报','c_1'),[100,80,50]);
  // Compatible units refer to the same raw metric and recipe; conversion precedes averaging.
  await sync('PI',[raw('2026-10-27','12:00:00',90,2)],daily,{columns:[columns[0],{...columns[1],unit:'t/h'}]});entry=await data();assert.equal(entry.dataset.columns.length,3);assert.equal(entry.points.find(r=>r.group==='PI'&&r.time===stamp('2026-10-27','12:00:00')).values.c_2,2000);assert.equal(entry.points.find(r=>r.group==='PI日均值'&&r.time===stamp('2026-10-27')).values.c_2,1500);
  // A shared production recipe keeps its fixed LIMS sampling point while adapting production inputs.
  await sync('SP检验',[{time:stamp('2026-10-27'),values:{c_1:50}},{time:stamp('2026-10-27','12:00:00'),values:{c_1:60}}],undefined,{columns:[{key:'c_1',label:'含量',unit:'%'}],target:{unitId:'mmp2',source:'lims',group:'SP检验'}});
  entry=await data();const mixedReq={id:'ds_unit_mmp2',action:'preview',label:'有效流量',unit:'kg/h',source:'production',expression:'[生产｜历史日报｜流量]*[LIMS｜SP检验｜含量]',group:'历史日报',percentageMode:'ratio',matching:{timeline:'production',maxGapMinutes:1440,coverage:'all'},expectedUpdatedAt:entry.dataset.updatedAt};delete mixedReq.matching.coverage;const mixedPreview=await f.api('/api/calculations','POST',mixedReq),mixed=await f.api('/api/calculations','POST',{...mixedReq,action:'save',referenceRevision:mixedPreview.referenceRevision});entry=await data();assert.equal(mixed.column.formula.bindings['LIMS｜SP检验｜含量'].group,'SP检验');const mixedPoints=entry.points.filter(r=>r.group==='PI'&&r.time>=stamp('2026-10-27')&&r.time<stamp('2026-10-28'));assert.deepEqual(mixedPoints.map(r=>r.values[mixed.column.key]),[500,1200]);
  // Selecting a high-frequency group as the daily destination fails the whole cycle.
  const beforeBad=await backup();await assert.rejects(sync('PI',[raw('2026-10-27','13:00:00',999)],{enabled:true,group:'PI'}),/不同分组/);assert.deepEqual((await backup()).state.datasets,beforeBad.state.datasets);
  await sync('高频历史',[raw('2026-10-27','08:00:00',1),raw('2026-10-27','09:00:00',2)]);const beforeAmbiguous=await backup();await assert.rejects(sync('PI',[raw('2026-10-27','13:00:00',999)],{enabled:true,group:'高频历史'}),/同一天有多行/);assert.deepEqual((await backup()).state.datasets,beforeAmbiguous.state.datasets);
  const dailyView=await f.api('/api/excel-sync?target='+encodeURIComponent(JSON.stringify({unitId:'mmp2',group:'高频历史',daily})));assert.equal(dailyView.table.rows[0].rawGroup,'PI');assert.equal(dailyView.table.rows[0].samples,1);
  const complete=await backup();await f.api('/api/offline/restore','POST',complete);assert.deepEqual((await backup()).state.excelSync.dailyRows,complete.state.excelSync.dailyRows);
  await f.nav('Excel自动同步');await p.getByLabel('Excel同步采样分组',{exact:true}).fill('PI');await p.getByLabel('PI日均汇总',{exact:true}).selectOption('yes');await p.getByLabel('日均值汇总分组',{exact:true}).fill('PI日均值');await p.getByRole('table',{name:'PI日均值汇总表',exact:true}).waitFor();await p.screenshot({path:path.join(dir,'daily-table.png'),fullPage:true});await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(f.errors,[]);
  console.log(JSON.stringify({passed:true,artifacts:dir,checks:['One saved group-qualified recipe computes independently for history, live PI and daily means; no duplicated columns','Beijing midnight boundary, zeros, daily means, no duplicate polling weight, retained rolling history','Existing daily row timestamps retained; conflicts preserved; own provisional rows update; manual changes protected; optional replacement','Compatible units convert before aggregation; invalid destinations roll back atomically; source ownership survives backup','Daily summary table renders and fits mobile']},null,2));
 }catch(e){await p.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});console.error('Artifacts',dir);throw e;}finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
