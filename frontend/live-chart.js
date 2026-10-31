// One SVG path per metric, with pointer overlays instead of thousands of DOM points.
var LiveChart = (() => {
  const R=Se(),h=R.createElement,W=1000,H=400,L=85,E=970,T=25,B=315;
  const date=t=>AnalysisMath.exactLocal(t).replace('T',' '),format=AnalysisPlots.format;
  function geometry(series,config={}){
    const first=series.points[0]?.time??0,last=series.points.at(-1)?.time??first;
    const from=AnalysisMath.time(config.from??''),to=AnalysisMath.time(config.to??''),bounded=from!==null&&to!==null&&to>from,x0=bounded?from:first===last?first-60000:first,x1=bounded?to:first===last?last+60000:last;
    const padding=(series.max-series.min)*.08||Math.max(1,Math.abs(series.min??0)*.05),y0=(series.min??0)-padding,y1=(series.max??1)+padding;
    if(!Number.isFinite(y1-y0)||!Number.isFinite(y0)||!Number.isFinite(y1))throw new Error('数值范围过大，请缩小数据范围后绘图。');
    const x=v=>L+(v-x0)/(x1-x0)*(E-L),y=v=>B-(v-y0)/(y1-y0)*(B-T);let previous=null,path='';
    for(const p of series.points){path+=(previous===p.segment?' L':' M')+x(p.time)+' '+y(p.value);previous=p.segment;}
    return {x,y,x0,x1,y0,y1,path,time:at=>x0+(at-L)/(E-L)*(x1-x0)};
  }
  function Chart({series,config,color,onZoom,disabled=false}) {
    const ref=R.useRef(null),drag=R.useRef(null),[hover,setHover]=R.useState(null),[selection,setSelection]=R.useState(null),[error,setError]=R.useState(''),g=R.useMemo(()=>geometry(series,config),[series,config.from,config.to]);
    R.useEffect(()=>{drag.current=null;setHover(null);setSelection(null);},[series]);
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    function position(event){const box=event.currentTarget.ownerSVGElement.getBoundingClientRect();return {x:clamp((event.clientX-box.left)/box.width*W,L,E),y:clamp((event.clientY-box.top)/box.height*H,T,B)};}
    function move(event){const p=position(event);if(drag.current){setSelection({...drag.current,...p});return;}const point=LiveSeries.nearest(series.points,g.time(p.x));setHover(point??null);}
    function down(event){if(disabled||event.button!==0)return;const p=position(event);drag.current={startX:p.x,startY:p.y};setSelection({...drag.current,...p});setHover(null);event.currentTarget.setPointerCapture(event.pointerId);}
    function cancel(){drag.current=null;setSelection(null);setHover(null);}
    function up(event){if(!drag.current)return;const end=position(event),start=drag.current;cancel();if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(Math.abs(end.x-start.startX)<8)return;
      const from=Math.round(g.time(Math.min(start.startX,end.x))),to=Math.round(g.time(Math.max(start.startX,end.x)));if(to>from)onZoom({from:AnalysisMath.exactLocal(from),to:AnalysisMath.exactLocal(to),exact:true});
    }
    const title=series.column.label+' · PI实时',tooltipX=hover?clamp(g.x(hover.time)+12,L,E-285):L,tooltipY=hover?clamp(g.y(hover.value)-72,T,B-62):T;
    return h('section',{className:'analysis-figure panel',ref},h('div',{className:'analysis-figure-head'},h('div',null,h('h3',null,title),h('p',{className:'small muted'},'最新有效值：'+(series.latest?format(series.latest.value)+' '+series.column.unit+' · '+date(series.latest.time):'当前时段暂无有效值'))),h('div',{className:'button-row'},h(PointExclusions.Tools,{...config,title}),...[false,true].map(png=>h('button',{key:String(png),className:'button small-button',onClick:()=>AnalysisPlots.saveSvg(ref.current?.querySelector('svg'),title,png).catch(e=>setError(e.message))},png?'导出 PNG':'导出 SVG')))),error&&h('p',{className:'error-banner',role:'alert'},error),
      !series.points.length?h('p',{className:'analysis-empty'},'当前时段暂无有效数值。'):h('div',{className:'analysis-svg-scroll'},h('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:'img','aria-label':title,style:{maxWidth:'100%',height:'auto',fontFamily:'"Microsoft YaHei",Arial,sans-serif'}},
        h('rect',{width:W,height:H,fill:'white'}),...Array.from({length:6},(_,i)=>{const value=g.y0+(g.y1-g.y0)*i/5;return h('g',{key:'y'+i},h('line',{x1:L,x2:E,y1:g.y(value),y2:g.y(value),stroke:'#e5edf1',strokeDasharray:'3 5'}),h('text',{x:L-10,y:g.y(value)+4,textAnchor:'end',fontSize:12,fill:'#587180'},format(value)));}),
        ...Array.from({length:6},(_,i)=>{const time=g.x0+(g.x1-g.x0)*i/5;return h('text',{key:'x'+i,x:g.x(time),y:B+24,textAnchor:'middle',fontSize:11,fill:'#587180'},date(time).slice(5,16));}),
        h('line',{x1:L,x2:E,y1:B,y2:B,stroke:'#9db8c4'}),h('path',{'data-live-series':'',d:g.path,fill:'none',stroke:color,strokeWidth:2,strokeLinejoin:'round'}),
        series.points.length===1&&h('circle',{cx:g.x(series.points[0].time),cy:g.y(series.points[0].value),r:3,fill:color}),
        h('text',{x:(L+E)/2,y:H-20,textAnchor:'middle',fontSize:12,fill:'#587180'},'时间（北京时间）'),h('text',{x:20,y:(T+B)/2,textAnchor:'middle',fontSize:12,fill:'#587180',transform:`rotate(-90 20 ${(T+B)/2})`},series.column.label+(series.column.unit?' / '+series.column.unit:'')),
        h('rect',{'data-live-interaction':'',x:L,y:T,width:E-L,height:B-T,fill:'transparent',role:'group','aria-label':'拖动框选时间段放大',tabIndex:0,style:{cursor:disabled?'wait':'crosshair',touchAction:'pan-y'},onPointerMove:move,onPointerDown:down,onPointerUp:up,onPointerCancel:cancel,onLostPointerCapture:()=>{drag.current=null;setSelection(null);},onPointerLeave:()=>{if(!drag.current)setHover(null);},onKeyDown:e=>{if(e.key==='Escape')cancel();}}),
        h('g',{'data-live-overlay':'',pointerEvents:'none'},selection&&h('rect',{'data-live-selection':'',x:Math.min(selection.startX,selection.x),y:Math.min(selection.startY,selection.y),width:Math.abs(selection.x-selection.startX),height:Math.max(2,Math.abs(selection.y-selection.startY)),fill:'#167ac2',fillOpacity:.15,stroke:'#167ac2',strokeDasharray:'5 3'}),hover&&h('g',null,h('line',{'data-live-crosshair':'time',x1:g.x(hover.time),x2:g.x(hover.time),y1:T,y2:B,stroke:'#477c96',strokeDasharray:'5 4'}),h('line',{'data-live-crosshair':'value',x1:L,x2:E,y1:g.y(hover.value),y2:g.y(hover.value),stroke:'#477c96',strokeDasharray:'5 4'}),h('circle',{cx:g.x(hover.time),cy:g.y(hover.value),r:4,fill:color,stroke:'white',strokeWidth:2}),h('g',{'data-live-tooltip':'',role:'status'},h('rect',{x:tooltipX,y:tooltipY,width:285,height:60,rx:7,fill:'white',stroke:'#b9d5df'}),h('text',{x:tooltipX+10,y:tooltipY+22,fontSize:12,fill:'#325363'},date(hover.time)),h('text',{x:tooltipX+10,y:tooltipY+44,fontSize:13,fill:color},format(hover.value)+' '+(series.column.unit??''))))))),
      h('p',{className:'small muted'},`有效读数 ${series.valid} 个 · 绘图 ${series.points.length} 点。悬停查看最近绘制采样点；按住鼠标左键框选时间段放大。`));
  }
  return {Chart,geometry};
})();
