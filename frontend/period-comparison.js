// Shared inline presentation; raw measurements and existing current means stay intact.
var PeriodComparison=(()=>{
  const R=Se(),h=R.createElement;
  const number=value=>!Number.isFinite(value)?'—':value!==0&&Math.abs(value)<.000001?value.toExponential(2):value.toLocaleString('zh-CN',{maximumFractionDigits:Math.abs(value)>0&&Math.abs(value)<.001?8:Math.abs(value)<1?6:3});
  const stamp=value=>AnalysisMath.exactLocal(value).replace('T',' ');
  const period=range=>range?stamp(range.from)+' — '+stamp(range.to-1):'—';
  function Values({result,unit='',convert=value=>value,current,basis}){
    const title=[Surface.t('本期时段')+'：'+period(result.range),Surface.t('上期时段')+'：'+period(result.previousRange),basis?Surface.t(basis):Surface.t('有效样本')+'：'+result.current.count+' / '+result.previous.count].join('\n');
    if(result.status!=='ok')return h('span',{className:'period-comparison period-comparison-empty','data-period-status':result.status,role:'group','aria-label':Surface.t('与上一周期比较'),title,tabIndex:0},Surface.t(result.status==='no-range'?'请选择起止时间':result.status==='no-current'?'本期暂无有效数据':'上期暂无有效数据'));
    const before=convert(result.previous.mean),now=current??convert(result.current.mean),rawDelta=now-before,tolerance=Math.max(Math.abs(now),Math.abs(before))*Number.EPSILON*16,delta=Math.abs(rawDelta)<=tolerance?0:rawDelta,direction=delta>0?'up':delta<0?'down':'flat',arrow=direction==='up'?'↑':direction==='down'?'↓':'→',changeUnit=unit==='%'?Surface.t('个百分点'):unit;
    if(!Number.isFinite(before)||!Number.isFinite(delta))return h('span',{className:'period-comparison period-comparison-empty'},Surface.t('暂无可比较数值'));
    return h('span',{className:'period-comparison','data-period-status':'ok','data-period-direction':direction,role:'group','aria-label':Surface.t('与上一周期比较'),title,tabIndex:0},
      h('span',{className:'period-previous'},h('small',null,'上期均值'),h('span',{'data-period-mean':before},number(before)),unit&&h('small',null,unit)),
      h('span',{className:'period-change','data-period-delta':delta,'aria-label':Surface.t(direction==='up'?'较上期上升':direction==='down'?'较上期下降':'较上期持平')+(delta?' '+number(Math.abs(delta))+' '+changeUnit:'')},h('span',{'aria-hidden':true,className:'period-arrow'},arrow),direction==='flat'?Surface.t('持平'):number(Math.abs(delta))+(changeUnit?' '+changeUnit:'')));
  }
  function Legacy({rows,column,range,current,sourceId}){
    const input=sourceId?PointExclusions.apply(sourceId,rows):rows,result=PeriodMath.compare(input,column.key,range),unit=current.meanUnit??column.unit??'';
    const convert=value=>unit==='万'+Vl(column.unit)?value/10000:ro(value,column.unit,unit);
    return h(Values,{result,unit,convert,current:current.mean});
  }
  function Mean({result,unit=''}){return h('div',{className:'period-mean-stat'},h('span',{className:'period-current'},h('small',null,'均值'),h('b',null,number(result.current.mean)),unit&&h('small',null,unit)),h(Values,{result,unit}));}
  return {Values,Legacy,Mean,number};
})();
