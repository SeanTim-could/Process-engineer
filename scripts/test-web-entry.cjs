// Delay the full application to prove that the public login form is independent
// of chart/Excel code, then exercise the real generated website and auth gate.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const site='https://seantim-could.github.io/Process-engineer/';
(async()=>{
 const config=JSON.parse(await fs.readFile(path.join(root,'frontend/auth-config.json'),'utf8'));
 const index=await fs.readFile(path.join(root,'index.html'));
 const shell=await fs.readFile(path.join(root,'workbench.html'));
 assert(index.length<16000,'The first website page should stay small');
 assert(shell.length<8000,'The application shell should not contain its JavaScript bundle');
 assert(!index.toString().includes('data:text/javascript;base64,'));
 const files=new Map([['index.html',index],['workbench.html',shell],['启动工程师工作台.html',await fs.readFile(path.join(root,'启动工程师工作台.html'))]]);
 for(const file of await fs.readdir(path.join(root,'assets')))files.set('assets/'+file,await fs.readFile(path.join(root,'assets',file)));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 let releaseBundle,releaseTimeout,releaseStyle;const bundleGate=new Promise(resolve=>releaseBundle=resolve),timeoutGate=new Promise(resolve=>releaseTimeout=resolve),styleGate=new Promise(resolve=>releaseStyle=resolve);
 const errors=[],calls=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route(site+'**',async route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace('/Process-engineer/','')||'index.html';
   const body=files.get(relative);if(!body)return route.fulfill({status:404,body:'Not found'});
   if(relative.startsWith('assets/')&&relative.endsWith('.js'))await bundleGate;
   if(relative.startsWith('assets/')&&relative.endsWith('.css'))await styleGate;
   const type=relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html; charset=utf-8';
   await route.fulfill({body,contentType:type});
  });
  await context.route(config.url+'/**',async route=>{
   const request=route.request(),u=new URL(request.url());calls.push(u.pathname);
   const headers={'Access-Control-Allow-Origin':new URL(site).origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(u.pathname==='/auth/v1/token'){
    const body=request.postDataJSON();
    if(body.email==='timeout@workbench.invalid'){
     await timeoutGate;try{await route.abort('timedout');}catch{}return;
    }
    return route.fulfill({headers,body:JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111'}})});
   }
   if(u.pathname==='/rest/v1/workbench_profiles')return route.fulfill({headers,body:JSON.stringify(request.headers()['authorization']==='Bearer blocked-access'?[]:[{id:'11111111-1111-4111-8111-111111111111',display_name:'速度测试员',employee_id:'perf',role:'staff',active:true,must_change_password:false}])});
   return route.fulfill({status:403,headers,body:JSON.stringify({error:'Unexpected fixture request'})});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site,{waitUntil:'domcontentloaded'});
  await p.getByRole('heading',{name:'登录你的工作台',exact:true}).waitFor();
  assert(await p.getByRole('button',{name:'登录',exact:true}).isEnabled());
  assert.equal(calls.length,0,'Showing the login form must not wait for the account server');
  assert.equal(await p.getByRole('button',{name:'另存为',exact:true}).count(),0);
  await p.getByRole('textbox',{name:'登录工号',exact:true}).fill('perf');await p.getByLabel('登录密码',{exact:true}).fill('FixturePass1234!');
  const profileStarted=p.waitForRequest(r=>r.url().includes('/rest/v1/workbench_profiles'));
  await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/workbench.html',{waitUntil:'commit'});
  await p.getByRole('heading',{name:'正在加载工作台…',exact:true}).waitFor();
  await profileStarted;
  await p.waitForFunction(()=>performance.getEntriesByType('paint').some(p=>p.name==='first-contentful-paint'));
  assert.equal(calls.filter(s=>s==='/rest/v1/workbench_profiles').length,1,'Live identity validation starts before the application bundle is available');
  assert.equal(await p.evaluate(()=>window.WorkbenchAuthBootstrap.take({url:'https://foreign.invalid',publicKey:'foreign'},{})),null);
  const screenshot=path.join(require('node:os').tmpdir(),'workbench-delayed-style.png');await p.screenshot({path:screenshot});
  releaseBundle();releaseStyle();
  await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('速度测试员'));
  assert.equal(calls.filter(s=>s==='/auth/v1/token').length,1);
  assert.equal(calls.filter(s=>s==='/rest/v1/workbench_profiles').length,1);
  assert.equal(calls.filter(s=>s==='/auth/v1/user').length,0,'Identity is already checked by the protected table RLS');
  const legacy=await context.newPage();legacy.on('pageerror',e=>errors.push(e.message));
  await legacy.goto(site+'workbench.html',{waitUntil:'domcontentloaded'}).catch(e=>{if(!e.message.includes('ERR_ABORTED'))throw e});
  await legacy.waitForURL('**/index.html');await legacy.getByRole('heading',{name:'登录你的工作台',exact:true}).waitFor();
  await legacy.goto(site+encodeURIComponent('启动工程师工作台.html'),{waitUntil:'domcontentloaded'}).catch(e=>{if(!e.message.includes('ERR_ABORTED'))throw e});
  await legacy.waitForURL('**/index.html');await legacy.getByRole('heading',{name:'登录你的工作台',exact:true}).waitFor();
  await legacy.setViewportSize({width:390,height:844});assert(await legacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await legacy.clock.install();await legacy.getByRole('textbox',{name:'登录工号',exact:true}).fill('timeout');await legacy.getByLabel('登录密码',{exact:true}).fill('FixturePass1234!');await legacy.getByRole('button',{name:'登录',exact:true}).click();
  await legacy.clock.runFor(15100);await legacy.getByRole('alert').filter({hasText:'连接超时'}).waitFor();
  assert(await legacy.getByRole('button',{name:'登录',exact:true}).isEnabled());releaseTimeout();
  const restored=await context.newPage();restored.on('pageerror',e=>errors.push(e.message));
  await restored.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify({access_token:'expired-access',refresh_token:'fixture-refresh',expires_at:0})),{key:'workbench-auth:'+config.url});
  const oldTokenCalls=calls.filter(s=>s==='/auth/v1/token').length,oldProfileCalls=calls.filter(s=>s==='/rest/v1/workbench_profiles').length;
  await restored.goto(site+'workbench.html');await restored.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('速度测试员'));
  assert.equal(calls.filter(s=>s==='/auth/v1/token').length-oldTokenCalls,1,'early refresh and Gate must share one token request');assert.equal(calls.filter(s=>s==='/rest/v1/workbench_profiles').length-oldProfileCalls,1);
  const blocked=await context.newPage();blocked.on('pageerror',e=>errors.push(e.message));
  await blocked.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify({access_token:'blocked-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600})),{key:'workbench-auth:'+config.url});
  await blocked.goto(site+'workbench.html');await blocked.getByRole('heading',{name:'登录你的工作台',exact:true}).waitFor();assert.equal(await blocked.locator('.offline-bar').count(),0,'a protected empty/disabled profile must not open a workspace');
  const failed=await context.newPage();failed.on('pageerror',e=>errors.push(e.message));
  await failed.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600})),{key:'workbench-auth:'+config.url});
  await failed.route('**/assets/*.js',route=>route.abort('failed'));await failed.goto(site+'workbench.html');await failed.getByText('工作台程序下载失败，请重新加载。',{exact:true}).waitFor();assert(await failed.getByRole('button',{name:'重新加载',exact:true}).isVisible());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,indexBytes:index.length,workbenchShellBytes:shell.length,checks:[
   'A usable login form appears while the full application JavaScript is withheld, without contacting Supabase',
   'Loading feedback paints while both stylesheet and script are withheld; live identity validation overlaps their download',
   'Login and restore use one token request and one protected-profile request, with no redundant Auth user request',
   'Existing Chinese-named website bookmarks reach the light login entry; mobile layout fits',
   'Expired sessions refresh only once; empty protected profiles cannot open a workspace; failed program downloads show a retry button',
   'A stalled login times out with a retryable message instead of hanging indefinitely'
  ]},null,2));
 }finally{releaseBundle();releaseStyle();releaseTimeout();await browser.close();}
})().catch(e=>{console.error(e);console.error('::error::'+String(e.stack??e).replace(/%/g,'%25').replace(/\n/g,'%0A'));process.exitCode=1});
