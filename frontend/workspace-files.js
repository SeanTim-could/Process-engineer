// Office-style file association. Handles stay in the account-local database,
// outside exported workspace JSON; every disk write requires a user action.
var WorkspaceFiles = (() => {
  const R=Se(),h=R.createElement,entries=new Map(),metaKey="current-document-file";
  const scope=()=>AccountAuth.storageKey(),supported=()=>typeof window.showSaveFilePicker==="function"&&window.isSecureContext;
  function item(){const id=scope();if(!entries.has(id))entries.set(id,{id,info:null,loaded:false,loading:null,revision:null});return entries.get(id);}
  function notify(){window.dispatchEvent(new Event("workbench-file-status"));}
  async function meta(mode,value){const db=await YG();return new Promise((resolve,reject)=>{const tx=db.transaction("state",mode==="get"?"readonly":"readwrite"),store=tx.objectStore("state");let result;
    if(mode==="get"){const get=store.get(metaKey);get.onsuccess=()=>{result=get.result;};}else if(mode==="delete")store.delete(metaKey);else store.put(value,metaKey);
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error("无法记住当前文件位置。"));tx.onabort=tx.onerror;
  });}
  async function init(){const e=item();if(e.loaded)return e;if(e.loading)return e.loading;
    e.loading=(async()=>{try{const info=await meta("get");if(entries.get(e.id)!==e)return item();if(info&&typeof info.name==="string")e.info=info;const workspace=await KG();AccountAuth.assertWorkspace(e.id);if(entries.get(e.id)===e){e.revision=workspace.revision;AnalysisDrafts.seed(workspace.state.analytics?.drafts);}}catch{}finally{e.loaded=true;notify();}return e;})();return e.loading;
  }
  function changed(revision){const e=item();if(e.revision!==revision){e.revision=revision;notify();}}
  function hasUnsaved(){try{const e=item();return !!e.info&&e.info.savedRevision!==e.revision;}catch{return false;}}
  async function forget(){const id=scope(),e={id,info:null,loaded:true,loading:null,revision:item().revision};entries.set(id,e);notify();try{await meta("delete");}catch{}return e;}
  async function remember(info,id){AccountAuth.assertWorkspace(id);const e=item();e.info=info;e.loaded=true;notify();let remembered=true;try{await meta("put",info);}catch{remembered=false;}return remembered;}
  async function writePermission(handle){if(typeof handle.queryPermission!=="function")return;const options={mode:"readwrite"};let permission=await handle.queryPermission(options);if(permission!=="granted")permission=await handle.requestPermission(options);if(permission!=="granted")throw new Error("未获得文件写入权限，请点击“另存为”选择可写位置。");}
  function filename(){const e=item();return e.info?.name||"工程师工作台"+(AccountAuth.decorate({}).employeeId?"_"+AccountAuth.decorate({}).employeeId:"")+".json";}
  async function save(asNew=false){
    const id=scope();await init();AccountAuth.assertWorkspace(id);let current=item().info;
    if(!asNew&&current?.handle){const latest=await meta("get");if(!latest||latest.bindingId!==current.bindingId)throw new Error("当前文件已在其他窗口切换，请刷新并核对当前工作空间后再保存，或使用另存为。");current=latest;item().info=latest;}
    let handle=!asNew?current?.handle:null;
    if(!handle&&supported())handle=await window.showSaveFilePicker({suggestedName:filename(),types:[{description:"工作台数据文件",accept:{"application/json":[".json"]}}],excludeAcceptAllOption:true});
    AccountAuth.assertWorkspace(id);
    if(handle)await writePermission(handle);
    AccountAuth.assertWorkspace(id);const backup=await M$();AccountAuth.assertWorkspace(id);
    if(!handle){const name=filename();N$(backup,name);await remember({name,bindingId:crypto.randomUUID(),kind:"download",savedRevision:backup.workspaceRevision,savedAt:new Date().toISOString()},id);return "已下载工作台副本“"+name+"”。此浏览器不支持直接写回文件；后续保存会下载新副本，可用 Chrome 或 Edge 选择文件位置。";}
    if(!asNew&&current?.handle&&Number.isFinite(current.lastModified)){
      let file;try{file=await handle.getFile();}catch{throw new Error("原文件已不存在或不可访问，请点击“另存为”选择新位置。");}
      if(file.lastModified!==current.lastModified||file.size!==current.size)throw new Error("当前文件已在工作台外被修改，请先打开该文件核对，或另存为新文件，避免覆盖外部修改。");
    }
    AccountAuth.assertWorkspace(id);let writable;
    try{writable=await handle.createWritable();AccountAuth.assertWorkspace(id);await writable.write(JSON.stringify(backup,null,2));AccountAuth.assertWorkspace(id);if(!asNew&&current?.handle){const latest=await meta("get");if(!latest||latest.bindingId!==current.bindingId)throw new Error("保存期间其他窗口切换了当前文件，本次写入已取消，请核对后重试。");}await writable.close();writable=null;}
    catch(error){if(writable)await writable.abort().catch(()=>{});if(error.name==="NotAllowedError")throw new Error("文件无法写入，请检查权限或点击“另存为”。");throw error;}
    const file=await handle.getFile();AccountAuth.assertWorkspace(id);
    const remembered=await remember({handle,bindingId:!asNew&&current?.handle?current.bindingId??crypto.randomUUID():crypto.randomUUID(),name:handle.name,kind:"file",lastModified:file.lastModified,size:file.size,savedRevision:backup.workspaceRevision,savedAt:new Date().toISOString()},id);
    return (asNew?"已另存为“":"已保存到“")+handle.name+"”。"+(remembered?"后续“保存”将更新这个文件。":"文件已写入，但浏览器未能记住文件位置；重新打开网页后需再次选择。");
  }
  async function chooseOpen(){const id=scope(),[handle]=await window.showOpenFilePicker({multiple:false,types:[{description:"工作台数据文件",accept:{"application/json":[".json"]}}],excludeAcceptAllOption:true});AccountAuth.assertWorkspace(id);return {handle,file:await handle.getFile(),scope:id};}
  async function opened(file,handle,id=scope()){AccountAuth.assertWorkspace(id);const workspace=await KG();AccountAuth.assertWorkspace(id);return remember({...(handle?{handle}:{}),bindingId:crypto.randomUUID(),name:file.name,kind:handle?"file":"unbound",lastModified:file.lastModified,size:file.size,savedRevision:handle?workspace.revision:null,savedAt:handle?new Date().toISOString():null},id);}
  function shortcuts(save,saveAs,busy){const handler=event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==="s"){event.preventDefault();if(!busy&&!event.repeat)(event.shiftKey?saveAs:save)();}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);}
  function Status(){const [,refresh]=R.useState(0);R.useEffect(()=>{let live=true;init().then(()=>{if(live)refresh(n=>n+1);});const change=()=>{if(live)refresh(n=>n+1);},focus=()=>{const id=scope();KG().then(w=>{if(live&&scope()===id)changed(w.revision);}).catch(()=>{});},visible=()=>{if(!document.hidden)focus();};window.addEventListener("workbench-file-status",change);window.addEventListener("offline-pending-save",change);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visible);return()=>{live=false;window.removeEventListener("workbench-file-status",change);window.removeEventListener("offline-pending-save",change);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visible);};},[]);
    const e=item(),info=e.info,dirty=F1()||info?.savedRevision!==e.revision;
    const text=!info?"未命名 · 尚未保存为文件":info.kind==="download"?"副本："+info.name+"（下载模式）":info.kind==="unbound"?"已打开："+info.name+"（保存时选择位置）":info.name+(dirty?" · 有更改未保存":" · 已保存");
    return h("span",{className:"workspace-file-status",role:"status",title:text},text+(A0().mode==="temporary"?"（自动恢复不可用，请保存文件）":""));
  }
  return {save,Status,changed,forget,chooseOpen,opened,shortcuts,hasUnsaved};
})();
