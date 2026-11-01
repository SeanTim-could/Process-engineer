// Visual feedback only. Native form submission and credential handling stay intact.
(() => {
  if(window.WorkbenchLoginPress)return;
  window.WorkbenchLoginPress=true;
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  motion?.addEventListener?.('change',event=>{if(event.matches)for(const target of document.querySelectorAll('.login-submit'))target.classList.remove('login-rippling','login-keypress');});
  const button=event=>{const target=event.target?.closest?.('button.login-submit');return target&&!target.disabled?target:null;};
  function ripple(target,x,y){
    if(motion?.matches)return;
    const box=target.getBoundingClientRect(),w=target.offsetWidth,h=target.offsetHeight;
    const px=x===undefined?w/2:Math.max(0,Math.min(w,(x-box.left)*w/box.width)),py=y===undefined?h/2:Math.max(0,Math.min(h,(y-box.top)*h/box.height));
    target.style.setProperty('--press-x',px+'px');target.style.setProperty('--press-y',py+'px');target.style.setProperty('--press-size',Math.ceil(2*Math.hypot(Math.max(px,w-px),Math.max(py,h-py)))+'px');
    target.classList.remove('login-rippling');void target.offsetWidth;target.classList.add('login-rippling');
  }
  document.addEventListener('pointerdown',event=>{const target=button(event);if(target&&event.button===0)ripple(target,event.clientX,event.clientY);},true);
  document.addEventListener('click',event=>{const target=button(event);if(target&&event.detail===0)ripple(target);},true);
  document.addEventListener('keydown',event=>{const target=button(event);if(target&&['Enter',' '].includes(event.key))target.classList.add('login-keypress');},true);
  const release=event=>event.target?.closest?.('button.login-submit')?.classList.remove('login-keypress');
  document.addEventListener('keyup',release,true);document.addEventListener('blur',release,true);
  const clear=event=>{if(event.animationName==='login-ripple')event.target.classList.remove('login-rippling');};
  document.addEventListener('animationend',clear,true);document.addEventListener('animationcancel',clear,true);
})();
