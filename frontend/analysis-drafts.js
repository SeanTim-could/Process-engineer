// Analysis forms are workspace data, isolated by the authenticated account.
var AnalysisDrafts = (() => {
  const R=Se(),cache=new Map(),modes=["timeseries","capability","plotting"];
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const obj=v=>v&&typeof v==="object"&&!Array.isArray(v);
  const str=(v,max=100)=>{if(v===undefined||v===null)return "";if(typeof v!=="string"||v.length>max)throw new Error("分析设置格式无效。");return v;};
  function source(v){const s=str(v,200);if(s&&!/^(ds_[\w-]+|raw:[a-zA-Z0-9_-]{1,40})$/.test(s))throw new Error("分析来源格式无效。");return s;}
  function key(v){const s=str(v);if(s&&!/^\w{1,100}$/.test(s))throw new Error("分析指标格式无效。");return s;}
  function numberText(v){if(typeof v==="number"&&Number.isFinite(v))return String(v);return str(v,80);}
  function normalize(value){
    if(value===undefined)return {};
    if(!obj(value)||Object.keys(value).some(k=>!modes.includes(k)))throw new Error("分析工作状态格式无效。");
    return Object.fromEntries(Object.entries(value).map(([mode,d])=>{
      if(!obj(d))throw new Error("分析工作状态格式无效。");const out={};
      if(d.config!==undefined){const c=d.config;if(!obj(c)||!Array.isArray(c.keys)||c.keys.length>6||new Set(c.keys).size!==c.keys.length)throw new Error("分析指标设置格式无效。");
        const palette=str(c.palette,40);out.config={sourceId:source(c.sourceId),keys:c.keys.map(key),title:str(c.title,120),type:["line","area","bar","scatter","histogram","box"].includes(c.type)?c.type:"line",group:str(c.group),allGroups:c.allGroups===true,from:str(c.from,23),to:str(c.to,23),xKey:key(c.xKey),normalized:c.normalized===true,palette:Object.hasOwn(AnalysisPlots.palettes,palette)?palette:"coast",period:["day","week","month","all"].includes(c.period)?c.period:"day",aggregation:c.aggregation==="sum"?"sum":"mean",boxBy:c.boxBy==="group"?"group":"metric",capabilitySize:c.capabilitySize===""?"":Number.isInteger(c.capabilitySize)&&c.capabilitySize>=1&&c.capabilitySize<=100?c.capabilitySize:1,bins:Number.isInteger(c.bins)&&c.bins>=0&&c.bins<=100?c.bins:0,lsl:numberText(c.lsl),usl:numberText(c.usl)};
      }
      if(d.workspace!==undefined){const w=d.workspace;if(!obj(w)||!obj(w.period)||!obj(w.afterChoice))throw new Error("能力分析工作状态格式无效。");
        out.workspace={period:{mode:["split","periods","datasets"].includes(w.period.mode)?w.period.mode:"split",...Object.fromEntries(["split","beforeFrom","beforeTo","afterFrom","afterTo"].map(k=>[k,str(w.period[k],23)]))},size:str(w.size,5),target:numberText(w.target),alpha:[.01,.05,.1].includes(w.alpha)?w.alpha:.05,afterChoice:{sourceId:source(w.afterChoice.sourceId),key:key(w.afterChoice.key),group:str(w.afterChoice.group),from:str(w.afterChoice.from,23),to:str(w.afterChoice.to,23)},splitReady:w.splitReady===true,detailsOpen:w.detailsOpen===true};
      }
      if(d.editing!==undefined){if(d.editing!==null&&!/^chart_[\w-]{1,80}$/.test(d.editing))throw new Error("图表编辑状态无效。");out.editing=d.editing;}
      if(d.updatedAt!==undefined){if(typeof d.updatedAt!=="string"||!Number.isFinite(Date.parse(d.updatedAt)))throw new Error("分析设置保存时间无效。");out.updatedAt=d.updatedAt;}
      return [mode,out];
    }));
  }
  const scope=()=>AccountAuth.storageKey();
  const mirrorKey=id=>"workbench-analysis-recovery:"+id;
  function mirror(forms,id){try{localStorage.setItem(mirrorKey(id),JSON.stringify(forms));}catch{}}
  function entry(){const id=scope();if(!cache.has(id)){let forms={};try{forms=normalize(JSON.parse(localStorage.getItem(mirrorKey(id))||"{}"));}catch{}cache.set(id,{forms,dirty:new Set(),recovered:new Set(Object.keys(forms)),errors:{},epoch:crypto.randomUUID()});}return cache.get(id);}
  function notify(mode,id=scope()){window.dispatchEvent(new CustomEvent("analysis-draft-change",{detail:{scope:id,mode}}));}
  function sameScope(id){try{return scope()===id;}catch{return false;}}
  function read(mode){return entry().forms[mode];}
  function seed(value){const forms=normalize(value),e=entry(),id=scope();for(const mode of modes){const incoming=forms[mode],old=e.forms[mode];if(!e.dirty.has(mode)){
      if(incoming&&(!old||(incoming.updatedAt??"")>(old.updatedAt??""))){e.forms[mode]=incoming;notify(mode);}
      else if(e.recovered.has(mode)&&old&&!equal(old,incoming)){e.dirty.add(mode);schedule(mode,old,e,id);}
    }e.recovered.delete(mode);}mirror(e.forms,id);}
  function patch(mode,part){
    const e=entry(),id=scope(),draft=normalize({[mode]:{...e.forms[mode],...part}})[mode];
    if(equal(draft,e.forms[mode]))return;
    draft.updatedAt=new Date().toISOString();e.forms[mode]=draft;e.dirty.add(mode);delete e.errors[mode];mirror(e.forms,id);notify(mode);schedule(mode,draft,e,id);
  }
  function schedule(mode,draft,e,id){
    R1("analytics-draft:"+id+":"+mode,async()=>{
      if(cache.get(id)!==e||!sameScope(id))return;AccountAuth.assertWorkspace(id);
      try{const r=await T0("/api/analytics",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"draft",mode,draft,clientEpoch:e.epoch})}),data=await r.json();if(!r.ok)throw new Error(data.error);
        if(cache.get(id)===e&&e.forms[mode]===draft&&!data.discarded){e.forms[mode]=data.draft;e.dirty.delete(mode);delete e.errors[mode];notify(mode,id);}
      }catch(error){if(!sameScope(id))return;if(cache.get(id)===e){e.errors[mode]=error.message;notify(mode,id);}throw error;}
    });
  }
  function reset(value){const id=scope();for(const [key,pending]of kf)if(key.startsWith("analytics-draft:"+id+":")){if(pending.timer)clearTimeout(pending.timer);kf.delete(key);}const forms=normalize(value);cache.set(id,{forms,dirty:new Set(),recovered:new Set(),errors:{},epoch:crypto.randomUUID()});mirror(forms,id);P1();for(const mode of modes)notify(mode);}
  async function resume(){const id=scope(),workspace=await KG();AccountAuth.assertWorkspace(id);seed(workspace.state.analytics?.drafts);}
  function accepts(epoch){return !epoch||epoch===entry().epoch;}
  function usePart(mode,part,defaults){
    const fallback=R.useRef(defaults),[value,setValue]=R.useState(()=>read(mode)?.[part]??defaults),ref=R.useRef(value);
    R.useEffect(()=>{const id=scope(),load=event=>{if(event.detail.scope!==id||event.detail.mode!==mode)return;const next=cache.get(id)?.forms[mode]?.[part]??fallback.current;if(!equal(ref.current,next)){ref.current=next;setValue(next);}};window.addEventListener("analysis-draft-change",load);return()=>window.removeEventListener("analysis-draft-change",load);},[mode,part]);
    const update=R.useCallback(change=>{const next=typeof change==="function"?change(ref.current):change;if(equal(ref.current,next))return;ref.current=next;setValue(next);patch(mode,{[part]:next});},[mode,part]);
    return [value,update];
  }
  function Notice({mode}){const [error,setError]=R.useState("");R.useEffect(()=>{const id=scope(),listen=()=>setError(cache.get(id)?.errors[mode]??"");window.addEventListener("analysis-draft-change",listen);listen();return()=>window.removeEventListener("analysis-draft-change",listen);},[mode]);return error?R.createElement("p",{className:"error-banner",role:"alert"},"分析设置尚未写入自动恢复缓存："+error,R.createElement("button",{className:"button",onClick:()=>Ei().catch(()=>{})},"重试")):null;}
  return {normalize,read,seed,patch,reset,accepts,usePart,Notice,resume};
})();
