// Inline so waiting for the external stylesheet never leaves a blank document.
(() => {
  let resolve,reject,finished=false;
  const styleReady=new Promise((yes,no)=>{resolve=yes;reject=no;});styleReady.catch(()=>{});
  function status(message){const el=document.getElementById('web-startup-status');if(el)el.textContent=message;else document.addEventListener('DOMContentLoaded',()=>status(message),{once:true});}
  function retry(){const el=document.getElementById('web-startup-retry');if(el)el.hidden=false;else document.addEventListener('DOMContentLoaded',retry,{once:true});}
  const slow=setTimeout(()=>{if(!finished){status('加载比平时慢，可以继续等待，或重新加载。已保存的数据会保留。');retry();}},10000);
  window.WorkbenchStartup=Object.freeze({styleReady,progress:message=>{if(!finished)status(message);},styleLoaded:()=>resolve(),ready:()=>{finished=true;clearTimeout(slow);},fail:message=>{finished=true;clearTimeout(slow);status(message);retry();reject(new Error(message));}});
})();
