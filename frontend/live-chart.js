// One SVG path per metric, with pointer overlays instead of thousands of DOM points.
var LiveChart = (() => {
  const R=Se(),h=R.createElement,H=400,T=45,B=315;
  const date=t=>AnalysisMath.exactLocal(t).replace('T',' '),format=AnalysisPlots.format;
  function geometry(series,config={},references=[]){
    const W=config.compact?720:1000,E=W-30;
    const first=series.points[0]?.time??0,last=series.points.at(-1)?.time??first;
    const from=AnalysisMath.time(config.from??''),to=AnalysisMath.time(config.to??''),bounded=from!==null&&to!==null&&to>from,x0=bounded?from:first===last?first-60000:first,x1=bounded?to:first===last?last+60000:last;
    const values=references.map(r=>r.value).filter(AnalysisMath.finite),min=Math.min(series.min??0,...values),max=Math.max(series.max??1,...values),padding=(max-min)*.08||Math.max(1,Math.abs(min)*.05),y0=min-padding,y1=max+padding;
    if(!Number.isFinite(y1-y0)||!Number.isFinite(y0)||!Number.isFinite(y1))throw new Error('数值范围过大，请缩小数据范围后绘图。');
    const ticks=ChartAxes.ticks(y0,y1),L=ChartAxes.left(ticks);
    const x=v=>L+(v-x0)/(x1-x0)*(E-L),y=v=>B-(v-y0)/(y1-y0)*(B-T);let previous=null,path='';
    for(const p of series.points){path+=(previous===p.segment?' L':' M')+x(p.time)+' '+y(p.value);previous=p.segment;}
    return {W,E,L,ticks,x,y,x0,x1,y0,y1,path,time:at=>x0+(at-L)/(E-L)*(x1-x0)};
  }
  function Chart({series,config,color,onZoom,disabled=false,title:customTitle,subtitle='',pin=true,references=[]}) {
    const ref=R.useRef(null),drag=R.useRef(null),[hover,setHover]=R.useState(null),[selection,setSelection]=R.useState(null),[error,setError]=R.useState(''),g=R.useMemo(()=>geometry(series,config,references),[series,config.from,config.to,config.compact,JSON.stringify(references)]);
    R.useEffect(()=>{drag.current=null;setHover(null);setSelection(null);},[series]);
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    function position(event){const box=event.currentTarget.ownerSVGElement.getBoundingClientRect();return {x:clamp((event.clientX-box.left)/box.width*g.W,g.L,g.E),y:clamp((event.clientY-box.top)/box.height*H,T,B)};}
    function move(event){const p=position(event);if(drag.current){setSelection({...drag.current,...p});return;}const point=LiveSeries.nearest(series.points,g.time(p.x));setHover(point??null);}
    function down(event){if(disabled||event.button!==0)return;const p=position(event);drag.current={startX:p.x,startY:p.y};setSelection({...drag.current,...p});setHover(null);event.currentTarget.setPointerCapture(event.pointerId);}
    function cancel(){drag.current=null;setSelection(null);setHover(null);}
    function up(event){if(!drag.current)return;const end=position(event),start=drag.current;cancel();if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(Math.abs(end.x-start.startX)<8)return;
      const from=Math.round(g.time(Math.min(start.startX,end.x))),to=Math.round(g.time(Math.max(start.startX,end.x)));if(to>from)onZoom({from:AnalysisMath.exactLocal(from),to:AnalysisMath.exactLocal(to),exact:true});
    }
    const title=customTitle??series.column.label+' · PI实时',heading=Surface.chartTitle(config,[series.column],title),tooltipX=hover?clamp(g.x(hover.time)+12,g.L,g.E-285):g.L,tooltipY=hover?clamp(g.y(hover.value)-72,T,B-62):T;
    return h('section',{className:'analysis-figure panel',ref},h('div',{className:'analysis-figure-head'},h('div',null,h('h3',null,heading),h('p',{className:'small muted latest-reading'},'最新有效值：'+(series.latest?format(series.latest.value)+' '+series.column.unit+' · '+date(series.latest.time):'当前时段暂无有效值'))),h('div',{className:'button-row'},pin&&h(Dashboard.Pin,{kind:'live',config:{...config,type:'line',title,palette:Object.entries(AnalysisPlots.palettes).find(([,colors])=>colors[0]===color)?.[0]??'coast'},unitId:config.sourceId?.startsWith('ds_unit_')?config.sourceId.slice(8):'',rangeMode:config.from===ViewDefaults.today().from&&config.to===ViewDefaults.today().to?'today':'fixed'}),h(PointExclusions.Tools,{...config,title}),...[false,true].map(png=>h('button',{key:String(png),className:'button small-button',onClick:()=>AnalysisPlots.saveSvg(ref.current?.querySelector('svg'),heading,png).catch(e=>setError(e.message))},png?'导出 PNG':'导出 SVG')))),error&&h('p',{className:'error-banner',role:'alert'},error),
      !series.points.length?h('p',{className:'analysis-empty'},'当前时段暂无有效数值。'):h('div',{className:'analysis-svg-scroll'},h('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:`0 0 ${g.W} ${H}`,width:g.W,height:H,role:'img','aria-label':title,style:{maxWidth:'100%',height:'auto',fontFamily:'"Microsoft YaHei",Arial,sans-serif'}},
        h('rect',{width:g.W,height:H,fill:'white'}),...g.ticks.map(({value,label},i)=>h('g',{key:'y'+i},h('line',{x1:g.L,x2:g.E,y1:g.y(value),y2:g.y(value),stroke:'#e5edf1',strokeDasharray:'3 5'}),h('text',{'data-axis-tick':'y',x:g.L-10,y:g.y(value)+4,textAnchor:'end',fontSize:12,fill:'#587180'},label))),
        ...Array.from({length:config.compact?4:6},(_,i)=>{const time=g.x0+(g.x1-g.x0)*i/(config.compact?3:5);return h('text',{key:'x'+i,x:g.x(time),y:B+24,textAnchor:'middle',fontSize:11,fill:'#587180'},date(time).slice(5,16));}),
        h('line',{x1:g.L,x2:g.E,y1:B,y2:B,stroke:'#9db8c4'}),h('path',{'data-live-series':'',d:g.path,fill:'none',stroke:color,strokeWidth:2,strokeLinejoin:'round'}),
        ...references.filter(r=>AnalysisMath.finite(r.value)).map(r=>h('g',{key:r.label,'data-chart-reference':r.label},h('line',{x1:g.L,x2:g.E,y1:g.y(r.value),y2:g.y(r.value),stroke:r.color??'#af7850',strokeDasharray:'5 4'}),h('text',{x:g.E-4,y:g.y(r.value)-4,textAnchor:'end',fontSize:10,fill:r.color??'#af7850'},r.label+' '+format(r.value)))),
        series.points.length===1&&h('circle',{cx:g.x(series.points[0].time),cy:g.y(series.points[0].value),r:3,fill:color}),
        h('text',{x:(g.L+g.E)/2,y:H-20,textAnchor:'middle',fontSize:12,fill:'#587180'},'Time (UTC+8)'),h('text',{'data-axis-title':'y',x:20,y:(T+B)/2,textAnchor:'middle',fontSize:12,fill:'#587180',transform:`rotate(-90 20 ${(T+B)/2})`},h('title',null,series.column.label+(series.column.unit?' / '+series.column.unit:'')),series.column.unit),
        h('rect',{'data-live-interaction':'',x:g.L,y:T,width:g.E-g.L,height:B-T,fill:'transparent',role:'group','aria-label':'拖动框选时间段放大',tabIndex:0,style:{cursor:disabled?'wait':'crosshair',touchAction:'pan-y'},onPointerMove:move,onPointerDown:down,onPointerUp:up,onPointerCancel:cancel,onLostPointerCapture:()=>{drag.current=null;setSelection(null);},onPointerLeave:()=>{if(!drag.current)setHover(null);},onKeyDown:e=>{if(e.key==='Escape')cancel();}}),
        h('g',{'data-live-overlay':'',pointerEvents:'none'},selection&&h('rect',{'data-live-selection':'',x:Math.min(selection.startX,selection.x),y:Math.min(selection.startY,selection.y),width:Math.abs(selection.x-selection.startX),height:Math.max(2,Math.abs(selection.y-selection.startY)),fill:'#167ac2',fillOpacity:.15,stroke:'#167ac2',strokeDasharray:'5 3'}),hover&&h('g',null,h('line',{'data-live-crosshair':'time',x1:g.x(hover.time),x2:g.x(hover.time),y1:T,y2:B,stroke:'#477c96',strokeDasharray:'5 4'}),h('line',{'data-live-crosshair':'value',x1:g.L,x2:g.E,y1:g.y(hover.value),y2:g.y(hover.value),stroke:'#477c96',strokeDasharray:'5 4'}),h('circle',{cx:g.x(hover.time),cy:g.y(hover.value),r:4,fill:color,stroke:'white',strokeWidth:2}),h('g',{'data-live-tooltip':'',role:'status'},h('rect',{x:tooltipX,y:tooltipY,width:285,height:60,rx:7,fill:'white',stroke:'#b9d5df'}),h('text',{x:tooltipX+10,y:tooltipY+22,fontSize:12,fill:'#325363'},date(hover.time)),h('text',{x:tooltipX+10,y:tooltipY+44,fontSize:13,fill:color},format(hover.value)+' '+(series.column.unit??''))))))),
      null);
  }
  return {Chart,geometry};
})();
