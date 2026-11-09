// Keep date pickers above clipping panels and within the visible viewport.
var CalendarOverlay=(()=>{
 const R=Se(),h=R.createElement,roots=new WeakMap(),MARGIN=8,GAP=8;
 function contains(anchor,target){return !!anchor&&!!target&&!!roots.get(anchor)?.contains(target);}
 function Popover({anchor,onClose,className='',children,...props}){
  const ref=R.useRef(null),close=R.useRef(onClose),id='calendar-'+R.useId().replace(/:/g,''),[position,setPosition]=R.useState(null);close.current=onClose;
  R.useLayoutEffect(()=>{
   const el=ref.current,button=anchor.current;if(!el||!button)return;roots.set(button,el);const priorControls=button.getAttribute('aria-controls');button.setAttribute('aria-controls',id);let frame=null;
   function place(){
    frame=null;const viewport=window.visualViewport,width=viewport?.width??document.documentElement.clientWidth,height=viewport?.height??innerHeight,vx=viewport?.offsetLeft??0,vy=viewport?.offsetTop??0,maxWidth=Math.max(1,width-MARGIN*2),maxHeight=Math.max(1,height-MARGIN*2);
    el.style.setProperty('--calendar-max-width',maxWidth+'px');el.style.setProperty('--calendar-max-height',maxHeight+'px');
    const a=button.getBoundingClientRect(),p=el.getBoundingClientRect(),left=Math.max(vx+MARGIN,Math.min(width<=600?vx+(width-p.width)/2:a.left,vx+width-p.width-MARGIN)),below=a.bottom+GAP,above=a.top-GAP-p.height;
    const preferred=width<=600?vy+(height-p.height)/2:below+p.height<=vy+height-MARGIN?below:above>=vy+MARGIN?above:vy+(height-p.height)/2,top=Math.max(vy+MARGIN,Math.min(preferred,vy+height-p.height-MARGIN)),next={left:Math.round(left),top:Math.round(top)};
    setPosition(old=>old&&old.left===next.left&&old.top===next.top?old:next);
   }
   const schedule=()=>{if(frame===null)frame=requestAnimationFrame(place);};place();const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(el);observer?.observe(button);
   window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
   const selected=el.querySelector('[aria-pressed="true"],.calendar-months .selected')??el.querySelector('select,button,input');selected?.focus({preventScroll:true});
   return()=>{observer?.disconnect();if(frame!==null)cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);roots.delete(button);if(priorControls===null)button.removeAttribute('aria-controls');else button.setAttribute('aria-controls',priorControls);};
  },[anchor,id]);
  function key(event){
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();return;}
   if(event.key!=='Tab')return;const nodes=[...ref.current.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=nodes[0],last=nodes.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();event.stopPropagation();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();event.stopPropagation();first?.focus();}
  }
  // Reuse the ReactDOM portal already bundled for chart tooltips.
  return i9.createPortal(h('div',{...props,ref,id,className:className+' calendar-floating','aria-modal':'true',style:{'--calendar-left':(position?.left??MARGIN)+'px','--calendar-top':(position?.top??MARGIN)+'px',visibility:position?'visible':'hidden'},onKeyDownCapture:key},children),document.body);
 }
 return {Popover,contains};
})();
