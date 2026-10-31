// Website-only: start the protected identity request while the application loads.
// Nothing from the identity response is persisted or accepted without its live
// request, current access token, project, expiry and one-use freshness checks.
(() => {
  const config=window.WorkbenchWebAuthConfig;
  if(!config?.enabled)return;
  const key='workbench-auth:'+config.url,nativeFetch=window.fetch.bind(window);
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};
  const initial=read();if(!initial?.access_token||!initial?.refresh_token)return;
  let selected=initial,used=false;
  const same=(a,b)=>a?.access_token===b?.access_token&&a?.refresh_token===b?.refresh_token;
  const changed=()=>Object.assign(new Error('登录状态已变化，请重新登录。'),{status:401});
  async function request(path,method,body,token){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await nativeFetch(config.url+path,{method,cache:'no-store',signal:controller.signal,headers:{apikey:config.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));if(controller.signal.aborted)throw new Error('账号服务连接超时，请检查网络后重试。');
      if(!response.ok)throw Object.assign(new Error(response.status===429?'操作过于频繁，请稍后重试。':data.error_description??data.error??data.message??'账号服务暂时不可用。'),{status:response.status});
      return data;
    }catch(e){if(controller.signal.aborted)throw new Error('账号服务连接超时，请检查网络后重试。');throw e;}finally{clearTimeout(timer);}
  }
  const task=(async()=>{
    if(!Number.isFinite(selected.expires_at)||selected.expires_at*1000<=Date.now()+30000){
      const value=await request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:selected.refresh_token});
      if(!same(read(),selected))throw changed();
      if(!value.access_token||!value.refresh_token)throw new Error('登录响应无效，请重新登录。');
      selected={access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at??Math.floor(Date.now()/1000)+value.expires_in};
      sessionStorage.setItem(key,JSON.stringify(selected));
    }
    const rows=await request('/rest/v1/workbench_profiles?select=id,display_name,employee_id,role,active,must_change_password&limit=2','GET',undefined,selected.access_token);
    if(!same(read(),selected))throw changed();
    if(window.WorkbenchStartup)window.WorkbenchStartup.progress('身份验证已返回，正在准备工作台界面…');
    else {const status=document.getElementById('web-startup-status');if(status)status.textContent='身份验证已返回，正在准备工作台界面…';}
    return {session:selected,rows,verifiedAt:Date.now()};
  })();
  task.catch(()=>{}); // Gate consumes errors after the application is available.
  Object.defineProperty(window,'WorkbenchAuthBootstrap',{configurable:false,writable:false,value:Object.freeze({
    take(expected,session){
      if(used||expected.url!==config.url||expected.publicKey!==config.publicKey||!same(session,read())||!same(session,selected))return null;
      used=true;
      return task.then(result=>{
        if(!same(read(),result.session))throw changed();
        return Date.now()-result.verifiedAt<60000&&result.session.expires_at*1000>Date.now()?result:null;
      });
    }
  })});
})();
