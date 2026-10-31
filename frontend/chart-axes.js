// Axis text has its own formatting and margin budget; original values stay exact.
var ChartAxes = (() => {
  function ticks(min,max,count=6){
    const step=(max-min)/(count-1),digits=Math.max(0,Math.min(10,Math.ceil(-Math.log10(Math.abs(step)||1))));
    return Array.from({length:count},(_,i)=>{const value=min+(max-min)*i/(count-1);let label=value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
      if(label.length>23||Math.max(Math.abs(min),Math.abs(max))>0&&Math.max(Math.abs(min),Math.abs(max))<1e-5||Math.ceil(-Math.log10(Math.abs(step)||1))>10){const precision=Math.max(3,Math.min(15,Math.ceil(Math.log10(Math.max(Math.abs(min),Math.abs(max))/Math.abs(step)))+1));label=value.toExponential(precision);}
      return {value,label};});
  }
  const left=ticks=>Math.max(100,Math.min(270,Math.max(...ticks.map(t=>t.label.length),1)*8+55));
  function label(value,height,font=13){let width=0,result='';for(const c of String(value)){width+=/[\u2e80-\uffff]/.test(c)?font:font*.58;if(width>height-20)return result+'…';result+=c;}return result;}
  return {ticks,left,label};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ChartAxes;
