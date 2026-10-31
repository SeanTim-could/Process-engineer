// Included only in the website bundle. CSV and normal viewing need no workbook engine.
var WorkbenchSpreadsheet=(()=>{
  const asset=/*SPREADSHEET_ASSET*/null;let task=null;
  return ()=>{
    if(task)return task;
    if(typeof window.WorkbenchSheetJSFactory==='function')return task=Promise.resolve().then(()=>window.WorkbenchSheetJSFactory(Ui,H$)).catch(error=>{task=null;throw error;});
    task=new Promise((resolve,reject)=>{
      const script=document.createElement('script'),timer=setTimeout(()=>finish(new Error('Excel功能下载超时，请重试。')),45000);let done=false;
      function finish(error){if(done)return;done=true;clearTimeout(timer);if(error){script.remove();task=null;reject(error);return;}try{if(typeof window.WorkbenchSheetJSFactory!=='function')throw new Error('Excel功能未能加载，请重试。');resolve(window.WorkbenchSheetJSFactory(Ui,H$));}catch(e){task=null;reject(e);}}
      script.src=new URL(asset.url,location.href).href;script.integrity=asset.integrity;script.crossOrigin='anonymous';script.onload=()=>finish();script.onerror=()=>finish(new Error('Excel功能下载失败，请检查网络后重试。'));document.head.appendChild(script);
    });return task;
  };
})();
