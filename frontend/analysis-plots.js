// Self-contained SVG plots. Statistics always use every selected observation.
var AnalysisPlots = (() => {
  const R=Se(),h=R.createElement,M=AnalysisMath;
  const palettes={coast:["#078a9b","#477be3","#ed9853","#9c6edb","#34a478","#df667b"],bright:["#3567d8","#e58835","#16a5a1","#b665c7","#a0ad35","#de5f7e"],forest:["#16866a","#6d97d9","#c99429","#b76e9e","#559aaf","#bc6c51"],sunset:["#e65a3f","#f2a137","#c73972","#8b4bb6","#4382bb","#dfa824"],aurora:["#7b4dd4","#13a6a1","#ed6c9d","#2d88c6","#e8ad27","#6e9d3d"],island:["#087cc1","#f47f38","#22a884","#b447ac","#d4ad24","#e2536b"],berry:["#d4368a","#804bbd","#4093ce","#e78b39","#24a48e","#bf4b52"],citrus:["#db8e08","#78a430","#09a5ab","#eb6647","#7770cf","#d4488d"],royal:["#3748be","#bd4545","#dcaa1e","#17a298","#8954bc","#e67826"],pastel:["#6c91d6","#d780a6","#61aaa0","#d5a057","#a18acb","#8eae66"],earth:["#a56234","#397b6e","#b24c65","#536ba7","#b19c37","#8b609d"],accessible:["#0072b2","#d55e00","#009e73","#cc79a7","#e69f00","#56b4e9"]};
  const paletteNames={coast:"晴海 · 青蓝",bright:"明亮 · 多彩",forest:"自然 · 绿金",sunset:"落日 · 橙红",aurora:"极光 · 紫绿",island:"海岛 · 蓝橙",berry:"莓果 · 玫紫",citrus:"柑橘 · 黄绿",royal:"经典 · 宝蓝",pastel:"柔彩 · 浅色",earth:"大地 · 暖棕",accessible:"色盲友好 · 高辨识"};
  const types={line:"折线图",area:"面积图",bar:"柱状图",scatter:"散点图",histogram:"直方图",box:"箱线图"};
  const format=v=>!M.finite(v)?"—":Math.abs(v)>=1e7||Math.abs(v)>0&&Math.abs(v)<.0001?v.toExponential(3):v.toLocaleString("zh-CN",{maximumFractionDigits:4});
  const date=t=>M.local(t).replace("T"," ");
  const trunc=(s,n=24)=>s.length>n?s.slice(0,n-1)+"…":s;
  function extent(values){const valid=values.filter(M.finite);if(!valid.length)return [0,1];let min=valid.reduce((a,b)=>Math.min(a,b),Infinity),max=valid.reduce((a,b)=>Math.max(a,b),-Infinity);const pad=(max-min)*.08||Math.max(1,Math.abs(min)*.05);min-=pad;max+=pad;if(!Number.isFinite(max-min))throw new Error("数值范围过大，请缩小数据范围后绘图。");return [min,max];}
  function thin(rows,key){
    // Keep extrema and original gap identities, so sampling cannot bridge a
    // missing reading. No sampling is used by summaries, histograms or exports.
    let segment=0;const tagged=rows.filter(row=>!M.excluded(row,key)).map(row=>{if(!M.finite(row.values[key]))segment++;return {row,segment};}),result=[];
    const size=Math.max(1,Math.ceil(rows.length/600));
    for(let i=0;i<tagged.length;i+=size){const bucket=tagged.slice(i,i+size).filter(p=>M.finite(p.row.values[key]));if(!bucket.length)continue;
      const lo=bucket.reduce((a,b)=>a.row.values[key]<b.row.values[key]?a:b),hi=bucket.reduce((a,b)=>a.row.values[key]>b.row.values[key]?a:b);
      result.push(...[...new Set([bucket[0],lo,hi,bucket.at(-1)])].sort((a,b)=>a.row.time-b.row.time));
    }
    return result;
  }
  function Svg({config,rows,columns,references=[],split=null,distributions=null,boxGroups=null,pointSelection=null,normalCurves=[]}){
    const palette=palettes[config.palette]??palettes.coast,keys=config.keys.filter(k=>columns.some(c=>c.key===k)),chosen=keys.map(k=>columns.find(c=>c.key===k));
    if(!chosen.length)return h("p",{className:"analysis-empty"},"请选择至少一个指标。");
    const type=config.type??"line",single=["scatter","histogram"].includes(type),used=single?chosen.slice(0,1):chosen;
    const units=new Set(used.map(c=>c.unit??""));
    if(!single&&units.size>1&&!config.normalized)throw new Error("所选指标单位不同，请勾选归一化，或分别作图。");
    if(!rows.some(r=>used.some(c=>M.finite(r.values[c.key])))&&!boxGroups?.length)return h("p",{className:"analysis-empty"},"所选时段、分组和指标没有有效数值。");
    const W=config.compact?720:1000,H=460,T=50,B=H-125,E=W-32,children=[],legend=[];let L=100;
    const text=(x,y,value,props={})=>Surface.svgText(x,y,value,{fill:"#536879",fontSize:12,...props});
    let xScale,yScale,xTicks=[],yTicks=[],xLabel="时间（北京时间）",yLabel=config.normalized?"归一化值（0–1）":used.length===1?used[0].label+(used[0].unit?" / "+used[0].unit:""):"数值 / "+(used[0].unit||"无单位");
    function scales(xs,ys,categorical=false,zeroBaseline=false){const xd=categorical?[0,Math.max(1,xs.length)]:extent(xs),yd=extent(ys);if(zeroBaseline)yd[0]=0;
      const ticks=ChartAxes.ticks(yd[0],yd[1]);L=ChartAxes.left(ticks);
      xScale=v=>L+(v-xd[0])/(xd[1]-xd[0])*(E-L);yScale=v=>B-(v-yd[0])/(yd[1]-yd[0])*(B-T);
      yTicks=ticks.map(t=>({at:yScale(t.value),label:t.label}));
      xTicks=categorical?xs.map((v,i)=>({at:xScale(i+.5),label:trunc(String(v),15)})):Array.from({length:config.compact?4:6},(_,i)=>{const v=xd[0]+i*(xd[1]-xd[0])/(config.compact?3:5);return {at:xScale(v),label:xLabel.startsWith("时间")?date(v).slice(5):format(v)};});
    }
    const hasValue=rows.filter(r=>used.some(c=>M.finite(r.values[c.key]))),ref=references.filter(r=>M.finite(r.value));
    if(type==="histogram"){
      xLabel=used[0].label+(used[0].unit?" / "+used[0].unit:"");yLabel="频数（个）";
      const samples=distributions??[{label:used[0].label,rows,color:palette[0]}],all=samples.flatMap(s=>s.rows.map(r=>r.values[keys[0]])),bins=M.histogram(all,config.bins);
      if(!bins.length)return h("p",{className:"analysis-empty"},"所选数据无法生成直方图。");
      const width=bins[0].to-bins[0].from;
      const counts=samples.map(s=>{const a=bins.map(b=>({...b,count:0}));for(const row of s.rows){const v=row.values[keys[0]];if(M.finite(v))a[Math.min(a.length-1,Math.max(0,Math.floor((v-bins[0].from)/width)))].count++;}return a;});
      const normalN=all.filter(M.finite).length,curves=normalCurves.filter(c=>M.finite(c.mean)&&c.sd>0).map(c=>({...c,points:Array.from({length:180},(_,i)=>{const x=bins[0].from+(bins.at(-1).to-bins[0].from)*i/179;return {x,y:normalN*width*Math.exp(-.5*((x-c.mean)/c.sd)**2)/(c.sd*Math.sqrt(2*Math.PI))};})}));
      scales([bins[0].from,bins.at(-1).to,...ref.map(r=>r.value)],[0,...counts.flat().map(b=>b.count),...curves.flatMap(c=>c.points.map(p=>p.y))],false,true);
      for(const [i,c]of curves.entries()){children.push(h("path",{key:"normal"+i,d:c.points.map((p,j)=>(j?"L":"M")+xScale(p.x)+" "+yScale(p.y)).join(" "),fill:"none",stroke:c.color,strokeWidth:2,strokeDasharray:c.dashed?"7 5":undefined}));legend.push({label:c.label,color:c.color});}
      counts.forEach((values,j)=>{legend.push({label:samples[j].label,color:samples[j].color??palette[j]});values.forEach((bin,i)=>{if(!bin.count)return;children.push(h("rect",{key:`h${j}-${i}`,x:xScale(bin.from)+1,y:yScale(bin.count),width:Math.max(1,xScale(bin.to)-xScale(bin.from)-2),height:yScale(0)-yScale(bin.count),fill:samples[j].color??palette[j],fillOpacity:samples.length>1?.4:.8},h("title",null,`${samples[j].label}：${format(bin.from)}–${format(bin.to)}，${bin.count} 个`)));});});
      for(const r of ref)children.push(h("g",{key:r.label},h("line",{x1:xScale(r.value),x2:xScale(r.value),y1:T,y2:B,stroke:r.color??"#d9665c",strokeDasharray:"6 4"}),text(xScale(r.value)+4,T+13,r.label,{fill:r.color??"#be5046"})));
    }else if(type==="box"){
      const groups=boxGroups??(config.boxBy==="group"&&used.length===1?[...new Set(rows.map(r=>r.group))].slice(0,20).map((group,i)=>({label:group||"未分组",values:rows.filter(r=>r.group===group).map(r=>r.values[keys[0]]),color:palette[i%palette.length]})):used.map((c,i)=>({label:c.label,values:rows.map(r=>r.values[c.key]),color:palette[i%palette.length]})));
      const data=groups.map(g=>({...g,stats:M.boxes(g.values)})).filter(g=>g.stats.n);if(!data.length)return h("p",{className:"analysis-empty"},"没有可用的箱线图数据。");
      if(config.normalized)for(const g of data){const min=g.stats.min,span=g.stats.max-min||1;g.stats=M.boxes(g.values.filter(M.finite).map(v=>(v-min)/span));}
      xLabel="分组 / 指标";scales(data.map(g=>g.label),data.flatMap(g=>[g.stats.min,g.stats.max]),true);
      data.forEach((g,i)=>{const x=xScale(i+.5),s=g.stats,w=Math.min(75,(E-L)/data.length*.45),color=g.color??palette[i%palette.length];legend.push({label:g.label,color});
        children.push(h("g",{key:i},h("title",null,`${g.label}：n=${s.n}，中位数 ${format(s.median)}，Q1 ${format(s.q1)}，Q3 ${format(s.q3)}`),h("line",{x1:x,x2:x,y1:yScale(s.low),y2:yScale(s.high),stroke:color}),...[s.low,s.high].map((v,j)=>h("line",{key:j,x1:x-w/3,x2:x+w/3,y1:yScale(v),y2:yScale(v),stroke:color,strokeWidth:2})),h("rect",{x:x-w/2,y:yScale(s.q3),width:w,height:Math.max(1,yScale(s.q1)-yScale(s.q3)),fill:color,fillOpacity:.18,stroke:color,strokeWidth:2}),h("line",{x1:x-w/2,x2:x+w/2,y1:yScale(s.median),y2:yScale(s.median),stroke:color,strokeWidth:3}),...s.outliers.filter((_,j)=>j%Math.max(1,Math.ceil(s.outliers.length/300))===0).map((v,j)=>h("circle",{key:"o"+j,cx:x,cy:yScale(v),r:2.5,fill:"white",stroke:color}))));
      });
    }else if(type==="scatter"){
      const xCol=columns.find(c=>c.key===config.xKey);if(!xCol)return h("p",{className:"analysis-empty"},"请选择散点图横轴指标。");
      xLabel=xCol.label+(xCol.unit?" / "+xCol.unit:"");const paired=rows.filter(r=>M.finite(r.values[config.xKey])&&M.finite(r.values[keys[0]]));
      if(!paired.length)return h("p",{className:"analysis-empty"},"同一记录中没有横、纵轴同时有效的数据。");
      scales(paired.map(r=>r.values[config.xKey]),paired.map(r=>r.values[keys[0]]));legend.push({label:`同一记录配对 · ${paired.length} 对`,color:palette[0]});
      paired.filter((_,i)=>i%Math.max(1,Math.ceil(paired.length/2500))===0).forEach((r,i)=>children.push(h("circle",{key:i,cx:xScale(r.values[config.xKey]),cy:yScale(r.values[keys[0]]),r:3.5,fill:palette[0],fillOpacity:.65},h("title",null,`${date(r.time)} · ${r.group}：${format(r.values[config.xKey])} / ${format(r.values[keys[0]])}`))));
    }else if(type==="bar"){
      const data=M.aggregate(rows,keys,config.period??"day",config.aggregation??"mean");if(data.length>120)throw new Error("柱状图超过120组，请缩小时间范围或改为按周、按月汇总。");
      xLabel=`${{day:"按日",week:"按周",month:"按月",all:"按采样分组"}[config.period??"day"]} · ${config.aggregation==="sum"?"有效值求和":"有效值均值"}`;
      if(config.normalized)for(const c of used){const s=M.summarize(data.map(r=>r.values[c.key]));for(const r of data)if(M.finite(r.values[c.key]))r.values[c.key]=(r.values[c.key]-s.min)/(s.max-s.min||1);}
      scales(data.map(g=>g.label+(g.group?" · "+g.group:"")),[0,...data.flatMap(r=>used.map(c=>r.values[c.key]))],true);
      used.forEach((c,j)=>{legend.push({label:c.label,color:palette[j]});const width=(E-L)/Math.max(data.length,1)*.72/used.length;
        data.forEach((r,i)=>{const v=r.values[c.key];if(!M.finite(v))return;children.push(h("rect",{key:`b${i}-${j}`,x:xScale(i+.5)-used.length*width/2+j*width,y:Math.min(yScale(0),yScale(v)),width:Math.max(1,width-1),height:Math.max(1,Math.abs(yScale(v)-yScale(0))),fill:palette[j],fillOpacity:.85},h("title",null,`${r.label} ${r.group} · ${c.label}：${format(v)}`)));});});
      if(xTicks.length>12)xTicks=xTicks.filter((_,i)=>i%Math.ceil(xTicks.length/12)===0);
    }else{
      const spans=new Map(used.map(c=>{const s=M.summarize(rows.map(r=>r.values[c.key]));return [c.key,s];}));
      const value=(row,c)=>{const v=row.values[c.key],s=spans.get(c.key);return !M.finite(v)?null:config.normalized?(v-s.min)/(s.max-s.min||1):v;};
      scales(rows.map(r=>r.time),[...hasValue.flatMap(r=>used.map(c=>value(r,c))),...!config.normalized?ref.map(r=>r.value):[],...type==="area"?[0]:[]],false,used.length===1&&used[0].key==="range");
      used.forEach((c,j)=>{
        const groups=[...new Set(rows.map(r=>r.group))].slice(0,20);
        groups.forEach((group,k)=>{const data=rows.filter(r=>r.group===group&&Object.hasOwn(r.values,c.key)),color=palette[(j+k)%palette.length],points=thin(data,c.key);let previous=null,path="",area="",start=null;
          for(const p of points){const x=xScale(p.row.time),y=yScale(value(p.row,c));if(previous!==p.segment){if(start)area+=` L${start.last} ${yScale(0)} L${start.x} ${yScale(0)} Z`;path+=` M${x} ${y}`;area+=` M${x} ${y}`;start={x,last:x};}else{path+=` L${x} ${y}`;area+=` L${x} ${y}`;start.last=x;}previous=p.segment;}
          if(start)area+=` L${start.last} ${yScale(0)} L${start.x} ${yScale(0)} Z`;
          if(type==="area")children.push(h("path",{key:`a${j}-${k}`,d:area,fill:color,fillOpacity:.14,stroke:"none"}));
          children.push(h("path",{key:`l${j}-${k}`,d:path,fill:"none",stroke:color,strokeWidth:2,strokeLinejoin:"round"}));
          for(const [i,p] of points.entries()){const selected=pointSelection?.selected.has(AnalysisPointMath.identity(AnalysisPointMath.observation(pointSelection.sourceId,p.row,c.key))),label=`${M.exactLocal(p.row.time).replace("T"," ")} · ${p.row.group||"未分组"} · ${c.label}：${format(p.row.values[c.key])}`;
            children.push(h("circle",{key:`p${j}-${k}-${i}`,cx:xScale(p.row.time),cy:yScale(value(p.row,c)),r:pointSelection?5:data.length<=80?3:1.5,fill:selected?"white":color,stroke:selected?"#db405c":undefined,strokeWidth:selected?3:undefined,role:pointSelection?"button":undefined,tabIndex:pointSelection?0:undefined,"aria-label":pointSelection?"选择图中读数 "+label:undefined,"aria-pressed":pointSelection?!!selected:undefined,style:pointSelection?{cursor:"pointer"}:undefined,onClick:pointSelection?()=>pointSelection.onToggle(p.row,c.key):undefined,onKeyDown:pointSelection?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pointSelection.onToggle(p.row,c.key);}}:undefined},h("title",null,label)));}
          legend.push({label:c.label+(groups.length>1?" · "+(group||"未分组"):""),color});
        });
      });
      if(!config.normalized)for(const r of ref)children.push(h("g",{key:r.label},h("line",{x1:L,x2:E,y1:yScale(r.value),y2:yScale(r.value),stroke:r.color??"#d9665c",strokeDasharray:"6 4"}),text(E-2,yScale(r.value)-5,r.label+" "+format(r.value),{textAnchor:"end",fill:r.color??"#be5046"})));
      if(split!==null&&rows.length&&split>=rows[0].time&&split<=rows.at(-1).time)children.push(h("g",{key:"split"},h("line",{x1:xScale(split),x2:xScale(split),y1:T,y2:B,stroke:"#8b68c5",strokeWidth:2,strokeDasharray:"5 4"}),text(xScale(split)+5,T+15,"调整时间",{fill:"#805bbd"})));
    }
    return h("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:"img","aria-label":config.title||types[type],style:{fontFamily:'"Microsoft YaHei",Arial,sans-serif',maxWidth:"100%",height:"auto"}},
      h("rect",{width:W,height:H,fill:"#fff"}),
      ...yTicks.map((t,i)=>h("g",{key:"y"+i},h("line",{x1:L,x2:E,y1:t.at,y2:t.at,stroke:"#e6edf2",strokeDasharray:"3 5"}),text(L-12,t.at+4,t.label,{textAnchor:"end","data-axis-tick":"y"}))),
      ...xTicks.map((t,i)=>h("g",{key:"x"+i},text(t.at,B+24,t.label,{textAnchor:"middle",fontSize:11}))),
      h("line",{x1:L,x2:E,y1:B,y2:B,stroke:"#aebec9"}),...children,
      text((L+E)/2,H-18,xLabel,{textAnchor:"middle",fontSize:13}),text(18,(T+B)/2,ChartAxes.label(yLabel,B-T),{"data-axis-title":"y",textAnchor:"middle",fontSize:13,transform:`rotate(-90 18 ${(T+B)/2})`}),
      ...legend.slice(0,config.compact?6:12).map((g,i)=>h("g",{key:"leg"+i},h("rect",{x:L+(i%(config.compact?2:4))*(config.compact?(E-L)/2:215),y:H-85+Math.floor(i/(config.compact?2:4))*23,width:10,height:3,fill:g.color}),text(L+15+(i%(config.compact?2:4))*(config.compact?(E-L)/2:215),H-80+Math.floor(i/(config.compact?2:4))*23,trunc(g.label,15),{fontSize:11}))));
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function download(content,filename,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=filename.slice(0,120).replace(/[\\/:*?"<>|]/g,"_");a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function saveSvg(svg,title,png=false){
    if(!svg)throw new Error("请先生成有效图表。");
    const clone=svg.cloneNode(true);clone.querySelectorAll('[data-live-overlay],[data-live-interaction]').forEach(node=>node.remove());const label=document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x","24");label.setAttribute("y","21");label.setAttribute("text-anchor","start");label.setAttribute("font-size","16");label.setAttribute("fill","#244252");label.textContent=title;if(!svg.hasAttribute("data-complete-report")&&!svg.hasAttribute("data-complete-chart")){clone.appendChild(label);const english=label.cloneNode(true);english.setAttribute('y','35');english.setAttribute('font-size','10');english.textContent=Surface.en(title);clone.appendChild(english);}
    const source=new XMLSerializer().serializeToString(clone);
    if(!png){download(source,title+".svg","image/svg+xml;charset=utf-8");return;}
    const url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml;charset=utf-8"}));
    try{await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{const canvas=document.createElement("canvas");const box=svg.viewBox.baseVal;canvas.width=(box.width||1000)*2;canvas.height=(box.height||460)*2;canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){reject(new Error("图片导出失败。"));return;}download(blob,title+".png","image/png");resolve();},"image/png");}catch(e){reject(e);}};img.onerror=()=>reject(new Error("图表图片生成失败，请尝试导出 SVG。"));img.src=url;});}finally{URL.revokeObjectURL(url);}
  }
  class Boundary extends R.Component{constructor(props){super(props);this.state={error:null};}static getDerivedStateFromError(error){return {error};}componentDidUpdate(old){if(old.signature!==this.props.signature&&this.state.error)this.setState({error:null});}render(){return this.state.error?h("p",{role:"alert",className:"error-banner"},this.state.error.message):this.props.children;}}
  function Figure(props){const ref=R.useRef(null),[error,setError]=R.useState("");const title=Surface.chartTitle(props.config,props.columns,props.config.title||types[props.config.type]);
    const groupCount=new Set(props.rows.map(r=>r.group)).size;
    return h("section",{className:"analysis-figure panel",ref},h("div",{className:"analysis-figure-head"},h("div",null,h("h3",null,title),null),h("div",{className:"button-row"},props.config.sourceId&&!props.pointQuery&&props.pin!==false&&h(Dashboard.Pin,{kind:"chart",config:props.config,control:props.references?.some(r=>r.label==="I图上控制限")}),props.config.sourceId&&h(PointExclusions.Tools,{...(props.pointQuery??props.config),title}),...[false,true].map(png=>h("button",{key:String(png),className:"button small-button",onClick:()=>saveSvg(ref.current?.querySelector("svg"),title,png).catch(e=>setError(e.message))},png?"导出 PNG":"导出 SVG")))),
      error&&h("p",{role:"alert",className:"error-banner"},error),h("div",{className:"analysis-svg-scroll"},h(Boundary,{signature:JSON.stringify(props.config)+JSON.stringify(props.columns)+props.rows.length},h(Svg,props))),h("p",{className:"analysis-mobile-hint small muted"},"可横向滑动查看完整图表。"),
      groupCount>20&&["line","area","box"].includes(props.config.type)&&h("p",{className:"small analysis-notice"},"当前有"+groupCount+"个采样分组，图形最多展示前20组。请选择具体分组查看其余数据；统计包含全部选中记录。"));
  }
  return {Svg,Figure,Boundary,palettes,paletteNames,types,format,date,escape,download,saveSvg};
})();
