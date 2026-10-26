// Exercise the public presets while preserving users' business-specific names.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='https://seantim-could.github.io/Process-engineer/workbench.html';
const forbidden=/MMP|HMTBN|\bCHW\b|\bCW\b|\bGW1\b|\bVS\b|精馏|脱轻|硫磺/;
const temp=path.join(os.tmpdir(),'workbench-general-labels');
async function api(page,url,method='GET',body){return page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await r.json();if(!r.ok)throw new Error(value.error);return value;},{url,method,body});}
const backup=p=>api(p,'/api/offline/backup');
async function csv(p,name,rows,count=1){
 await p.getByRole('button',{name:'导入数据',exact:true}).click();
 await p.locator('input[accept=".xlsx,.xls,.csv"]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from('\ufeff'+rows.join('\n'))});
 await p.getByRole('button',{name:`导入并生成图表（${count}点）`,exact:true}).click();
 await p.locator('input[accept=".xlsx,.xls,.csv"]').waitFor({state:'detached'});
}
async function daily(p,headers,values){
 await p.getByRole('button',{name:'表格输入',exact:true}).click();
 await p.getByRole('combobox',{name:'表格导入用途',exact:true}).selectOption('daily');
 await p.getByRole('button',{name:'批量粘贴',exact:true}).click();
 await p.getByRole('textbox',{name:'批量粘贴内容',exact:true}).fill(headers.join('\t')+'\n'+values.join('\t'));
 await p.getByRole('button',{name:'填入表格',exact:true}).click();
 await p.getByRole('button',{name:'下一步：核对并保存',exact:true}).click();
 await p.getByRole('button',{name:/确认导入.*1条/}).click();
 await p.getByRole('button',{name:/确认导入.*1条/}).waitFor({state:'detached'});
}
(async()=>{
 await fs.mkdir(temp,{recursive:true});
 const html=execFileSync('python',['-c',"import importlib.util,pathlib,sys;p=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('auth_sync',p/'scripts/sync-account-auth.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);sys.stdout.buffer.write(m.render((p/'启动工程师工作台.html').read_text(),{'enabled':False,'url':'','publicKey':''}).encode())",root],{maxBuffer:8*1024*1024});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 const errors=[],checks=[];
 try{
  const context=await browser.newContext({viewport:{width:1400,height:950},acceptDownloads:true});
  await context.route('https://seantim-could.github.io/Process-engineer/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
  await p.getByRole('button',{name:'自动图表',exact:true}).click();
  await p.getByRole('heading',{name:'有时间，就能看见趋势。',exact:true}).waitFor();
  const empty=await p.locator('.auto-empty').innerText();assert(!forbidden.test(empty),empty);
  for(const name of ['生产指标','质量指标','资源消耗','损失分析','统计监测'])assert(empty.includes(name),name);
  await p.screenshot({path:path.join(temp,'general-empty-state.png')});
  await p.getByRole('button',{name:'导入数据',exact:true}).click();assert(!forbidden.test(await p.getByRole('dialog').innerText()));
  await p.getByRole('button',{name:'取消',exact:true}).click();
  await p.getByRole('button',{name:'查看示例图表',exact:true}).click();await p.locator('.auto-chart-card').first().waitFor();
  assert(!forbidden.test(await p.locator('.auto-charts').innerText()));
  for(const name of ['收率','资源用量1','资源用量2','资源用量3','资源用量4','损失量'])assert((await p.locator('.auto-charts').innerText()).includes(name));
  assert.equal(Object.keys((await backup(p)).state.datasets).length,0,'Viewing presets must not create or rewrite saved data');
  checks.push('Empty state, import guidance, module labels and demo charts use general terminology; viewing examples does not change stored data.');
  const xlsx=await p.evaluate(async()=>{const r=await fetch('/api/series/template?unit=mmp2');if(!r.ok)throw new Error('Template failed');return btoa(Array.from(new Uint8Array(await r.arrayBuffer()),n=>String.fromCharCode(n)).join(''));});
  const file=path.join(temp,'general-template.xlsx');await fs.writeFile(file,Buffer.from(xlsx,'base64'));
  const info=JSON.parse(execFileSync('python',['-c',"import zipfile,xml.etree.ElementTree as E,json,sys;z=zipfile.ZipFile(sys.argv[1]);names=[s.attrib['name'] for s in E.fromstring(z.read('xl/workbook.xml')).iter() if s.tag.endswith('}sheet')];text='\\n'.join(''.join(E.fromstring(z.read(n)).itertext()) for n in z.namelist() if n.endswith('.xml'));print(json.dumps({'sheets':names,'text':text},ensure_ascii=False))",file],{encoding:'utf8'}));
  assert.deepEqual(info.sheets,['生产与质量','资源消耗','损失分析','统计监测','填写说明']);assert(!forbidden.test(info.text),info.text);
  for(const header of ['收率 (%)','资源用量1 (m³)','资源用量2 (kWh)','损失量 (t)'])assert(info.text.includes(header));
  checks.push('The actual downloaded Excel workbook uses general sheet names, headers and instructions.');
  await daily(p,['时间','装置','进料量','产量','天然气用量','蒸汽用量','硫磺用量'],['2026-10-01','默认装置','100','90','15','4','0.5']);
  await daily(p,['时间','装置','进料量','产品量','气体资源用量','热媒资源用量','辅助物料用量'],['2026-10-02','默认装置','110','99','16','5','0.6']);
  const records=(await backup(p)).state.records;
  assert.equal(records.length,2);assert.deepEqual(records.map(r=>[r.feed,r.product,r.gas,r.steam,r.sulfur]),[[100,90,15,4,.5],[110,99,16,5,.6]]);
  checks.push('Legacy and general raw-report headers both import correctly into the same unchanged field keys and quantities.');
  const settings=(await backup(p)).state.settings;settings.units[0].name='MMP用户自有装置';settings.customMetrics.push({id:'x_named',field:'x_named',label:'MMP用户自定义指标',unit:'t',mode:'sum',direction:'down',decimals:2});
  await api(p,'/api/settings','PUT',settings);await p.reload();
  await csv(p,'legacy.csv',['时间,MMP收率(%),CHW(m³),MMP损失(t),损失去向','2026-10-03 08:00,98.5,10,0.5,旧分组']);
  let data=(await backup(p)).state.datasets.ds_unit_mmp2;
  for(const [label,module]of [['MMP收率','yield'],['CHW','utilities'],['MMP损失','loss']]){const c=data.dataset.columns.find(c=>c.label===label);assert(c,label);assert.equal(c.module,module);}
  assert.equal(data.points[0].group,'旧分组');
  const previous=structuredClone(data.points[0]);
  await csv(p,'general.csv',['时间,收率(%),资源用量1(m³),资源用量2(kWh),资源用量3(Nm³),资源用量4(t),损失量(t),分组','2026-10-04 08:00,97,20,30,40,5,0.2,新分组']);
  const state=(await backup(p)).state;data=state.datasets.ds_unit_mmp2;
  for(const label of ['资源用量1','资源用量2','资源用量3','资源用量4'])assert.equal(data.dataset.columns.find(c=>c.label===label).module,'utilities');
  assert.deepEqual(data.points.find(point=>point.time===previous.time),previous);
  assert.equal(state.settings.units[0].id,'mmp2');assert.equal(state.settings.units[0].name,'MMP用户自有装置');assert.equal(state.settings.customMetrics[0].label,'MMP用户自定义指标');
  assert.deepEqual(state.records,records);
  checks.push('Historical business-specific names and grouping headers remain supported; existing points, unit IDs, user-defined labels and raw records are preserved.');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,screenshot:path.join(temp,'general-empty-state.png')},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);console.error('::error::'+String(e.stack??e).replace(/%/g,'%25').replace(/\n/g,'%0A'));process.exitCode=1});
