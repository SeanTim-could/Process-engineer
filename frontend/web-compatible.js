// Same-origin fallback: all application scripts and styles are in this document.
// AccountAuth still checks the live protected profile before opening any data.
(() => {
  let done=false;
  function status(message){const el=document.getElementById('web-startup-status');if(el)el.textContent=message;}
  window.WorkbenchStartup=Object.freeze({
    styleReady:Promise.resolve(),
    progress(message){if(!done)status(message);},
    ready(){done=true;},
    fail(){done=true;status('工作台初始化失败，请重新加载。');const retry=document.getElementById('web-startup-retry');if(retry)retry.hidden=false;}
  });
})();
