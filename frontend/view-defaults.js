// Calendar-month defaults in Beijing time. No mutation of stored measurements.
var ViewDefaults = (() => {
  function range(now=Date.now()) {
    const end=new Date(now+28800000),day=end.getUTCDate(),start=new Date(end);
    start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-1);
    const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,last));start.setUTCHours(0,0,0,0);
    const format=d=>d.toISOString().slice(0,16).replace('T',' ');
    return {from:format(start),to:format(end)};
  }
  function today(now=Date.now()){const day=new Date(now+28800000);day.setUTCHours(0,0,0,0);const from=day.toISOString().slice(0,16);day.setUTCDate(day.getUTCDate()+1);return {from,to:day.toISOString().slice(0,16),exclusive:true};}
  function analysis(){const r=range();return {from:r.from.replace(' ','T'),to:r.to.replace(' ','T')};}
  // Tab-local UI choices, separated by account. No readings or identities are
  // stored here; closing the tab ends this navigation session.
  const sessions=new Map();
  const namespace=()=>AccountAuth.storageKey();
  function entries(){
    const id=namespace();if(!sessions.has(id)){
      let rows=[];try{const parsed=JSON.parse(sessionStorage.getItem('workbench-view-session:'+id)||'[]');if(Array.isArray(parsed))rows=parsed.filter(r=>Array.isArray(r)&&typeof r[0]==='string');}catch{}
      sessions.set(id,new Map(rows));
    }return sessions.get(id);
  }
  function read(key){const value=entries().get(key);return value===undefined?undefined:structuredClone(value);}
  function remember(key,value){
    const rows=entries();rows.delete(key);rows.set(key,structuredClone(value));
    // Retain every current-tab choice in memory; bound only the reload mirror.
    try{const mirror=[...rows].slice(-1024);let json=JSON.stringify(mirror);while(json.length>524288&&mirror.length>1){mirror.shift();json=JSON.stringify(mirror);}sessionStorage.setItem('workbench-view-session:'+namespace(),json);}catch{}
    return value;
  }
  function useState(key,initial){
    const R=Se(),scope=namespace(),id=scope+':'+key,ref=R.useRef(null),[,render]=R.useState(0);
    if(ref.current?.id!==id)ref.current={id,value:read(key)??(typeof initial==='function'?initial():initial)};
    const set=R.useCallback(change=>{
      if(ref.current.id!==id||namespace()!==scope)return;
      const next=typeof change==='function'?change(ref.current.value):change;
      if(Object.is(ref.current.value,next))return;
      ref.current.value=next;remember(key,next);render(n=>n+1);
    },[id]);
    return [ref.current.value,set];
  }
  function useRemember(key,value,enabled=true){const R=Se(),signature=JSON.stringify(value);R.useLayoutEffect(()=>{if(enabled)remember(key,value);},[key,signature,enabled]);}
  function useOpeningRange(page,ready,update,view,scope='production') {
    const R=Se(),previous=R.useRef(null);
    R.useLayoutEffect(()=>{
      // Imports can update the shared workspace while another tool is open.
      // Always restore this page's selection when returning from that tool.
      if(!ready||!view||scope==='production'&&page==='lims'||!['overview','trends','data','charts','lims','reports'].includes(page)){previous.current=null;return;}
      const key='workspace:'+scope+':'+page+':'+view.unitId;
      if(previous.current!==key){
        previous.current=key;
        const saved=read(key),initial=range(),selected=saved??{...initial,month:initial.to.slice(0,7)};
        remember(key,selected);
        if(selected.from!==view.from||selected.to!==view.to||selected.month!==view.month)update(selected);
      }else remember(key,{from:view.from,to:view.to,month:view.month});
    },[page,ready,view?.unitId,view?.from,view?.to,view?.month]);
  }
  return {range,analysis,today,useOpeningRange,read,remember,useState,useRemember};
})();

if(typeof module!=='undefined'&&module.exports)module.exports=ViewDefaults;
