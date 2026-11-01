// Same-origin fallback: all application scripts and styles are in this document.
// AccountAuth still checks the live protected profile before opening any data.
(() => {
  let done=false,english=false;try{english=localStorage.getItem('workbench-last-language')==='en';}catch{}if(english){document.documentElement.lang='en';for(const [k,v]of Object.entries({b:'Workbench',h1:'Loading…',button:'Reload'})){const e=document.querySelector('.startup-screen '+k);if(e)e.textContent=v;}}
  function status(message){const el=document.getElementById('web-startup-status');if(el)el.textContent=english?'Loading workbench…':message;}
  window.WorkbenchStartup=Object.freeze({
    styleReady:Promise.resolve(),
    progress(message){if(!done)status(message);},
    ready(){done=true;},
    fail(){done=true;status('工作台初始化失败，请重新加载。');if(english)document.getElementById('web-startup-status').textContent='Unable to load. Please reload.';const retry=document.getElementById('web-startup-retry');if(retry)retry.hidden=false;}
  });
})();
