const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../frontend/web-auth-bootstrap.js'),'utf8');
const config={enabled:true,url:'https://bootstrap-fixture.supabase.co',publicKey:'sb_publishable_fixture'},key='workbench-auth:'+config.url;
const valid=()=>({access_token:'initial-access',refresh_token:'initial-refresh',expires_at:Math.floor(Date.now()/1000)+3600});
function run(saved=valid(),provider){
 const store=new Map(saved?[[key,JSON.stringify(saved)]]:[]),calls=[];let clock=Date.now();
 const context={AbortController,setTimeout,clearTimeout,Date:class extends Date{static now(){return clock;}},sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},document:{getElementById:()=>null}};
 context.window={WorkbenchWebAuthConfig:config,fetch:async(url,options)=>{calls.push({url,options});return provider?provider(url,options):new Response(JSON.stringify([{id:'fixture',active:true}]),{status:200});}};
 vm.runInNewContext(source,context);return {...context,store,calls,advance:n=>clock+=n};
}
(async()=>{
 let env=run();assert.equal(env.window.WorkbenchAuthBootstrap.take({...config,url:'https://foreign.invalid'},valid()),null);assert.equal(env.window.WorkbenchAuthBootstrap.take(config,{...valid(),access_token:'foreign'}),null);let value=await env.window.WorkbenchAuthBootstrap.take(config,valid());assert.equal(value.rows[0].active,true);assert.equal(env.calls.length,1);assert.equal(env.window.WorkbenchAuthBootstrap.take(config,valid()),null,'handoff is consumed once');assert(!env.store.get(key).includes('active'),'identity data must never be cached in sessionStorage');
 let finish;env=run(valid(),()=>new Promise(resolve=>finish=resolve));const pending=env.window.WorkbenchAuthBootstrap.take(config,valid());env.store.set(key,JSON.stringify({...valid(),access_token:'changed-user'}));finish(new Response(JSON.stringify([{id:'fixture',active:true}])));await assert.rejects(pending,e=>e.status===401,'a changed session cannot consume another session’s profile');
 env=run({...valid(),expires_at:0},(url)=>Promise.resolve(new Response(JSON.stringify(url.includes('/token')?{access_token:'refreshed-access',refresh_token:'refreshed-refresh',expires_in:3600}:[{id:'fixture',active:true}]))));value=await env.window.WorkbenchAuthBootstrap.take(config,{...valid(),expires_at:0});assert.equal(value.session.access_token,'refreshed-access');assert.equal(env.calls.length,2);assert.equal(env.calls[1].options.headers.Authorization,'Bearer refreshed-access');assert.equal(JSON.parse(env.store.get(key)).access_token,'refreshed-access');
 env=run();await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));env.advance(61000);assert.equal(await env.window.WorkbenchAuthBootstrap.take(config,valid()),null,'an old early response requires a fresh identity request');
 env=run(valid(),()=>Promise.resolve(new Response(JSON.stringify({error:'offline'}),{status:503})));await assert.rejects(env.window.WorkbenchAuthBootstrap.take(config,valid()),e=>e.status===503);
 env=run(null);assert.equal(env.calls.length,0);assert.equal(env.window.WorkbenchAuthBootstrap,undefined);
 console.log('Early live authentication passed: project/token binding, one-use handoff, refresh-before-profile, changed-session rejection, 60-second freshness, no identity persistence and failed/absent sessions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
