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
 let releaseBundle,releaseTimeout;const bundleGate=new Promise(resolve=>releaseBundle=resolve),timeoutGate=new Promise(resolve=>releaseTimeout=resolve);
 const errors=[],calls=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route(site+'**',async route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace('/Process-engineer/','')||'index.html';
   const body=files.get(relative);if(!body)return route.fulfill({status:404,body:'Not found'});
   if(relative.startsWith('assets/')&&relative.endsWith('.js'))await bundleGate;
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
   if(u.pathname==='/rest/v1/workbench_profiles')return route.fulfill({headers,body:JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',display_name:'速度测试员',employee_id:'perf',role:'staff',active:true,must_change_password:false}])});
   return route.fulfill({status:403,headers,body:JSON.stringify({error:'Unexpected fixture request'})});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site,{waitUntil:'domcontentloaded'});
  await p.getByRole('heading',{name:'登录你的工作台',exact:true}).waitFor();
  assert(await p.getByRole('button',{name:'登录',exact:true}).isEnabled());
  assert.equal(calls.length,0,'Showing the login form must not wait for the account server');
  assert.equal(await p.getByRole('button',{name:'完整备份',exact:true}).count(),0);
  await p.getByRole('textbox',{name:'登录工号',exact:true}).fill('perf');await p.getByLabel('登录密码',{exact:true}).fill('FixturePass1234!');
  await p.getByRole('button',{name:'登录',exact:true}).click();await p.waitForURL('**/workbench.html',{waitUntil:'commit'});
  await p.getByRole('heading',{name:'正在加载工作台…',exact:true}).waitFor();
  releaseBundle();
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
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,indexBytes:index.length,workbenchShellBytes:shell.length,checks:[
   'A usable login form appears while the full application JavaScript is withheld, without contacting Supabase',
   'The full application shows loading feedback, then validates the protected identity before opening the workspace',
   'Login and restore use one token request and one protected-profile request, with no redundant Auth user request',
   'Existing Chinese-named website bookmarks reach the light login entry; mobile layout fits',
   'A stalled login times out with a retryable message instead of hanging indefinitely'
  ]},null,2));
 }finally{releaseBundle();releaseTimeout();await browser.close();}
})().catch(e=>{console.error(e);console.error('::error::'+String(e.stack??e).replace(/%/g,'%25').replace(/\n/g,'%0A'));process.exitCode=1});
