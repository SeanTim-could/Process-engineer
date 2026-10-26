// Run with Node.js and Playwright installed. All data stays in isolated browser contexts.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const nativeFs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.WORKBENCH_TEST_ARTIFACTS??path.join(os.tmpdir(),'process-engineer-inspect');
const site='https://seantim-could.github.io/Process-engineer/workbench.html';
const stamp=s=>Date.parse('2026-10-01T'+s+':00+08:00');
const ref=s=>'['+s.replace(/]/g,']]')+']';
const report=[];
async function api(page,url,method='GET',body,ok=true){
 const result=await page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {ok:r.ok,status:r.status,data:await r.json()}},{url,method,body});
 if(ok)assert(result.ok,JSON.stringify(result));else assert(!result.ok,JSON.stringify(result));
 return result.data;
}
const backup=p=>api(p,'/api/offline/backup');
const dataset=(p,id='ds_unit_mmp2')=>api(p,'/api/series?id='+id);
const column=(key,label,unit,source='production')=>({key,index:Number(key.slice(2)),header:label,label,unit,source,module:'other',kind:'reading',aggregation:'auto',recognized:true,enabled:true,scale:1,limit:null,maxGapHours:null,showTotal:true});
function ledger(id,unit,columns,points){const times=points.map(p=>p.time);return {dataset:{id,name:unit+' · 指标历史',filename:'synthetic-fixture.csv',sheet:'全部月份',columns,count:points.length,expectedCount:points.length,unitIds:[unit],groups:[...new Set(points.map(p=>p.group))].sort(),start:Math.min(...times),end:Math.max(...times),createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z',status:'ready',role:'ledger'},points};}
async function fixture(p){
 const b=await backup(p),unit=b.state.settings.units[0];
 b.state.settings.units=[{...unit,name:'装置A'},{...unit,id:'b',name:'装置B]检验'},{...unit,id:'c',name:'装置C'}];
 const A=Array.from({length:6},(_,i)=>({unit:'mmp2',time:stamp(String(8+i).padStart(2,'0')+':00'),group:'P',values:{c_1:(i+1)*100}}));
 const B=[2,null,0,4].map((v,i)=>({unit:'b',time:stamp(String(8+i).padStart(2,'0')+':05'),group:'B生产',values:{c_1:v}}));
 B.push(...[50,75,100].map((v,i)=>({unit:'b',time:stamp(String(8+i*2).padStart(2,'0')+':15'),group:'SP 955',values:{c_2:v}})));
 B.push(...[99,99,99].map((v,i)=>({unit:'b',time:stamp(String(8+i*2).padStart(2,'0')+':00'),group:'另一个采样点',values:{c_2:v}})));
 B.push(...[10,20].map((v,i)=>({unit:'b',time:stamp(String(8+i).padStart(2,'0')+':30'),group:'B温度',values:{c_3:v}})));
 const C=A.map(p=>({...p,unit:'c',values:{c_1:9000}}));
 const otherGroup=A.map(p=>({...p,group:'另一个生产分组',values:{c_1:9999}}));
 b.state.datasets={ds_unit_mmp2:ledger('ds_unit_mmp2','mmp2',[column('c_1','流量','kg/h')],[...A,...otherGroup]),ds_unit_b:ledger('ds_unit_b','b',[column('c_1','流量','t/h'),column('c_2','含量','%','lims'),column('c_3','温度','℃')],B),ds_unit_c:ledger('ds_unit_c','c',[column('c_1','流量','kg/h')],C)};
 b.state.view={...b.state.view,sourceId:'ds_unit_mmp2',unitId:'mmp2',group:'P',from:'2026-10-01 08:00',to:'2026-10-01 13:00'};
 await api(p,'/api/offline/restore','POST',b);
}
async function request(p,options={}){
 const id=options.id??'ds_unit_mmp2',d=await dataset(p,id);
 return {id,action:'preview',label:'跨装置合计',unit:'kg/h',expression:'',source:'production',percentageMode:'ratio',matching:{timeline:'production',maxGapMinutes:10,coverage:'overlap'},unitId:d.dataset.unitIds[0],from:'2026-10-01 08:00',to:'2026-10-01 13:00',group:'P',expectedUpdatedAt:d.dataset.updatedAt??d.dataset.createdAt,...options};
}
async function save(p,options){
 const req=await request(p,options),preview=await api(p,'/api/calculations','POST',req);
 const result=await api(p,'/api/calculations','POST',{...req,action:'save',referenceRevision:preview.referenceRevision});
 return {req,preview,result};
}
const values=(d,key,group='P')=>d.points.filter(p=>p.group===group&&Object.hasOwn(p.values,key)).map(p=>p.values[key]);
(async()=>{
 await fs.mkdir(artifacts,{recursive:true});
 const executable=process.env.CHROMIUM_PATH??(nativeFs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath());
 const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  // Calculation fixtures exercise an isolated workspace without contacting the
  // deployed account project. The complete login flow has its own browser suite.
  const html=execFileSync('python',['-c',"import importlib.util,pathlib,sys; p=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('auth_sync',p/'scripts/sync-account-auth.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);sys.stdout.buffer.write(m.render((p/'启动工程师工作台.html').read_text(),{'enabled':False,'url':'','publicKey':''}).encode('utf-8'))",root],{maxBuffer:8*1024*1024});
  await context.route('https://seantim-could.github.io/Process-engineer/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(site);await fixture(p);
  const legacy=await save(p,{label:'原有本装置公式',expression:ref('流量')+' * 2'});
  assert.deepEqual(values(await dataset(p),legacy.result.column.key),[200,400,600,800,1000,1200]);
  report.push('Existing same-device formulas retain their original calculation behavior.');
  let sources=await api(p,'/api/calculations?id=ds_unit_mmp2');
  const bFlow=sources.references.find(r=>r.unitId==='b'&&r.key==='c_1');
  const bLims=sources.references.find(r=>r.unitId==='b'&&r.key==='c_2'&&r.group==='SP 955');
  const bTemp=sources.references.find(r=>r.unitId==='b'&&r.key==='c_3');
  assert(bFlow&&bLims&&bTemp);assert.equal(sources.units.length,3);
  const first=await save(p,{expression:ref('流量')+' + '+ref(bFlow.name)+' * 1000'}),key=first.result.column.key;
  assert.deepEqual(values(await dataset(p),key),[2100,null,300,4400,null,null]);
  const match=first.preview.points[0].calculationMatches[key][bFlow.name];assert.equal(match.unitId,'b');assert.equal(match.deltaMinutes,5);
  assert.equal(first.preview.points[1].calculationIssues[key].kind,'missing');
  report.push('Device-qualified references avoid colliding metric keys; explicit t/h-to-kg/h conversion is applied; zero stays valid; null and excessive time gaps remain missing.');
  const tie=await save(p,{label:'最近时间平局',unit:'℃',expression:ref(bTemp.name),matching:{timeline:'production',maxGapMinutes:30,coverage:'overlap'}});
  assert.equal(tie.preview.points.find(p=>p.time===stamp('09:00')).values[tie.result.column.key],10);
  const local=await save(p,{label:'本装置后续计算',expression:ref('跨装置合计')+' * 2'});
  assert.deepEqual(values(await dataset(p),local.result.column.key),[4200,null,600,8800,null,null]);
  const lims=await save(p,{label:'跨装置含量折算',expression:ref('流量')+' * '+ref(bLims.name),matching:{timeline:'lims',maxGapMinutes:20,coverage:'overlap',anchor:{key:bLims.key,group:bLims.group,datasetId:bLims.datasetId,unitId:bLims.unitId}}});
  assert.deepEqual(values(await dataset(p),lims.result.column.key),[50,225,500]);
  assert.deepEqual(lims.preview.points.map(p=>p.time),[stamp('08:15'),stamp('10:15'),stamp('12:15')]);
  assert.equal(lims.preview.coverage[0].primary,bLims.name);
  const limsFollow=await save(p,{label:'本装置LIMS后续',expression:ref('跨装置含量折算')+' * 2',matching:{timeline:'lims',maxGapMinutes:20,coverage:'overlap'}});
  assert.deepEqual(values(await dataset(p),limsFollow.result.column.key),[100,450,1000]);
  report.push('Nearest-time ties prefer the earlier record; local formulas can depend on cross-device results; remote LIMS anchors preserve their sampling points and percentage conversion.');
  // Remote updates are performed through the actual import/merge API.
  const remoteBefore=await dataset(p,'ds_unit_b');
  const rawColumns=remoteBefore.dataset.columns.filter(c=>!c.formula);
  const start=await api(p,'/api/series','POST',{action:'start',name:'追加B流量',filename:'new-b.csv',sheet:'data',columns:rawColumns,count:1});
  await api(p,'/api/series','POST',{action:'points',id:start.dataset.id,points:[{unit:'b',time:stamp('12:05'),group:'B生产',values:{c_1:5}}]});
  const review=await api(p,'/api/series','POST',{action:'review',ids:[start.dataset.id]});
  await api(p,'/api/series','POST',{action:'commit',ids:[start.dataset.id],token:review.review.token,policy:'new'});
  assert.deepEqual(values(await dataset(p),key),[2100,null,300,4400,5500,null]);
  assert.deepEqual(values(await dataset(p),local.result.column.key),[4200,null,600,8800,11000,null]);
  report.push('Importing data into the referenced device automatically recalculates destination formulas and their downstream calculations.');
  const changedUnits=await dataset(p,'ds_unit_b');
  await api(p,'/api/series','PATCH',{id:'ds_unit_b',columns:changedUnits.dataset.columns.map(c=>c.key==='c_1'?{...c,unit:'kg/h'}:c),expectedUpdatedAt:changedUnits.dataset.updatedAt});
  assert.deepEqual(values(await dataset(p),key),[2100,null,300,4400,5500,null]);
  report.push('Changing a source to a compatible display unit preserves the formula\'s saved reference units and numerical meaning.');
  // A source update between preview/save must invalidate that preview.
  const staleReq=await request(p,{label:'过期预览',expression:ref(bFlow.name)});
  const stale=await api(p,'/api/calculations','POST',staleReq);
  const settings=(await backup(p)).state.settings;settings.units.find(u=>u.id==='b').name='B重命名';
  await api(p,'/api/settings','PUT',settings);
  const rejection=await api(p,'/api/calculations','POST',{...staleReq,action:'save',referenceRevision:stale.referenceRevision},false);
  assert.match(rejection.error,/重新预览/);
  const edited=await save(p,{key,label:'跨装置合计',expression:first.req.expression});
  assert.equal(edited.result.column.formula.bindings[bFlow.name].datasetId,'ds_unit_b');
  report.push('Renaming a source device preserves existing bindings; source changes between preview/save require a new preview.');
  // Cross-device calculated references form a global DAG, not a per-device key graph.
  const cSources=await api(p,'/api/calculations?id=ds_unit_c');
  const aComputed=cSources.references.find(r=>r.datasetId==='ds_unit_mmp2'&&r.key===key);
  const chain=await save(p,{id:'ds_unit_c',label:'跨装置计算链',expression:ref(aComputed.name)+' * 3'});
  assert.deepEqual(values(await dataset(p,'ds_unit_c'),chain.result.column.key),[6300,null,900,13200,16500,null]);
  sources=await api(p,'/api/calculations?id=ds_unit_mmp2');
  const cComputed=sources.references.find(r=>r.datasetId==='ds_unit_c'&&r.key===chain.result.column.key);
  const cyclic=await request(p,{key,label:'跨装置合计',expression:ref(cComputed.name)});
  const beforeCycle=await backup(p);
  assert.match((await api(p,'/api/calculations','POST',cyclic,false)).error,/循环引用/);
  assert.deepEqual((await backup(p)).state.datasets,beforeCycle.state.datasets);
  report.push('Calculated references work across three devices; cross-device cycles are rejected without modifying saved data.');
  // Backup/restore in a second browser must retain source IDs and recompute equally.
  const complete=await backup(p),secondContext=await browser.newContext();
  await secondContext.route('https://seantim-could.github.io/Process-engineer/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  const second=await secondContext.newPage();await second.goto(site);
  assert.equal(Object.keys((await backup(second)).state.datasets).length,0);
  await api(second,'/api/offline/restore','POST',complete);
  assert.deepEqual(values(await dataset(second),key),values(await dataset(p),key));
  assert.deepEqual((await dataset(second)).dataset.columns.find(c=>c.key===key).formula,edited.result.column.formula);
  await secondContext.close();
  report.push('Complete backup/restore preserves cross-device formula identities and computed results.');
  // Actual editor flow: choose a remote device, insert a metric, preview and save.
  await p.reload();await p.getByRole('button',{name:'数据中心',exact:true}).click();
  await p.getByRole('button',{name:'编辑公式跨装置含量折算',exact:true}).click();
  const anchorChooser=p.getByRole('combobox',{name:'公式主LIMS时间轴',exact:true});
  await anchorChooser.locator('option').filter({hasText:'B重命名'}).waitFor({state:'attached'});
  const selectedAnchor=JSON.parse(await anchorChooser.inputValue());
  assert.equal(selectedAnchor.datasetId,'ds_unit_b');assert.equal(selectedAnchor.group,'SP 955');
  await p.getByRole('button',{name:'取消',exact:true}).click();
  await p.getByRole('button',{name:'新增计算指标',exact:true}).click();
  const chooser=p.getByRole('combobox',{name:'公式引用装置',exact:true});await chooser.waitFor();await chooser.selectOption('b');
  await p.getByRole('combobox',{name:'公式引用数据分组',exact:true}).selectOption('production');
  await p.getByRole('combobox',{name:'公式引用采样点',exact:true}).selectOption('B生产');
  await p.getByRole('textbox',{name:'计算指标显示名称',exact:true}).fill('界面跨装置测试');
  await p.getByRole('combobox',{name:'计算指标输出单位',exact:true}).selectOption('kg/h');
  const referenceButton=p.locator('.formula-reference').filter({hasText:'B重命名（b）｜生产｜B生产｜流量'});await referenceButton.click();
  assert((await p.getByRole('textbox',{name:'计算公式',exact:true}).inputValue()).includes('B重命名（b）'));
  await p.getByRole('combobox',{name:'公式时间匹配基准',exact:true}).selectOption('production');
  await p.getByRole('spinbutton',{name:'公式最大匹配时间差',exact:true}).fill('10');
  await p.getByRole('button',{name:'预览计算',exact:true}).click();await p.locator('.formula-preview').waitFor();
  assert((await p.locator('.formula-preview').innerText()).includes('装置 b'));
  await p.screenshot({path:path.join(artifacts,'cross-unit-editor.png'),fullPage:true});
  await p.getByRole('button',{name:'保存并生成计算列',exact:true}).click();await p.getByRole('textbox',{name:'计算公式',exact:true}).waitFor({state:'detached'});
  const uiResult=(await dataset(p)).dataset.columns.find(c=>c.label==='界面跨装置测试');assert(uiResult.formula.bindings);
  report.push('The real Data Center editor can choose another device, insert its metric, preview matching device/time, and save the result into the current device.');
  await p.getByRole('button',{name:'新增计算指标',exact:true}).click();
  await p.setViewportSize({width:390,height:844});await p.getByRole('combobox',{name:'公式引用装置',exact:true}).selectOption('b');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.getByRole('button',{name:'取消',exact:true}).click();
  const archiveSettings=(await backup(p)).state.settings;
  archiveSettings.units.find(u=>u.id==='b').archived=true;
  await api(p,'/api/settings','PUT',archiveSettings);
  assert(values(await dataset(p),key).every(v=>v===null));
  archiveSettings.units.find(u=>u.id==='b').archived=false;
  await api(p,'/api/settings','PUT',archiveSettings);
  assert.deepEqual(values(await dataset(p),key),[2100,null,300,4400,5500,null]);
  // Deletion must never fall back to another device's identically numbered column.
  await api(p,'/api/series','DELETE',{id:'ds_unit_b'});
  assert(values(await dataset(p),key).every(v=>v===null));
  assert(values(await dataset(p,'ds_unit_c'),chain.result.column.key).every(v=>v===null));
  assert.equal((await api(p,'/api/calculations?id=ds_unit_mmp2')).references.some(r=>r.unitId==='b'),false);
  report.push('Mobile device selection fits the viewport; removing a referenced dataset produces missing values rather than reading a same-numbered local metric.');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:report,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
