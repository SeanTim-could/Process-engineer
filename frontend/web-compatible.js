// Same-origin fallback. Remember this route only after a protected workspace opens.
(() => {
  let done=false,english=false,observer;
  try{english=localStorage.getItem('workbench-last-language')==='en';}catch{}
  function status(message){const el=document.getElementById('web-startup-status');if(el)el.textContent=message;}
  function labels(){if(!english)return;document.documentElement.lang='en';for(const [k,v]of Object.entries({b:'Workbench',h1:'Loading…',button:'Reload',a:'Reload compatible mode'})){const el=document.querySelector('.startup-screen '+k);if(el)el.textContent=v;}}
  const timer=setTimeout(()=>{if(!done)status(english?'Loading is taking longer than expected. Reload to retry.':'加载时间较长，可以点击重新加载重试；已保存的数据保留。');},15000);
  function check(){const root=document.getElementById('root');if(root?.firstElementChild&&!root.querySelector('.startup-screen')){done=true;clearTimeout(timer);}if(root?.querySelector('.offline-bar')){try{localStorage.setItem('workbench-entry-mode','compatible');}catch{}observer?.disconnect();}}
  window.WorkbenchStartup=Object.freeze({
    styleReady:Promise.resolve(),
    progress(message){if(!done)status(english?'Verifying your account…':message);},
    ready(){const root=document.getElementById('root');if(root&&!observer){observer=new MutationObserver(check);observer.observe(root,{childList:true,subtree:true});}check();},
    fail(){done=true;clearTimeout(timer);status(english?'Unable to load. Please reload.':'工作台初始化失败，请重新加载。');}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',labels,{once:true});else labels();
})();
