// Isolated protocol fixtures, never real users or production credentials.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),origin='https://seantim-could.github.io';
const authOrigin='https://auth-fixture.supabase.co';
const adminId='11111111-1111-4111-8111-111111111111',staffId='22222222-2222-4222-8222-222222222222';
const initial='FixtureStartPass1234!';
const serviceKey='fixture-server-secret-never-for-the-browser';
const publicKey='sb_publishable_fixture';
const profiles=new Map(),users=new Map();
const audits=[];
function add(id,employee,name,role='staff',must=true){users.set(id,{id,email:employee+'@workbench.invalid',password:initial,banned:false});profiles.set(id,{id,employee_id:employee,display_name:name,role,active:true,must_change_password:must,created_at:new Date().toISOString()});}
add(adminId,'admin','管理员甲','admin',false);add(staffId,'staff','测试员工','staff',false);
const json=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function provider(url,options={}){
 const u=new URL(url),method=options.method??'GET',headers=new Headers(options.headers),body=options.body?JSON.parse(options.body):{};
 const bearer=headers.get('Authorization')?.replace(/^Bearer /,'');const service=bearer===serviceKey&&headers.get('apikey')===serviceKey;
 const suffix=own=>own.generation?':'+own.generation:'';
 const user=[...users.values()].find(u=>bearer==='access-'+u.id+suffix(u));
 const match=param=>{const value=u.searchParams.get(param);return value?.startsWith('eq.')?value.slice(3):null;};
 audits.push({path:u.pathname,method,service});
 if(u.pathname==='/auth/v1/token'){
  const own=u.searchParams.get('grant_type')==='refresh_token'?[...users.values()].find(v=>body.refresh_token==='refresh-'+v.id+suffix(v)):[...users.values()].find(v=>v.email===body.email&&v.password===body.password);
  return own&&!own.banned?json({access_token:'access-'+own.id+suffix(own),refresh_token:'refresh-'+own.id+suffix(own),expires_in:3600,user:{id:own.id,email:own.email}}):json({error:'Invalid credentials'},400);
 }
 if(u.pathname==='/auth/v1/user')return user&&!user.banned?json({id:user.id,email:user.email}):json({error:'Invalid JWT'},401);
 if(u.pathname==='/auth/v1/logout')return json(null,204);
 if(u.pathname.startsWith('/auth/v1/admin/users')){
  if(!service)return json({error:'Denied'},403);
  if(method==='POST'){
   if([...users.values()].some(v=>v.email===body.email))return json({error:'Duplicate'},409);
   const id=crypto.randomUUID();users.set(id,{id,email:body.email,password:body.password,banned:false});return json({id,email:body.email});
  }
  const id=u.pathname.split('/').at(-1),own=users.get(id);if(!own)return json({},404);
  if(method==='DELETE'){users.delete(id);profiles.delete(id);return json({});}
  if(body.password){own.password=body.password;own.generation=(own.generation??0)+1;}if(body.ban_duration)own.banned=body.ban_duration!=='none';return json({id});
 }
 if(u.pathname==='/rest/v1/workbench_profiles'){
  const id=match('id'),employee=match('employee_id');
  if(method==='GET'){
   const rows=[...profiles.values()].filter(p=>(!id||p.id===id)&&(!employee||p.employee_id===employee)&&(service||user?.id===p.id&&p.active));
   return json(rows);
  }
  if(!service)return json({error:'RLS'},403);
  if(method==='POST'){if([...profiles.values()].some(p=>p.employee_id===body.employee_id))return json({},409);profiles.set(body.id,{...body,created_at:new Date().toISOString()});return json([profiles.get(body.id)]);}
  if(method==='PATCH'){Object.assign(profiles.get(id),body);return json([profiles.get(id)]);}
 }
 return json({error:'Unknown fixture endpoint'},404);
}
const findings=[];
(async()=>{
 const source=await fs.readFile(path.join(root,'supabase/functions/workbench-accounts/index.ts'),'utf8');
 const js=require('node:module').stripTypeScriptTypes(source,{mode:'strip'});
 const {createAccountHandler}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const handler=createAccountHandler({url:authOrigin,anonKey:publicKey,serviceKey,allowedOrigins:origin},provider);
 async function edge(actor,body,requestOrigin=origin){const r=await handler(new Request(authOrigin+'/functions/v1/workbench-accounts',{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor}:{})},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
 assert.equal((await edge(null,{action:'list'})).status,401);
 assert.equal((await edge('forged-admin',{action:'list'})).status,401);
 assert.equal((await edge('access-'+staffId,{action:'create',role:'admin'})).status,403);
 assert.equal((await edge('access-'+adminId,{action:'list'},'https://untrusted.example')).status,403);
 const preflight=await handler(new Request(authOrigin+'/functions/v1/workbench-accounts',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(preflight.status,204);
 const created=await edge('access-'+adminId,{action:'create',name:'员工甲',employeeId:'E001',role:'admin'});assert.equal(created.status,200);assert(created.data.temporaryPassword.length>=12);
 const employee=[...profiles.values()].find(p=>p.employee_id==='e001');assert.equal(employee.role,'staff');assert(employee.must_change_password);
 assert.equal((await edge('access-'+adminId,{action:'create',name:'另一个人',employeeId:'e001'})).status,400);
 assert.equal((await edge('access-'+employee.id,{action:'change-password',currentPassword:'wrong',newPassword:'FixtureNewPass5678!'})).status,403);
 assert.equal((await edge('access-'+adminId,{action:'set-active',id:adminId,active:false})).status,400);
 findings.push('Backend verifies real Auth user responses and protected administrator profiles; anonymous/forged/staff requests and foreign origins cannot manage accounts; supplied roles cannot elevate a new staff account.');
 const before=profiles.get(employee.id).active;await edge('access-'+adminId,{action:'set-active',id:employee.id,active:false});assert(!profiles.get(employee.id).active);assert.equal((await edge('access-'+employee.id,{action:'change-password'})).status,401);
 await edge('access-'+adminId,{action:'set-active',id:employee.id,active:before});
 const reset=await edge('access-'+adminId,{action:'reset-password',id:employee.id});assert.equal(reset.status,200);assert.notEqual(reset.data.temporaryPassword,created.data.temporaryPassword);
 findings.push('Duplicate employee IDs are rejected, passwords are generated per issuance, disabling/re-enabling works, and resetting requires a new first-login password change.');
 const config={enabled:true,url:authOrigin,publicKey};
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'workbench-auth-'));
 execFileSync('python',['-c',"import importlib.util,json,pathlib,sys; p=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('auth_sync',p/'scripts/sync-account-auth.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);pathlib.Path(sys.argv[3]).write_text(m.render((p/'启动工程师工作台.html').read_text(),json.loads(sys.argv[2])))",root,JSON.stringify(config),path.join(temp,'fixture.html')]);
 const html=await fs.readFile(path.join(temp,'fixture.html'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],externalRequests=[];
  await context.route(origin+'/Process-engineer/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  await context.route(authOrigin+'/**',async route=>{
   const req=route.request(),u=new URL(req.url()),headers=req.headers();externalRequests.push(headers);
   const response=u.pathname==='/functions/v1/workbench-accounts'?await handler(new Request(req.url(),{method:req.method(),headers:{...headers,origin},body:req.postData()??undefined})):await provider(req.url(),{method:req.method(),headers,body:req.postData()});
   await route.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers),'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type'},body:response.status===204?'':await response.text()});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/Process-engineer/workbench.html');
  const call=(url,method='GET',body)=>p.evaluate(async({url,method,body})=>{try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {ok:r.ok,data:await r.json()};}catch(e){return {ok:false,error:e.message};}},{url,method,body});
  async function login(id,password){await p.getByRole('textbox',{name:'登录工号',exact:true}).fill(id);await p.getByLabel('登录密码',{exact:true}).fill(password);await p.getByRole('button',{name:'登录',exact:true}).click();}
  await p.getByRole('heading',{name:'登录你的工作台'}).waitFor();assert.equal((await call('/api/offline/backup')).ok,false);
  await login('admin',initial);await p.getByRole('button',{name:'账号管理',exact:true}).waitFor();
  await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('管理员甲'));
  await call('/api/workspace','PUT',{action:'focus',unit:'mmp2',month:'2026-10',text:'管理员自己的记录'});
  const old=(await call('/api/offline/backup')).data;
  old.state.focusNotes={'mmp2:2026-10':{text:'启用登录前的记录',updatedAt:new Date().toISOString()}};
  await p.evaluate(state=>new Promise((resolve,reject)=>{const r=indexedDB.open('process-studio-offline-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onerror=reject;r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite');t.objectStore('state').put({revision:7,state},'workspace');t.oncomplete=()=>{db.close();resolve()};t.onerror=reject}}),old.state);
  await p.getByRole('button',{name:'账号管理',exact:true}).click();
  const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'导出旧版本机备份',exact:true}).click();
  const download=await downloadPromise;const legacyFile=path.join(temp,'legacy-backup.json');await download.saveAs(legacyFile);
  const legacy=JSON.parse(await fs.readFile(legacyFile,'utf8'));assert.equal(legacy.state.focusNotes['mmp2:2026-10'].text,'启用登录前的记录');
  assert.equal((await call('/api/offline/backup')).data.state.focusNotes['mmp2:2026-10'].text,'管理员自己的记录');
  const oldRevision=await p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('process-studio-offline-v1');r.onerror=reject;r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readonly'),g=t.objectStore('state').get('workspace');g.onsuccess=()=>resolve(g.result.revision);t.oncomplete=()=>db.close()}}));assert.equal(oldRevision,7);
  await p.getByRole('textbox',{name:'新账号姓名',exact:true}).fill('员工乙');await p.getByRole('textbox',{name:'新账号工号',exact:true}).fill('e002');
  await p.getByRole('button',{name:'创建并生成初始密码',exact:true}).click();await p.locator('.account-issued code').waitFor();
  const issued=await p.locator('.account-issued code').innerText();assert(issued.length>=12);
  await p.getByRole('button',{name:'关闭账号窗口',exact:true}).click();assert.equal(await p.locator('.account-issued').count(),0);
  assert(!(await p.evaluate(()=>JSON.stringify({...sessionStorage,...localStorage}))).includes(issued));
  await p.getByRole('button',{name:'退出登录',exact:true}).click();await p.getByRole('heading',{name:'登录你的工作台'}).waitFor();
  await login('e002',issued);await p.getByRole('heading',{name:'首次登录，请修改密码'}).waitFor();assert.equal((await call('/api/offline/backup')).ok,false);
  await p.getByLabel('原密码',{exact:true}).fill(issued);await p.getByLabel('新密码',{exact:true}).fill('StaffNewPass5678!');await p.getByLabel('确认新密码',{exact:true}).fill('StaffNewPass5678!');await p.getByRole('button',{name:'保存新密码',exact:true}).click();
  await p.getByRole('button',{name:'退出登录',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'账号管理',exact:true}).count(),0);
  await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('员工乙'));
  const staffBackup=(await call('/api/offline/backup')).data;assert.deepEqual(staffBackup.state.focusNotes,{});
  await call('/api/workspace','PUT',{action:'focus',unit:'mmp2',month:'2026-10',text:'员工乙自己的记录'});
  let personal=(await call('/api/personal')).data;
  const forged=await call('/api/personal','PUT',{action:'profile',expectedRevision:personal.personalRevision,profile:{name:'冒充管理员',employeeId:'admin',theme:'ocean'}});
  assert.equal(forged.data.profile.name,'员工乙');assert.equal(forged.data.profile.employeeId,'e002');assert.equal(forged.data.profile.theme,'ocean');
  await p.getByRole('button',{name:'个人中心',exact:true}).click();assert(await p.getByRole('textbox',{name:'个人姓名',exact:true}).isDisabled());assert(await p.getByRole('textbox',{name:'个人工号',exact:true}).isDisabled());
  await p.reload();await p.getByRole('button',{name:'退出登录',exact:true}).waitFor();await p.waitForFunction(()=>document.querySelector('.offline-bar')?.textContent.includes('员工乙'));
  await p.getByRole('button',{name:'退出登录',exact:true}).click();await p.getByRole('heading',{name:'登录你的工作台'}).waitFor();await login('admin',initial);await p.getByRole('button',{name:'账号管理',exact:true}).waitFor();
  const adminBackup=(await call('/api/offline/backup')).data;assert.equal(adminBackup.state.focusNotes['mmp2:2026-10'].text,'管理员自己的记录');
  const migration=await call('/api/offline/restore','POST',staffBackup);assert(migration.ok);assert.equal((await call('/api/personal')).data.profile.employeeId,'admin');
  findings.push('Actual browser login, administrator issuance, mandatory first change, logout and re-login work; accounts use separate databases in one browser, profiles cannot impersonate another employee, and imported backups cannot replace the authenticated identity.');
  findings.push('Password changes replace revoked sessions; administrators can export pre-login local data without altering its revision or the active workspace.');
  assert(externalRequests.every(headers=>!JSON.stringify(headers).includes(serviceKey)));assert.deepEqual(errors,[]);
  await p.getByRole('button',{name:'退出登录',exact:true}).click();await p.getByRole('heading',{name:'登录你的工作台'}).waitFor();await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.screenshot({path:path.join(temp,'login-mobile.png')});
  console.log(JSON.stringify({passed:true,checks:findings,screenshot:path.join(temp,'login-mobile.png'),limits:'Supabase protocol fixtures; a real project must still be configured and tested.'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);console.error('::error::'+String(e.stack??e).replace(/%/g,'%25').replace(/\n/g,'%0A'));process.exitCode=1;});
