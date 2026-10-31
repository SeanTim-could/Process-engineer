// Exercise the generated website, including its compressed and lazy resources.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),site='https://seantim-could.github.io/Process-engineer/';
async function api(p,url){return p.evaluate(async url=>{const r=await fetch(url);if(!r.ok)throw new Error(await r.text());return r.json();},url);}
async function importFile(p,name,buffer,count){
 await p.getByRole('button',{name:'导入数据',exact:true}).click();
 await p.locator('input[accept=".xlsx,.xls,.csv"]').setInputFiles({name,mimeType:name.endsWith('.csv')?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
 await p.getByRole('button',{name:`导入并生成图表（${count}点）`,exact:true}).click();await p.locator('input[accept=".xlsx,.xls,.csv"]').waitFor({state:'detached'});
}
(async()=>{
 const config=JSON.parse(await fs.readFile(path.join(root,'frontend/auth-config.json'),'utf8')),files=new Map();
 for(const name of ['index.html','workbench.html','workbench-compatible.html',...(await fs.readdir(path.join(root,'assets'))).map(n=>'assets/'+n)])files.set(name,await fs.readFile(path.join(root,name)));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']}),errors=[],checks=[];
 const contexts=[];
 async function open(mode='compressed'){
  const context=await browser.newContext({viewport:{width:1400,height:950}});contexts.push(context);const requested=[];let failSpreadsheet=mode==='lazy-retry',firstRaw=true;const attempted=new Set();
  await context.addInitScript(({key,mode})=>{
   sessionStorage.setItem(key,JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600}));
   if(['legacy','raw-retry'].includes(mode))Object.defineProperty(window,'DecompressionStream',{value:undefined});
  },{key:'workbench-auth:'+config.url,mode});
  await context.route(site+'**',async route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace('/Process-engineer/','');requested.push(relative);
   if(mode==='all-assets-blocked'&&relative.startsWith('assets/'))return route.abort('failed');
   if(mode==='cached404'&&relative.endsWith('.gz')&&!attempted.has(relative)){attempted.add(relative);return route.fulfill({status:404,body:'Cached missing resource'});}
   if(mode==='raw-retry'&&relative.endsWith('.js')&&firstRaw){firstRaw=false;return route.abort('failed');}
   if(mode==='blob-blocked'&&relative.endsWith('.js'))return route.abort('failed');
   if(relative.startsWith('assets/spreadsheet.')&&failSpreadsheet){failSpreadsheet=false;return route.abort('failed');}
   if(relative.endsWith('.gz')&&mode==='corrupt')return route.fulfill({contentType:'application/gzip',body:'corrupt fixture'});
   if(relative.endsWith('.gz')&&mode==='unpacked')return route.fulfill({contentType:'application/gzip',body:files.get(relative.slice(0,-3))});
   const body=files.get(relative);if(!body)return route.fulfill({status:404,body:'Not found'});
   return route.fulfill({body,headers:mode==='blob-blocked'?{'Content-Security-Policy':"script-src 'self' 'unsafe-inline'"}:{},contentType:relative.endsWith('.webp')?'image/webp':relative.endsWith('.gz')?'application/gzip':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html; charset=utf-8'});
  });
  await context.route(config.url+'/**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':new URL(site).origin},body:JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',display_name:'下载测试员',employee_id:'download',role:'staff',active:true,must_change_password:false}])}));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(site+'workbench.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('下载测试员'));
  return {p,requested};
 }
 try{
  const {p,requested}=await open();
  assert.equal(requested.filter(s=>s.endsWith('.gz')).length,2);
  const core=await p.evaluate(()=>window.WorkbenchAssets.script.url);assert(!files.get(core.replace('./','')).includes(Buffer.from('var xN={};Ui(xN,')),'The initial bundle actually excludes the workbook engine');assert(!requested.some(s=>s.endsWith('.js')||s.endsWith('.css')),'normal startup only needs the two compressed resources');
  await p.getByRole('button',{name:'数据分析',exact:true}).click();await p.getByRole('button',{name:'自动图表',exact:true}).click();
  await importFile(p,'first.csv',Buffer.from('\ufeff时间,收率(%)\n2026-10-01 08:00,98.5'),1);
  assert(!requested.some(s=>s.startsWith('assets/spreadsheet.')),'CSV import does not download the workbook engine');
  let saved=(await api(p,'/api/offline/backup')).state.datasets.ds_unit_mmp2;assert.equal(saved.points.length,1);
  const template=await p.evaluate(async()=>{const r=await fetch('/api/series/template?unit=mmp2');if(!r.ok)throw new Error(await r.text());return Array.from(new Uint8Array(await r.arrayBuffer()));});
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-web-downloads-')),filename=path.join(directory,'template.xlsx');await fs.writeFile(filename,Buffer.from(template));
  const sheets=JSON.parse(execFileSync('python',['-c',"import zipfile,xml.etree.ElementTree as E,json,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps([s.attrib['name'] for s in E.fromstring(z.read('xl/workbook.xml')).iter() if s.tag.endswith('}sheet')],ensure_ascii=False))",filename],{encoding:'utf8'}));
  assert.deepEqual(sheets,['生产与质量','资源消耗','损失分析','统计监测','填写说明']);assert.equal(requested.filter(s=>s.startsWith('assets/spreadsheet.')).length,1);
  const xlsx=execFileSync('python',['-c',"import io,sys,openpyxl;w=openpyxl.Workbook();s=w.active;s.append(['时间','收率(%)']);s.append(['2026-10-02 08:00',97]);s.append(['2026-10-03 08:00',96]);b=io.BytesIO();w.save(b);sys.stdout.buffer.write(b.getvalue())"]);
  await importFile(p,'next.xlsx',xlsx,2);saved=(await api(p,'/api/offline/backup')).state.datasets.ds_unit_mmp2;assert.equal(saved.points.length,3);assert.equal(requested.filter(s=>s.startsWith('assets/spreadsheet.')).length,1,'template and imports share one workbook implementation');
  await p.reload();await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('下载测试员'));assert.equal((await api(p,'/api/offline/backup')).state.datasets.ds_unit_mmp2.points.length,3);
  checks.push('Compressed website opens without raw JS/CSS or Excel engine; CSV stays independent; lazy workbook export/import preserves all imported points across reload');
  for(const mode of ['legacy','corrupt','unpacked','blob-blocked','cached404','raw-retry']){const f=await open(mode);assert(!f.requested.some(s=>s.startsWith('assets/spreadsheet.')));if(['unpacked','blob-blocked','cached404'].includes(mode))assert(!f.requested.some(s=>s.endsWith('.js')||s.endsWith('.css')));else {assert(f.requested.some(s=>s.endsWith('.js')));assert(f.requested.some(s=>s.endsWith('.css')));}
   assert(f.p.url().endsWith('/workbench.html'),'Successful downloads must not unnecessarily enter compatible mode');
   if(mode==='cached404')assert.equal(f.requested.filter(s=>s.endsWith('.gz')).length,4);
   if(mode==='raw-retry')assert.equal(f.requested.filter(s=>s.endsWith('.js')).length,2);
  }
  checks.push('Blob execution can be prohibited; cached 404s revalidate, raw downloads retry once, unsupported decompression and corrupt payloads use verified raw assets');
  const retry=await open('lazy-retry');const first=await retry.p.evaluate(async()=>{const r=await fetch('/api/series/template?unit=mmp2');return {ok:r.ok,text:await r.text()};});assert.equal(first.ok,false);assert.match(first.text,/Excel功能下载失败/);
  const second=await retry.p.evaluate(async()=>{const r=await fetch('/api/series/template?unit=mmp2');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});assert.equal(second.ok,true);assert(second.bytes>1000);assert.equal(retry.requested.filter(s=>s.startsWith('assets/spreadsheet.')).length,2);
  checks.push('An interrupted workbook-engine download can be retried without refreshing or losing workspace data');
  // The fallback contains its own scripts and styles, including the lazy
  // workbook factory, and retains the normal page's account-local IndexedDB.
  await p.context().route('**/assets/**',route=>route.abort('failed'));
  await p.goto(site+'workbench.html',{waitUntil:'domcontentloaded'});await p.waitForURL('**/workbench-compatible.html*');await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('下载测试员'));
  assert.equal((await api(p,'/api/offline/backup')).state.datasets.ds_unit_mmp2.points.length,3);
  const workbook=await p.evaluate(async()=>{const r=await fetch('/api/series/template?unit=mmp2');return {ok:r.ok,size:(await r.arrayBuffer()).byteLength};});assert(workbook.ok&&workbook.size>1000);
  await p.getByRole('button',{name:'数据分析',exact:true}).click();await p.getByRole('button',{name:'自动图表',exact:true}).click();await importFile(p,'compatible.xlsx',xlsx,2);
  assert.equal((await api(p,'/api/offline/backup')).state.datasets.ds_unit_mmp2.points.length,3);
  checks.push('When every separate asset is blocked, compatible mode opens on the same origin with the same identity and data; workbook template and import still work');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
