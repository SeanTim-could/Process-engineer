// Axis text has its own formatting and margin budget; original values stay exact.
var ChartAxes = (() => {
  function ticks(min,max,count=6){
    const step=(max-min)/(count-1),magnitude=Math.floor(Math.log10(Math.abs(step)||1)),quarter=Math.abs(Math.abs(step)/10**magnitude-2.5)<1e-8,digits=Math.max(0,Math.min(10,quarter?1-magnitude:Math.ceil(-Math.log10(Math.abs(step)||1))));
    return Array.from({length:count},(_,i)=>{const value=min+(max-min)*i/(count-1);let label=value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
      if(label.length>23||Math.max(Math.abs(min),Math.abs(max))>0&&Math.max(Math.abs(min),Math.abs(max))<1e-5||Math.ceil(-Math.log10(Math.abs(step)||1))>10){const precision=Math.max(3,Math.min(15,Math.ceil(Math.log10(Math.max(Math.abs(min),Math.abs(max))/Math.abs(step)))+1));label=value.toExponential(precision);}
      return {value,label};});
  }
  const left=(ticks,compact=false)=>Math.max(compact?76:100,Math.min(270,Math.max(...ticks.map(t=>t.label.length),1)*(compact?7:8)+(compact?45:55)));
  function label(value,height,font=13){let width=0,result='';for(const c of String(value)){width+=/[\u2e80-\uffff]/.test(c)?font:font*.58;if(width>height-20)return result+'…';result+=c;}return result;}
  function numeric(min,max,{count=6,zero=false,padding=.08,integer=false}={}){
    if(!Number.isFinite(min)||!Number.isFinite(max))min=0,max=1;
    if(min>max)[min,max]=[max,min];const low=min,high=max;
    const pad=max>min?(max-min)*padding:(Math.abs(min)||1)*.01;min-=pad;max+=pad;
    if(zero){min=Math.min(0,min);max=Math.max(0,max);if(low>=0)min=0;if(high<=0)max=0;}
    const span=max-min;if(!(span>0)||!Number.isFinite(span))throw new Error('数值范围过大，请缩小数据范围后绘图。');
    const raw=span/(count-1),power=10**Math.floor(Math.log10(raw)),nice=([1,2,2.5,5,10].find(v=>v*power>=raw*(1-1e-12))??10)*power,step=integer?Math.max(1,Math.ceil(nice)):nice;
    let a=Math.floor(min/step)*step,b=Math.ceil(max/step)*step;
    if(!Number.isFinite(a)||!Number.isFinite(b)||!(b>a))a=min,b=max;
    const n=Math.round((b-a)/step)+1;if(n<2||n>30)return {min,max,ticks:ticks(min,max,count)};
    // Interpolating nice endpoints retains round labels without rounding observations.
    return {min:a,max:b,ticks:ticks(a,b,n)};
  }
  function timeTicks(min,max,width=700,maxCount=6){
    if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return [];
    const offset=28800000,day=86400000,span=max-min,local=t=>new Date(t+offset),sameDay=local(min).toISOString().slice(0,10)===local(max).toISOString().slice(0,10),gap=span<60000?112:span<2*day&&!sameDay?112:span<day?72:span>180*day?88:72,count=Math.max(2,Math.min(maxCount,Math.floor(width/gap)+1)),target=span/(count-1);
    const choices=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,15000,30000,60000,120000,300000,600000,900000,1800000,3600000,7200000,10800000,21600000,43200000,day,2*day,7*day,14*day,30.4375*day,60.875*day,91.3125*day,182.625*day,365.25*day,730.5*day,1826.25*day];
    const step=choices.reduce((best,v)=>Math.abs(Math.log(v/(target||1)))<Math.abs(Math.log(best/(target||1)))?v:best,choices[0]),values=[];
    if(step>=30*day){
      const months=step>=1826*day?60:step>=730*day?24:step>=365*day?12:step>=182*day?6:step>=91*day?3:step>=60*day?2:1,start=local(min);let index=Math.floor((start.getUTCFullYear()*12+start.getUTCMonth())/months)*months;
      for(let i=0;i<50;i++,index+=months){const t=Date.UTC(Math.floor(index/12),index%12,1)-offset;if(t>max)break;if(t>=min)values.push(t);}
    }else{
      const anchor=step>=7*day?Date.UTC(1970,0,5)-offset:-offset;let at=anchor+Math.ceil((min-anchor)/step)*step;
      for(let i=0;i<50&&at<=max;i++,at+=step)values.push(at);
    }
    if(!values.length)values.push(min);if(values.length===1&&span>0&&width>=2*gap&&Math.abs(max-values[0])/span*width>=gap)values.push(max);
    const format=t=>{const s=local(t).toISOString();if(step>=365*day)return s.slice(0,4);if(step>=30*day)return s.slice(0,7);if(span>=2*day||step>=day)return s.slice(5,10);const hms=step<1000?s.slice(11,23):step<60000||s.slice(17,23)!=='00.000'?s.slice(11,19):s.slice(11,16);return sameDay?hms:s.slice(5,10)+' '+hms;};
    return values.map(value=>({value,label:format(value)})).filter((t,i,all)=>i===0||(t.value-all[i-1].value)/(span||1)*width>=gap*.6);
  }
  function useWidth(ref,fallback=1000,enabled=true){
    const R=Se(),[width,setWidth]=R.useState(fallback);
    R.useLayoutEffect(()=>{if(!enabled||!ref.current)return;const node=ref.current,measure=()=>{const css=getComputedStyle(node),next=Math.round(node.clientWidth-parseFloat(css.paddingLeft||0)-parseFloat(css.paddingRight||0));if(next>0)setWidth(Math.max(280,next));};measure();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[enabled]);
    return enabled?width:fallback;
  }
  return {ticks,left,label,numeric,timeTicks,useWidth};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ChartAxes;
