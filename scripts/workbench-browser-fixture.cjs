// Isolated, account-disabled application fixtures; never use production users.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),origin='https://seantim-could.github.io',site=origin+'/Process-engineer/workbench.html';
async function fixture(options={}){
 const {authConfig,entry,...contextOptions}=options;
 const html=execFileSync('python',['-c',"import importlib.util,pathlib,sys;p=pathlib.Path(sys.argv[1]);s=importlib.util.spec_from_file_location('auth',p/'scripts/sync-account-auth.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);sys.stdout.buffer.write(m.render((p/'启动工程师工作台.html').read_text(),__import__('json').loads(sys.argv[2])).encode())",root,JSON.stringify(authConfig??{enabled:false,url:'',publicKey:''})],{maxBuffer:14*1024*1024});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1500,height:1100},acceptDownloads:true,...contextOptions});
 if(entry){
  const config=JSON.parse(fs.readFileSync(path.join(root,'frontend/auth-config.json'),'utf8'));
  await context.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600})),{key:'workbench-auth:'+config.url});
  await context.route(config.url+'/**',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify(new URL(r.request().url()).pathname==='/auth/v1/token'?{access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}:[{id:'11111111-1111-4111-8111-111111111111',display_name:'范围测试员',employee_id:'ranges',role:'admin',active:true,must_change_password:false}])}));
  await context.route(origin+'/Process-engineer/**',route=>{
   const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace('/Process-engineer/','')||'index.html',file=path.join(root,relative);
   if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
   return route.fulfill({body:fs.readFileSync(file),contentType:relative.endsWith('.gz')?'application/gzip':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html; charset=utf-8'});
  });
 }else await context.route(origin+'/Process-engineer/**',r=>r.fulfill({body:html,contentType:'text/html; charset=utf-8'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=async(url,method='GET',body)=>page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw new Error(data.error);return data;},{url,method,body});
 const nav=async name=>{const section=['时序分析','前后能力分析','自由作图','自动图表','关系分析','多指标对比'].includes(name)?'数据分析':['数据中心','Excel自动同步','指标设置'].includes(name)?'数据管理':['个人中心','文档检索','文件索引'].includes(name)?'文档与个人':'运行概览';const toggle=page.getByRole('button',{name:section,exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await page.getByRole('button',{name,exact:true}).click();};
 return {browser,context,page,errors,api,nav,site:entry?origin+'/Process-engineer/'+entry:site};
}
module.exports={fixture};
