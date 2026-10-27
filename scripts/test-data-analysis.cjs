const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),site='https://seantim-could.github.io/Process-engineer/workbench.html';
async function call(p,url,method='GET',body,ok=true){const value=await p.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {ok:r.ok,data:await r.json()};},{url,method,body});assert.equal(value.ok,ok,JSON.stringify(value));return value.data;}
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-analysis-'));
 const html=execFileSync('python',['-c',"import importlib.util,pathlib,sys;p=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('auth_sync',p/'scripts/sync-account-auth.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);sys.stdout.buffer.write(m.render((p/'启动工程师工作台.html').read_text(),{'enabled':False,'url':'','publicKey':''}).encode())",root],{maxBuffer:10*1024*1024});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1460,height:1100},acceptDownloads:true});await context.route('https://seantim-could.github.io/Process-engineer/**',r=>r.fulfill({body:html,contentType:'text/html; charset=utf-8'}));
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(site);await p.locator('.grouped-nav').waitFor();
  assert.equal(await p.locator('.nav-group-toggle').count(),4);
  const backup=await call(p,'/api/offline/backup'),s=backup.state,now=Date.parse('2026-10-01T08:00:00+08:00');
  const col=(key,label,unit='kg/h',source='production')=>({key,index:Number(key.slice(2)),header:label,label,unit,source,module:'other',kind:'reading',aggregation:'auto',recognized:true,enabled:true,scale:1,limit:null,maxGapHours:null,showTotal:true});
  const points=Array.from({length:120},(_,i)=>({unit:'mmp2',time:now+i*60000,group:'P',values:{c_1:i===20||i===80?null:i<60?10+(i%5-2):10.2+(i%5-2)*.2,c_2:20+i*.1,c_3:i%7===0?null:40+i*.1}}));
  s.datasets={ds_unit_mmp2:{dataset:{id:'ds_unit_mmp2',name:'过程指标',filename:'fixture.csv',sheet:'data',columns:[col('c_1','质量指标'),col('c_2','流量'),col('c_3','检验值','%','lims')],count:120,expectedCount:120,unitIds:['mmp2'],groups:['P'],start:now,end:now+119*60000,createdAt:'2026-10-01T00:00:00Z',status:'ready',role:'ledger'},points}};
  s.records=[{unit:'mmp2',date:'2026-10-01',feed:100,product:90,note:'原始日报',extras:{}}];
  await call(p,'/api/offline/restore','POST',backup);await p.reload();
  const original=(await call(p,'/api/offline/backup')).state;
  await p.getByRole('button',{name:'数据分析',exact:true}).click();await p.getByRole('button',{name:'时序分析',exact:true}).click();
  await p.getByRole('img',{name:'时序分析 · 质量指标',exact:true}).waitFor();assert.equal(await p.locator('.analysis-figure svg').count(),2);
  const line=await p.locator('.analysis-figure svg').first().locator('path[stroke-width="2"]').first().getAttribute('d');assert((line.match(/ M/g)||[]).length>=3,'missing readings must break the line');
  await p.getByRole('button',{name:'前后能力分析',exact:true}).click();await p.getByRole('img',{name:'汇总报告',exact:true}).waitFor();
  await p.getByLabel('调整时间（北京时间）',{exact:true}).fill('2026-10-01T09:00');await p.getByLabel('规格下限 LSL',{exact:true}).fill('7');await p.getByLabel('规格上限 USL',{exact:true}).fill('13');
  const samples=await p.locator('[data-stat="n"] td:not([data-side="delta"])').allTextContents();assert.deepEqual(samples,['59','59']);
  const ppk=(await p.locator('[data-stat="Ppk"] td:not([data-side="delta"])').allTextContents()).map(Number);assert(ppk[1]>ppk[0]*4);
  assert.deepEqual((await p.locator('[data-stat="passRate"] td:not([data-side="delta"])').allTextContents()).map(Number),[100,100]);assert.equal(await p.locator('.capability-workspace .analysis-figure svg').count(),3);
  await p.screenshot({path:path.join(dir,'capability-desktop.png'),fullPage:true});
  const reportEvent=p.waitForEvent('download');await p.getByRole('button',{name:'导出分析报告',exact:true}).click();const report=await reportEvent;await report.saveAs(path.join(dir,'capability.html'));const reportText=await fs.readFile(path.join(dir,'capability.html'),'utf8');assert(reportText.includes('Ppk'));assert(reportText.includes('09:00'));assert(reportText.includes('标准差（整体）'));assert(reportText.includes('<svg'));
  await p.getByLabel('对比划分方式',{exact:true}).selectOption('periods');for(const [label,value]of [['之前开始','2026-10-01T08:00'],['之前结束','2026-10-01T08:59'],['之后开始','2026-10-01T09:00'],['之后结束','2026-10-01T09:59']])await p.getByLabel(label+'（北京时间）',{exact:true}).fill(value);
  assert.deepEqual(await p.locator('[data-stat="n"] td:not([data-side="delta"])').allTextContents(),['59','59']);
  await p.getByLabel('之后开始（北京时间）',{exact:true}).fill('2026-10-01T08:59');assert((await p.getByRole('alert').allTextContents()).some(s=>s.includes('不能重叠')));
  await p.getByLabel('之后开始（北京时间）',{exact:true}).fill('2026-10-01T09:00');
  const {lastSavedAt:ignoreSaved,...analyzed}=(await call(p,'/api/offline/backup')).state,{lastSavedAt:ignoreOriginal,...baseline}=original;
  assert.deepEqual(analyzed,baseline,'analysis and reports must not mutate workspace data');
  await p.getByRole('button',{name:'自由作图',exact:true}).click();await p.getByLabel('图表类型',{exact:true}).waitFor();
  await p.getByLabel('图表标题',{exact:true}).fill('我的质量图');
  for(const type of ['area','bar','scatter','histogram','box','line']){await p.getByLabel('图表类型',{exact:true}).selectOption(type);await p.getByRole('img',{name:'我的质量图',exact:true}).waitFor();assert.equal(await p.getByRole('alert').count(),0,type);}
  await p.getByLabel('同图指标：流量',{exact:true}).check();await p.getByRole('button',{name:'保存到作图区',exact:true}).click();await p.locator('.analysis-saved-card').waitFor();
  let saved=await call(p,'/api/analytics');assert.equal(saved.charts.length,1);assert.equal(saved.charts[0].keys.length,2);
  const pngEvent=p.waitForEvent('download');await p.getByRole('button',{name:'导出 PNG',exact:true}).click();const png=await pngEvent;await png.saveAs(path.join(dir,'chart.png'));const bytes=await fs.readFile(path.join(dir,'chart.png'));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert(bytes.length>10000);
  await p.reload();await p.getByRole('button',{name:'数据分析',exact:true}).click();await p.getByRole('button',{name:'自由作图',exact:true}).click();await p.locator('.analysis-saved-card').waitFor();assert((await p.locator('.analysis-saved-card').innerText()).includes('我的质量图'));
  await p.getByRole('button',{name:'展开图表',exact:true}).click();await p.locator('.analysis-saved-card svg').waitFor();await p.getByRole('button',{name:'载入编辑',exact:true}).click();
  await p.getByLabel('图表标题',{exact:true}).fill('修改后的图');await p.getByRole('button',{name:'保存修改',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.analysis-saved-head b')?.textContent==='修改后的图');
  saved=await call(p,'/api/analytics');const stale=saved.revision-1;assert.match((await call(p,'/api/analytics','PUT',{action:'delete',id:saved.charts[0].id,expectedRevision:stale},false)).error,/更新/);
  const full=await call(p,'/api/offline/backup');assert.equal(full.state.analytics.charts[0].title,'修改后的图');await call(p,'/api/offline/restore','POST',full);assert.equal((await call(p,'/api/analytics')).charts[0].title,'修改后的图');
  assert.deepEqual(full.state.datasets,original.datasets);assert.deepEqual(full.state.records,original.records);
  // Mixed units require explicit normalization; the original values stay literal.
  await p.getByLabel('同图指标：检验值',{exact:true}).check();await p.getByRole('alert').filter({hasText:'单位不同'}).waitFor();await p.getByText('各指标归一化到0–1（比较变化形态）',{exact:true}).click();await p.getByRole('img',{name:'修改后的图',exact:true}).first().waitFor();
  await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);await p.screenshot({path:path.join(dir,'plotting-mobile.png'),fullPage:true,animations:'disabled'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.getByRole('button',{name:'打开导航',exact:true}).click();await p.getByRole('button',{name:'前后能力分析',exact:true}).click();await p.getByRole('img',{name:'汇总报告',exact:true}).waitFor();await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['Four collapsible navigation groups preserve old routes','Time sequence and I-MR keep gaps','Before/after capability, one time split and separate periods, inclusive minutes and reports','Six real SVG chart types and high-resolution PNG export','Chart recipes persist across reload and backup restore, optimistic revisions reject stale writes','Analysis does not mutate original values; different units require normalization; mobile fits'],artifacts:dir},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);console.error('::error::'+String(e.stack??e).replace(/%/g,'%25').replace(/\n/g,'%0A'));process.exitCode=1;});
