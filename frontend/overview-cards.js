// Device/account-scoped display preferences. Never write measurements or schemas.
var OverviewCards=(()=>{
  const R=Se(),h=R.createElement,Context=R.createContext(null),ItemContext=R.createContext(null);
  const empty=()=>({hiddenGroups:[],hiddenCards:[],orders:{},columns:1});
  const previewTransform=({x,y})=>`translate(${Math.max(8,Math.min(x+12,innerWidth-252))}px,${Math.max(8,Math.min(y+12,innerHeight-80))}px)`;
  function read(key){try{const p=JSON.parse(localStorage.getItem(key));if(!p||!Array.isArray(p.hiddenGroups)||!Array.isArray(p.hiddenCards))return empty();return {hiddenGroups:p.hiddenGroups.filter(g=>typeof g==='string'),hiddenCards:p.hiddenCards.filter(c=>c&&typeof c.id==='string'&&typeof c.label==='string'),orders:Object.fromEntries(Object.entries(p.orders??{}).filter(([k,v])=>['kpi','chart'].includes(k)&&Array.isArray(v)).map(([k,v])=>[k,v.filter(id=>typeof id==='string')])),columns:[1,2,3].includes(p.columns)?p.columns:1};}catch{return empty();}}
  const storageKey=(source,unit)=>AccountAuth.storageKey()+':overview-layout:v1:'+JSON.stringify([source,unit]);
  function fullDataset(dataset){return $r().state.datasets?.[dataset.id]?.dataset??dataset;}
  function Workspace({workspace,trends,render}){
    if(trends)return render(workspace);
    return h(Provider,{key:storageKey(workspace.dataset.id,workspace.view.unitId),workspace,render});
  }
  function Provider({workspace,render}){
    const key=storageKey(workspace.dataset.id,workspace.view.unitId),[prefs,setPrefs]=R.useState(()=>read(key)),[open,setOpen]=R.useState(false),[error,setError]=R.useState(''),[message,setMessage]=R.useState(''),[drag,setDrag]=R.useState(null),active=R.useRef(null),lastMessage=R.useRef(null),preview=R.useRef(null),position=R.useRef({x:0,y:0});
    R.useEffect(()=>{const change=e=>{if(e.key===key){setPrefs(read(key));active.current?.cancel();}};window.addEventListener('storage',change);return()=>{window.removeEventListener('storage',change);active.current?.cancel();clearTimeout(lastMessage.current);};},[key]);
    function save(change){try{const next=change(read(key));localStorage.setItem(key,JSON.stringify(next));setPrefs(next);setError('');return true;}catch{setError(Surface.t('无法保存总览设置，请检查浏览器存储空间。'));return false;}}
    function announce(text){setMessage(Surface.t(text));clearTimeout(lastMessage.current);lastMessage.current=setTimeout(()=>setMessage(''),3000);}
    function reorder(kind,ids,from,to){if(from===to||!ids.includes(from)||!ids.includes(to))return;const next=ids.filter(id=>id!==from);next.splice(next.indexOf(to)+(ids.indexOf(from)<ids.indexOf(to)?1:0),0,from);if(save(p=>({...p,orders:{...p.orders,[kind]:next}})))announce('卡片位置已保存');}
    const unit=workspace.view.unitId;
    const visible=rows=>{const hidden=new Set(prefs.hiddenGroups);return rows.filter(p=>p.unit!==unit||!hidden.has(p.group));};
    const points=R.useMemo(()=>visible(workspace.points),[workspace.points,prefs.hiddenGroups,unit]),allPoints=R.useMemo(()=>visible(workspace.allPoints),[workspace.allPoints,prefs.hiddenGroups,unit]);
    const groups=R.useMemo(()=>[...new Set(workspace.points.filter(p=>p.unit===unit).map(p=>p.group))].sort(),[workspace.points,unit]);
    function dragPosition(x,y){position.current={x,y};if(preview.current)preview.current.style.transform=previewTransform(position.current);}
    const value={prefs,save,setOpen,groups,drag,setDrag,active,reorder,announce,dragPosition};
    return h(Context.Provider,{value},render({...workspace,points,allPoints}),drag&&h('div',{ref:preview,className:'overview-drag-preview','aria-hidden':true,style:{transform:previewTransform(position.current)}},drag.label),h('div',{className:'overview-layout-status',role:'status'},error||message),open&&h(Settings,{onClose:()=>setOpen(false)}));
  }
  function Settings({onClose}){
    const c=R.useContext(Context),{prefs,save}=c;
    return h(Vr,{title:'总览显示与布局',onClose},h('div',{className:'modal-body overview-layout-settings'},
      h('div',{className:'note-line'},'仅影响本设备的运行总览，原始数据保留。'),
      h('h4',null,'显示的数据分组'),
      c.groups.length?c.groups.map(group=>h('label',{key:group,className:'overview-group-option'},h('input',{type:'checkbox',checked:!prefs.hiddenGroups.includes(group),onChange:e=>{const checked=e.target.checked;save(p=>({...p,hiddenGroups:checked?p.hiddenGroups.filter(g=>g!==group):[...new Set([...p.hiddenGroups,group])]}));}}),group||Surface.t('未分组'))):h('div',null,'暂无可显示分组'),
      h('label',{className:'form-label'},'趋势卡片每行数量',h('select',{'aria-label':'趋势卡片每行数量',value:prefs.columns,onChange:e=>{const columns=Number(e.target.value);save(p=>({...p,columns}));}},[1,2,3].map(n=>h('option',{key:n,value:n},n)))),
      h('div',{className:'note-line'},'长按卡片后拖动；键盘聚焦卡片后按 Alt + 方向键调整位置。'),
      h('h4',null,'已隐藏卡片'),prefs.hiddenCards.length?prefs.hiddenCards.map(card=>h('div',{key:card.id,className:'overview-hidden-card'},h('span',null,card.label),h('button',{className:'text-button',onClick:()=>save(p=>({...p,hiddenCards:p.hiddenCards.filter(x=>x.id!==card.id)}))},'恢复显示'))):h('div',null,'没有隐藏的卡片'),
      h('div',{className:'button-row'},h('button',{className:'button small-button',onClick:()=>save(p=>({...p,hiddenGroups:[],hiddenCards:[]}))},'显示全部分组和卡片'),h('button',{className:'button small-button',onClick:()=>save(p=>({...p,orders:{},columns:1}))},'恢复默认排列'))),
      h('div',{className:'modal-footer'},h('button',{className:'button primary',onClick:onClose},'完成')));
  }
  function Controls(){const c=R.useContext(Context);return c&&h('button',{className:'text-button',onClick:()=>c.setOpen(true)},'总览显示与布局');}
  function Tools({fallback=null}){
    const item=R.useContext(ItemContext),c=R.useContext(Context);
    if(!item||!c)return fallback;
    return h('button',{type:'button',className:'overview-hide-button',title:Surface.t('从总览隐藏此卡片，保留数据'),'aria-label':Surface.t('隐藏卡片')+' '+item.label,onClick:()=>{if(c.save(p=>({...p,hiddenCards:[...p.hiddenCards.filter(x=>x.id!==item.id),{id:item.id,label:item.label}]})))c.announce('卡片已隐藏，可在总览显示与布局中恢复');}},h('svg',{width:15,height:15,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},h('path',{d:'M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.8 5.2A12 12 0 0112 5c6 0 10 7 10 7a18 18 0 01-3 3.6M6 6.5A21 21 0 002 12s4 7 10 7a12 12 0 005-1'})));
  }
  function Grid({kind,className,children}){
    const c=R.useContext(Context);
    if(!c)return h('div',{className},children);
    const cards=R.Children.toArray(children).filter(R.isValidElement).map(child=>{
      const p=child.props;
      if(!p['data-overview-key']&&!p.exportUrl)return {child,id:String(child.key),label:'',plain:true};
      const pair=p['data-overview-key']?JSON.parse(p['data-overview-key']):[p.column.key,new URL(p.exportUrl,'http://offline.local').searchParams.get('group')??''];
      return {child,id:JSON.stringify([kind,...pair]),label:p['data-overview-label']??[p.column.label,pair[1]].filter(Boolean).join(' · ')};
    });
    const order=c.prefs.orders[kind]??[],hidden=new Set(c.prefs.hiddenCards.map(x=>x.id)),rank=id=>{const i=order.indexOf(id);return i<0?order.length:i;};
    const visible=cards.filter(card=>!hidden.has(card.id)).sort((a,b)=>rank(a.id)-rank(b.id)),ids=visible.map(card=>card.id);
    return h('div',{className:(className??'')+' overview-card-grid overview-'+kind+'-grid',style:kind==='chart'?{'--overview-columns':c.prefs.columns}:undefined,'data-overview-grid':kind},visible.map(card=>card.plain?card.child:h(Item,{key:card.id,card,kind,ids},card.child)));
  }
  function Item({card,kind,ids,children}){
    const c=R.useContext(Context),ref=R.useRef(null),latest=R.useRef(null),clickBlocked=R.useRef(false);
    latest.current={c,ids,kind,card};
    R.useEffect(()=>{
      const el=ref.current;let pending=null;
      function cancel(){if(!pending)return;clearTimeout(pending.timer);pending=null;latest.current.c.setDrag(null);if(latest.current.c.active.current?.owner===el)latest.current.c.active.current=null;document.body.classList.remove('overview-dragging');}
      function begin(x,y,id,touch){
        latest.current.c.active.current?.cancel();
        pending={x,y,id,touch,started:false,target:card.id};
        pending.timer=setTimeout(()=>{if(!pending)return;pending.started=true;clickBlocked.current=true;latest.current.c.active.current={owner:el,cancel};latest.current.c.dragPosition(x,y);latest.current.c.setDrag({from:card.id,to:card.id,kind,label:card.label});document.body.classList.add('overview-dragging');},450);
      }
      function move(x,y,event){
        if(!pending)return;
        if(!pending.started){if(Math.hypot(x-pending.x,y-pending.y)>9)cancel();return;}
        if(event.cancelable)event.preventDefault();
        latest.current.c.dragPosition(x,y);
        const target=document.elementFromPoint(x,y)?.closest('[data-overview-card]');
        if(target?.dataset.overviewKind===kind&&el.parentElement===target.parentElement){const to=target.dataset.overviewCard;pending.target=to;latest.current.c.setDrag(prev=>prev?.to===to?prev:{from:card.id,to,kind,label:card.label});}
        if(y<70)window.scrollBy(0,-16);else if(y>innerHeight-70)window.scrollBy(0,16);
      }
      function end(){if(!pending)return;const action=pending.started,target=pending.target;cancel();if(action){const v=latest.current;v.c.reorder(v.kind,v.ids,v.card.id,target);setTimeout(()=>{clickBlocked.current=false;},100);}}
      const interactive=target=>target.closest('button,a,input,select,textarea,[role="button"],[role="dialog"],[role="alertdialog"],.modal-scrim,[data-point-selection]');
      function down(e){if(e.button!==0||e.pointerType==='touch'||interactive(e.target))return;clickBlocked.current=false;begin(e.clientX,e.clientY,e.pointerId,false);}
      function pointerMove(e){if(pending&&!pending.touch&&pending.id===e.pointerId)move(e.clientX,e.clientY,e);}
      function pointerEnd(e){if(pending&&!pending.touch&&pending.id===e.pointerId)end();}
      function pointerCancel(e){if(pending&&!pending.touch&&pending.id===e.pointerId)cancel();}
      function touchStart(e){if(e.touches.length!==1||interactive(e.target)){cancel();return;}clickBlocked.current=false;const t=e.touches[0];begin(t.clientX,t.clientY,t.identifier,true);}
      function touchMove(e){if(e.touches.length!==1){cancel();return;}const t=e.touches[0];if(pending?.touch&&pending.id===t.identifier)move(t.clientX,t.clientY,e);}
      function touchEnd(){if(pending?.touch)end();}
      function click(e){if(clickBlocked.current){e.preventDefault();e.stopPropagation();clickBlocked.current=false;}}
      function contextMenu(e){if(pending||clickBlocked.current)e.preventDefault();}
      function key(e){if(e.key==='Escape'){cancel();return;}if(e.target!==el||!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const v=latest.current,at=v.ids.indexOf(v.card.id),step=['ArrowUp','ArrowLeft'].includes(e.key)?-1:1;const to=v.ids[at+step];if(to)v.c.reorder(v.kind,v.ids,v.card.id,to);}
      const events=[[el,'pointerdown',down],[document,'pointermove',pointerMove],[document,'pointerup',pointerEnd],[document,'pointercancel',pointerCancel],[el,'touchstart',touchStart],[document,'touchmove',touchMove],[document,'touchend',touchEnd],[document,'touchcancel',cancel],[el,'click',click,true],[el,'contextmenu',contextMenu],[el,'keydown',key],[window,'blur',cancel]];
      for(const [node,event,fn,capture] of events)node.addEventListener(event,fn,{passive:false,capture:!!capture});
      return()=>{cancel();for(const [node,event,fn,capture] of events)node.removeEventListener(event,fn,!!capture);};
    },[card.id,kind]);
    return h(ItemContext.Provider,{value:card},h('div',{ref,tabIndex:0,className:'overview-card-item'+(c.drag?.from===card.id?' is-lifted':'')+(c.drag?.to===card.id&&c.drag.from!==card.id?' is-drop-target':''),'data-overview-card':card.id,'data-overview-kind':kind,'aria-label':card.label+' · '+Surface.t('长按拖动，Alt + 方向键移动')},children));
  }
  return {Workspace,Controls,Grid,Tools,fullDataset};
})();
