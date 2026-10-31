const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{fixture}=require('./workbench-browser-fixture.cjs');
(async()=>{const f=await fixture(),p=f.page,dir=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-device-memory-'));try{
 await p.clock.setFixedTime(new Date('2026-10-31T07:45:00Z'));await p.goto(f.site);const backup=await f.api('/api/offline/backup');
 backup.state.settings.units=[{...backup.state.settings.units[0],name:'装置A'},{...backup.state.settings.units[0],id:'b',name:'装置B'}];
 const col={key:'c_1',index:1,header:'温度',label:'温度',unit:'℃',source:'production',module:'other',kind:'reading',aggregation:'mean',recognized:true,enabled:true,scale:1,limit:null,showTotal:false};
 const make=(unit,value)=>{const points=['2026-08-10','2026-09-10','2026-10-10'].map(date=>({unit,group:'历史日报',time:Date.parse(date+'T08:00:00+08:00'),values:{c_1:value}}));return {dataset:{id:'ds_unit_'+unit,name:unit+'指标',filename:'fixture.csv',sheet:'data',columns:[col],count:3,expectedCount:3,unitIds:[unit],groups:['历史日报'],start:points[0].time,end:points.at(-1).time,createdAt:'2026-10-01T00:00:00Z',status:'ready',role:'ledger'},points};};
 backup.state.datasets={ds_unit_mmp2:make('mmp2',10),ds_unit_b:make('b',20)};backup.state.view={...backup.state.view,unitId:'mmp2',sourceId:'ds_unit_mmp2'};await f.api('/api/offline/restore','POST',backup);await p.reload();await f.nav('运行总览');await p.locator('.shared-range-heading').waitFor();
 await p.evaluate(()=>{const original=window.fetch;window.__seriesRequests=[];window.fetch=(url,options)=>{if(String(url).startsWith('/api/series?id='))window.__seriesRequests.push(String(url));return original(url,options);};});
 const month=async value=>{await p.getByRole('button',{name:'范围月份',exact:true}).click();await p.getByRole('textbox',{name:'范围月份直接输入',exact:true}).fill(value);await p.getByRole('dialog',{name:'范围月份日历',exact:true}).getByRole('button',{name:'确定',exact:true}).click();};
 const selected=async value=>assert.equal((await p.getByRole('button',{name:'范围月份',exact:true}).innerText()).trim(),value);
 await month('2026-09');await f.api('/api/offline/backup');
 await p.getByLabel('选择装置',{exact:true}).selectOption('b');await p.locator('.shared-range-heading').waitFor();await month('2026-08');await f.api('/api/offline/backup');
 const requests=await p.evaluate(()=>window.__seriesRequests.length);assert.equal(requests,1,'The first visit to B loads its readings once');
 await p.getByLabel('选择装置',{exact:true}).selectOption('mmp2');await selected('2026-09');await p.locator('.shared-range-heading').waitFor();assert((await p.locator('.metrics-panel tbody').innerText()).includes('10.000'));
 await p.getByLabel('选择装置',{exact:true}).selectOption('b');await selected('2026-08');await p.locator('.shared-range-heading').waitFor();assert.equal(await p.evaluate(()=>window.__seriesRequests.length),requests,'Returning to either unchanged device must not reread its full series');
 await p.getByLabel('选择装置',{exact:true}).selectOption('mmp2');await selected('2026-09');await f.api('/api/offline/backup');
 const updated=await f.api('/api/offline/backup');updated.state.datasets.ds_unit_mmp2.points[1].values.c_1=30;
 await f.api('/api/offline/restore','POST',updated);await p.waitForFunction(()=>document.querySelector('.metrics-panel tbody')?.textContent.includes('30.000'));await selected('2026-09');
 assert((await p.evaluate(()=>window.__seriesRequests.length))>requests,'A restore with unchanged row counts/timestamps still invalidates cached readings');
 await p.getByLabel('选择装置',{exact:true}).selectOption('b');await p.locator('.shared-range-heading').waitFor();await p.getByLabel('选择装置',{exact:true}).selectOption('mmp2');await p.locator('.shared-range-heading').waitFor();await selected('2026-09');assert((await p.locator('.metrics-panel tbody').innerText()).includes('30.000'));
 // Another tab updates the same account; a cached view must not hide its changes.
 await f.api('/api/offline/backup');const other=await f.context.newPage();other.on('pageerror',e=>f.errors.push(e.message));await other.goto(f.site);await other.getByLabel('共享数据源',{exact:true}).waitFor();
 await other.evaluate(async()=>{await fetch('/api/offline/backup');});
 await other.evaluate(async()=>{const old=await(await fetch('/api/offline/backup')).json();old.state.datasets.ds_unit_mmp2.points[1].values.c_1=40;const r=await fetch('/api/offline/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(old)});if(!r.ok)throw new Error(await r.text());});
 await p.waitForFunction(()=>document.querySelector('.metrics-panel tbody')?.textContent.includes('40.000'));await selected('2026-09');await other.close();
 const analytics=await f.api('/api/analytics'),point={sourceId:'ds_unit_mmp2',unit:'mmp2',time:updated.state.datasets.ds_unit_mmp2.points[1].time,group:'历史日报',key:'c_1',value:40};
 await f.api('/api/analytics','PUT',{action:'exclude-points',expectedExclusionRevision:analytics.exclusionRevision,points:[point]});
 await p.waitForFunction(()=>document.querySelector('.metrics-panel tbody')?.textContent.includes('0 / 1'));await selected('2026-09');
 const exclusions=await f.api('/api/analytics');await f.api('/api/analytics','PUT',{action:'restore-points',expectedExclusionRevision:exclusions.exclusionRevision,points:[point]});await p.waitForFunction(()=>document.querySelector('.metrics-panel tbody')?.textContent.includes('40.000'));
 const final=await f.api('/api/offline/backup');assert.equal(final.state.datasets.ds_unit_b.points[0].values.c_1,20);assert.equal(final.state.datasets.ds_unit_mmp2.points.length,3);await p.screenshot({path:path.join(dir,'remembered-september.png'),fullPage:true});
 assert.deepEqual(f.errors,[]);console.log(JSON.stringify({passed:true,artifacts:dir,checks:['Each device restores its independently chosen month without repeating full-series reads','Same-size data restores invalidate caches while preserving the selected range','Updates from another tab invalidate the same-account view without replacing its filters','Exclusions and undo invalidate displayed statistics while original points and the other device remain intact']},null,2));
 }catch(e){await p.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});console.error('Artifacts',dir);console.error('Browser errors',f.errors);throw e;}finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
