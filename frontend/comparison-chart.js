// Interactive layer over the existing comparison model and SVG renderer. Zoom
// is temporary; chosen colors belong to the saved comparison configuration.
var ComparisonChart=(()=>{
 const R=Se(),h=R.createElement,validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 function color(value,index=0){return validColor(value)?value:IN[index%IN.length];}
 function useZoom(config){
  const key=JSON.stringify({...config,lines:config.lines.map(({color,...line})=>line)}),[state,setState]=R.useState(null),range=state?.key===key?state.range:null;
  return {range,onRange:next=>setState(next?{key,range:next}:null)};
 }
 function model(data,range){
  if(!range)return data;
  return {...data,range,lines:data.lines.map(line=>{const rows=line.data.filter(p=>p.time>=range[0]&&p.time<=range[1]),times=new Set(rows.map(p=>p.time));return {...line,data:rows,summary:Qs(line.points.filter(p=>p.unit===line.selection.unitId&&p.group===line.selection.group&&times.has(p.time)),line.column)};})};
 }
 function Color({value,index,onChange}){return h('label',{className:'comparison-color'},h('span',null,'线条颜色'),h('input',{type:'color',value:color(value,index),'aria-label':'曲线'+(index+1)+'颜色',onChange:e=>onChange(e.target.value)}));}
 function nearest(points,time){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid].time<time)lo=mid+1;else hi=mid;}const a=points[lo-1],b=points[lo];return !a?b:!b?a:time-a.time<=b.time-time?a:b;}
 function Plot({data,svg,title,zoom}){
  const root=R.useRef(null),drag=R.useRef(null),[brush,setBrush]=R.useState(null),[hover,setHover]=R.useState(null),height=504+Math.ceil(data.lines.length/2)*42,extent=R.useMemo(()=>{let min=Infinity,max=-Infinity;for(const line of data.lines)for(const p of line.data){min=Math.min(min,p.time);max=Math.max(max,p.time);}return data.range??(min===max?[min-1,max+1]:[min,max]);},[data]),left=95,right=945,top=130,bottom=400;
  R.useEffect(()=>{setHover(null);setBrush(null);drag.current=null;},[data]);
  const x=time=>left+(time-extent[0])/(extent[1]-extent[0])*(right-left),time=px=>extent[0]+(px-left)/(right-left)*(extent[1]-extent[0]);
  function position(e){const r=e.currentTarget.ownerSVGElement.getBoundingClientRect();return Math.max(left,Math.min(right,(e.clientX-r.left)/r.width*1060));}
  function move(e){const px=position(e);if(drag.current){setBrush([drag.current.x,px]);return;}const at=time(px),values=data.lines.map(line=>({line,point:at<line.data[0]?.time||at>line.data.at(-1)?.time?null:nearest(line.data,at)}));setHover({x:px,time:at,values,width:e.currentTarget.ownerSVGElement.getBoundingClientRect().width});}
  function down(e){if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:position(e),id:e.pointerId};setHover(null);setBrush([drag.current.x,drag.current.x]);}
  function finish(e){const start=drag.current;if(!start)return;const end=position(e);drag.current=null;setBrush(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(Math.abs(end-start.x)<6)return;const range=[time(Math.min(start.x,end)),time(Math.max(start.x,end))];if(data.lines.some(line=>line.data.some(p=>p.time>=range[0]&&p.time<=range[1])))zoom.onRange(range);}
  const cancel=()=>{drag.current=null;setBrush(null);},reset=()=>{cancel();setHover(null);zoom.onRange(null);};
  const fmt=value=>value==null?'—':value.toLocaleString('zh-CN',{maximumFractionDigits:4}),date=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,19);
  return h('div',{className:'comparison-interactive'},h('div',{className:'comparison-interaction-tools'},h('small',null,'拖动框选放大；双击恢复全部'),zoom.range?h('button',{className:'button small-button',onClick:reset},'恢复全部'):null),h('div',{ref:root,className:'comparison-plot','data-testid':'comparison-chart','data-zoom-from':zoom.range?.[0],'data-zoom-to':zoom.range?.[1]},h('div',{className:'comparison-canvas'},h('div',{className:'comparison-static',dangerouslySetInnerHTML:{__html:Surface.exportSvg(svg,title)}}),h('svg',{className:'comparison-interaction-layer',viewBox:'0 0 1060 '+height,'aria-label':'对比图交互层'},hover&&!brush?h('line',{'data-comparison-crosshair':true,x1:hover.x,x2:hover.x,y1:top,y2:bottom,stroke:'var(--surface-accent,#198572)',strokeWidth:1,strokeDasharray:'5 4'}):null,brush?h('rect',{'data-comparison-brush':true,x:Math.min(...brush),y:top,width:Math.abs(brush[1]-brush[0]),height:bottom-top,fill:'rgba(25,133,114,.14)',stroke:'#198572'}):null,h('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'transparent',tabIndex:0,role:'application','aria-label':'拖动框选对比时间范围，双击恢复全部；Escape取消框选',className:'comparison-brush-target',onPointerDown:down,onPointerMove:move,onPointerUp:finish,onPointerCancel:cancel,onLostPointerCapture:cancel,onPointerLeave:()=>{if(!drag.current)setHover(null);},onDoubleClick:reset,onKeyDown:e=>{if(e.key==='Escape'){cancel();setHover(null);}if(e.key==='Home'){e.preventDefault();reset();}}})),hover&&!brush?h('div',{className:'comparison-readout',role:'status',style:{left:Math.max(8,Math.min(hover.x/1060*hover.width+12,hover.width-Math.min(420,hover.width*.85)-8)),width:Math.min(420,hover.width*.85),top:'15%'}},h('b',null,date(hover.time)),hover.values.map(({line,point})=>h('div',{key:line.selection.id,'data-readout-line':line.selection.id},h('i',{style:{background:line.color}}),h('span',null,line.title),h('strong',null,fmt(point?.raw)+' '+line.column.unit),point?h('small',null,date(point.time)):null))):null)));
 }
 return {useZoom,model,Color,Plot,color,validColor};
})();
