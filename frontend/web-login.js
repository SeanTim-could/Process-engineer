// Small public website entry. The full workbench still validates the protected
// identity row before opening any account workspace or administration controls.
(() => {
  const config=window.WorkbenchWebConfig;
  const target=new URL('./workbench.html',location.href).href;
  const form=document.getElementById('web-login-form');
  const error=document.getElementById('web-login-error');
  const button=document.getElementById('web-login-submit');
  const status=document.getElementById('web-login-status');
  const sessionKey='workbench-auth:'+config.url;
  if(!config.enabled){location.replace(target);return;}
  try{
    const saved=JSON.parse(sessionStorage.getItem(sessionKey)??'null');
    if(saved?.access_token&&saved?.refresh_token){status.textContent='正在打开你的工作台…';location.replace(target);return;}
  }catch{}
  button.disabled=false;
  // Warm the heavy resources after the small form is visible. Prefetch has low
  // priority and is skipped when the browser requests reduced data usage.
  if(!navigator.connection?.saveData){
    const warm=()=>{for(const href of config.prefetch??[]){const link=document.createElement('link');link.rel='prefetch';link.href=href;document.head.appendChild(link);}};
    if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:1000});else setTimeout(warm,0);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();button.disabled=true;error.hidden=true;status.textContent='正在验证账号…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const employee=form.elements.employee.value.normalize('NFKC').trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(employee))throw new Error('请输入管理员发放的工号。');
      const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',cache:'no-store',signal:controller.signal,
        headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify({email:employee+'@workbench.invalid',password:form.elements.password.value})});
      const value=await response.json();
      if(!response.ok)throw new Error(response.status===429?'操作过于频繁，请稍后重试。':'工号或密码不正确，或账号尚未启用。');
      if(!value.access_token||!value.refresh_token)throw new Error('登录响应无效，请稍后重试。');
      sessionStorage.setItem(sessionKey,JSON.stringify({access_token:value.access_token,refresh_token:value.refresh_token,
        expires_at:value.expires_at??Math.floor(Date.now()/1000)+value.expires_in}));
      form.elements.password.value='';status.textContent='登录验证完成，正在打开工作台…';location.replace(target);
    }catch(reason){
      error.textContent=controller.signal.aborted?'账号服务连接超时，请检查网络后重试。':reason.message;
      error.hidden=false;status.textContent='';button.disabled=false;
    }finally{clearTimeout(timer);}
  });
})();
