// Remember each device's filters and reuse a few loaded series in this mounted
// workspace only. Source data and account identities are never persisted here.
var WorkspaceMemory = (() => {
  const R=Se(),epochs=new Map(),channels=new Map(),eventName='workbench-series-changed';
  const dataPaths=new Set(['/api/series','/api/calculations','/api/settings','/api/offline/restore','/api/offline/merge','/api/excel-sync','/api/live-data','/api/formula-health','/api/records','/api/state']);
  function changed(path,exclusionsChanged=false) {
    // Filters, notes, saved recipes and drafts do not invalidate measurements.
    if(!dataPaths.has(path)&&!(path==='/api/analytics'&&exclusionsChanged))return;
    const namespace=AccountAuth.storageKey();
    epochs.set(namespace,(epochs.get(namespace)??0)+1);
    window.dispatchEvent(new CustomEvent(eventName,{detail:{namespace}}));
    try{channels.get(namespace)?.channel.postMessage('changed');}catch{}
  }
  function create(namespace) {
    const views=new Map(),series=new Map();let cells=0;
    return {
      remember(view){if(view.unitId)views.set(view.unitId,{...view});},
      select(unit,dataset,fallback){
        const saved=views.get(unit);
        if(!saved||saved.sourceId!==fallback.sourceId)return {...fallback,month:fallback.to.slice(0,7)};
        return {...saved,unitId:unit,group:dataset&&!dataset.groups.includes(saved.group)?dataset.groups[0]??'':saved.group};
      },
      get(id,tag){const value=series.get(id);return value?.tag===tag?value.data:null;},
      put(id,tag,data){
        const cost=data.points.length*(data.dataset.columns.length+4);
        if(series.has(id)){cells-=series.get(id).cost;series.delete(id);}
        // Bound retained memory: large single histories still load normally.
        if(cost>1500000)return;
        while(series.size&&(series.size>=3||cells+cost>1500000)){
          const first=series.keys().next().value;cells-=series.get(first).cost;series.delete(first);
        }
        series.set(id,{tag,data,cost});cells+=cost;
      },
      clear(){series.clear();cells=0;},
      namespace
    };
  }
  function useStore(scope){
    const namespace=AccountAuth.storageKey(),ref=R.useRef(null);
    if(!ref.current||ref.current.namespace!==namespace||ref.current.scope!==scope)
      ref.current={...create(namespace),scope};
    const [version,setVersion]=R.useState(()=>epochs.get(namespace)??0);
    R.useEffect(()=>{
      const change=e=>{if(e.detail.namespace===namespace)setVersion(epochs.get(namespace)??0);};
      window.addEventListener(eventName,change);
      let shared=channels.get(namespace);
      if(!shared&&typeof BroadcastChannel==='function')try{
        const channel=new BroadcastChannel('workbench-series:'+namespace);
        channel.onmessage=()=>{
          epochs.set(namespace,(epochs.get(namespace)??0)+1);
          window.dispatchEvent(new CustomEvent(eventName,{detail:{namespace}}));
        };
        shared={channel,users:0};channels.set(namespace,shared);
      }catch{}
      if(shared)shared.users++;
      return()=>{
        window.removeEventListener(eventName,change);
        if(shared&&!--shared.users){shared.channel.close();channels.delete(namespace);}
      };
    },[namespace]);
    return {...ref.current,version};
  }
  return {changed,useStore};
})();
