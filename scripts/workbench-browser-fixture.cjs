// Isolated, account-disabled application fixtures; never use production users.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),origin='https://seantim-could.github.io',site=origin+'/Process-engineer/workbench.html';
async function fixture(options={}){
 const {authConfig,...contextOptions}=options;
 const html=execFileSync('python',['-c',"import importlib.util,pathlib,sys;p=pathlib.Path(sys.argv[1]);s=importlib.util.spec_from_file_location('auth',p/'scripts/sync-account-auth.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);sys.stdout.buffer.write(m.render((p/'启动工程师工作台.html').read_text(),__import__('json').loads(sys.argv[2])).encode())",root,JSON.stringify(authConfig??{enabled:false,url:'',publicKey:''})],{maxBuffer:14*1024*1024});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1500,height:1100},acceptDownloads:true,...contextOptions});await context.route(origin+'/Process-engineer/**',r=>r.fulfill({body:html,contentType:'text/html; charset=utf-8'}));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=async(url,method='GET',body)=>page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw new Error(data.error);return data;},{url,method,body});
 const nav=async name=>{const section=['时序分析','前后能力分析','自由作图','自动图表'].includes(name)?'数据分析':['数据中心','Excel自动同步','指标设置'].includes(name)?'数据管理':['个人中心','文档检索','文件索引'].includes(name)?'文档与个人':'运行概览';const toggle=page.getByRole('button',{name:section,exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await page.getByRole('button',{name,exact:true}).click();};
 return {browser,context,page,errors,api,nav,site};
}
module.exports={fixture};
