// Read-only analysis over account-local data; saved chart recipes live in backups.
var DataAnalysis = (() => {
  const R=Se(),h=R.createElement,M=AnalysisMath,P=AnalysisPlots;
  const groups=[{id:"operations",label:"运行概览",items:["dashboard","overview","live-data","trends","lims","reports"]},
    {id:"analytics",label:"数据分析",items:["timeseries","capability","plotting","charts","comparison","analysis"]},
    {id:"data",label:"数据管理",items:["data","excel-sync","settings"]},{id:"personal",label:"文档与个人",items:["files","documents","profile"]}];
  const pages=[{id:"timeseries",label:"时序分析",en:"TIME SERIES",icon:Pm},{id:"capability",label:"前后能力分析",en:"BEFORE / AFTER",icon:jo},{id:"plotting",label:"自由作图",en:"CHART WORKSPACE",icon:Mn}];
  function Nav({items,current,onSelect,reportCount}){
    const active=groups.find(g=>g.items.includes(current))?.id,[open,setOpen]=R.useState(()=>new Set([active]));
    R.useEffect(()=>setOpen(old=>new Set([...old,active])),[active]);
    return h("nav",{className:"grouped-nav","aria-label":"工作空间导航"},...groups.map(group=>h("section",{key:group.id,className:"nav-group"},
      h("button",{className:"nav-group-toggle","aria-expanded":open.has(group.id),"aria-controls":"nav-"+group.id,onClick:()=>setOpen(old=>{const next=new Set(old);next.has(group.id)?next.delete(group.id):next.add(group.id);return next;})},h("span",null,group.label),h("span",{"aria-hidden":true},open.has(group.id)?"−":"+")),
      h("div",{id:"nav-"+group.id,hidden:!open.has(group.id),className:"nav-group-items"},...group.items.map(id=>{const item=items.find(i=>i.id===id);return item&&h("button",{key:id,onClick:()=>onSelect(id),className:current===id?"nav-item nav-child active":"nav-item nav-child","aria-current":current===id?"page":undefined},h(item.icon,{size:17}),h("span",null,item.label),id==="reports"&&reportCount>0&&h("small",null,reportCount),current===id&&h("i"));})))));
  }
  const text=(value,max,label)=>{if(typeof value!=="string"||value.length>max)throw new Error(label+"格式无效。");return value;};
  function chartConfig(value){
    if(!value||typeof value!=="object"||!Object.hasOwn(P.types,value.type))throw new Error("请选择支持的图表类型。");
    const sourceId=text(value.sourceId,200,"来源"),keys=value.keys;
    if(!/^(ds_[\w-]+|raw:[a-zA-Z0-9_-]{1,40})$/.test(sourceId)||!Array.isArray(keys)||keys.length<1||keys.length>6||keys.some(k=>typeof k!=="string"||!/^\w{1,100}$/.test(k))||new Set(keys).size!==keys.length)throw new Error("请选择数据来源和1至6个指标。");
    const title=text(value.title??"",120,"标题").trim()||P.types[value.type],group=text(value.group??"*",100,"分组"),from=text(value.from??"",23,"开始时间"),to=text(value.to??"",23,"结束时间");
    const a=M.time(from),b=M.time(to);if(a!==null&&b!==null&&a>b)throw new Error("开始时间不能晚于结束时间。");
    const xKey=text(value.xKey??"",100,"横轴指标");if(value.type==="scatter"&&!/^\w{1,100}$/.test(xKey))throw new Error("请选择散点图横轴指标。");
    const {lsl,usl}=M.limits(value.lsl,value.usl);
    return {sourceId,keys,title,type:value.type,group,allGroups:value.allGroups===true||value.allGroups===undefined&&group==="*",from,to,xKey,normalized:value.normalized===true,
      palette:Object.hasOwn(P.palettes,value.palette)?value.palette:"coast",period:["day","week","month","all"].includes(value.period)?value.period:"day",
      aggregation:value.aggregation==="sum"?"sum":"mean",boxBy:value.boxBy==="group"?"group":"metric",capabilitySize:Number.isInteger(value.capabilitySize)&&value.capabilitySize>=1&&value.capabilitySize<=100?value.capabilitySize:1,bins:Number.isInteger(value.bins)&&value.bins>=5&&value.bins<=100?value.bins:0,lsl,usl};
  }
  function normalize(value){
    if(value===undefined)return {version:1,revision:0,charts:[],drafts:{},exclusionRevision:0,excludedPoints:[],dashboard:Dashboard.normalize()};
    if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.charts)||value.charts.length>24)throw new Error("作图区备份格式无效，最多保存24张图表。");
    if(value.exclusionRevision!==undefined&&(!Number.isSafeInteger(value.exclusionRevision)||value.exclusionRevision<0))throw new Error("异常点版本无效。");
    const ids=new Set();return {version:1,dashboard:Dashboard.normalize(value.dashboard),revision:value.revision,exclusionRevision:value.exclusionRevision??0,excludedPoints:AnalysisPointMath.normalize(value.excludedPoints),drafts:AnalysisDrafts.normalize(value.drafts),charts:value.charts.map(chart=>{
      if(!chart||!/^chart_[\w-]{1,80}$/.test(chart.id)||ids.has(chart.id))throw new Error("图表编号无效或重复。");ids.add(chart.id);
      for(const key of ["createdAt","updatedAt"])if(typeof chart[key]!=="string"||!Number.isFinite(Date.parse(chart[key])))throw new Error("图表保存时间无效。");
      return {...chartConfig(chart),id:chart.id,createdAt:chart.createdAt,updatedAt:chart.updatedAt};
    })};
  }
  function sources(state){
    const active=state.settings.units.filter(u=>!u.archived),units=new Map(active.map(u=>[u.id,u]));
    const datasets=Object.values(state.datasets).filter(e=>e.dataset.status==="ready"&&e.dataset.role==="ledger"&&e.dataset.unitIds.some(id=>units.has(id))).map(e=>({id:e.dataset.id,name:(units.get(e.dataset.unitIds[0])?.name??e.dataset.name)+" · 完整指标",columns:e.dataset.columns.filter(c=>c.enabled&&c.kind!=="limit"),groups:e.dataset.groups})).filter(d=>d.columns.length);
    const raw=active.filter(u=>state.records.some(r=>r.unit===u.id)).map(u=>({id:"raw:"+u.id,name:u.name+" · 日报指标",groups:[""],columns:yf(state.settings,u).map(m=>({key:m.id,label:m.label,unit:m.unit,source:"production"}))})).filter(d=>d.columns.length);
    return [...datasets,...raw];
  }
  function series(state,id){
    const meta=sources(state).find(s=>s.id===id);if(!meta)throw new Error("来源装置已停用、指标已隐藏或数据集不存在，请重新选择。");
    if(id.startsWith("raw:")){
      const unit=state.settings.units.find(u=>u.id===id.slice(4)),metrics=yf(state.settings,unit);
      return {...meta,points:state.records.filter(r=>r.unit===unit.id).map(r=>({unit:unit.id,time:St(r.date),group:"",values:Object.fromEntries(metrics.map(m=>[m.id,jmCore([r],m,unit)]))})).sort((a,b)=>a.time-b.time)};
    }
    return {...meta,points:structuredClone(state.datasets[id].points).sort((a,b)=>a.time-b.time)};
  }
  async function request(req){
    const state=$r().state,u=new URL(req.url),saved=normalize(state.analytics);
    if(req.method==="GET"){if(!u.searchParams.has("id"))return Response.json({sources:sources(state),...saved});const data=series(state,u.searchParams.get("id"));return Response.json(u.searchParams.get("raw")==="1"?data:{...data,points:AnalysisPointMath.apply(data.id,data.points,saved.excludedPoints)});}
    if(req.method!=="PUT")throw new Error("分析操作无效。");
    const body=await Ha(req);
    if(["exclude-points","restore-points"].includes(body.action)){
      if(body.expectedExclusionRevision!==saved.exclusionRevision)throw new Error("异常点记录已在其他窗口更新，请关闭并重新打开选点窗口。");
      const points=AnalysisPointMath.normalize(body.points);if(!points.length)throw new Error("请先选择读数。");
      const current=new Map(saved.excludedPoints.map(p=>[AnalysisPointMath.identity(p),p]));
      if(body.action==="exclude-points"){
        const bySource=new Map();for(const p of points){if(!bySource.has(p.sourceId))bySource.set(p.sourceId,new Set(series(state,p.sourceId).points.flatMap(row=>Object.keys(row.values).filter(k=>M.finite(row.values[k])).map(k=>AnalysisPointMath.identity(AnalysisPointMath.observation(p.sourceId,row,k))))));if(!bySource.get(p.sourceId).has(AnalysisPointMath.identity(p)))throw new Error("所选原始读数已变化，请重新打开选点窗口核对。");current.set(AnalysisPointMath.identity(p),p);}
      }else for(const p of points)current.delete(AnalysisPointMath.identity(p));
      const result={...saved,exclusionRevision:saved.exclusionRevision+1,excludedPoints:AnalysisPointMath.normalize([...current.values()])};qt().analytics=result;return Response.json(result);
    }
    if(body.action==="draft"){if(!["timeseries","capability","plotting"].includes(body.mode))throw new Error("分析页面无效。");if(!AnalysisDrafts.accepts(body.clientEpoch))return Response.json({discarded:true});const draft=AnalysisDrafts.normalize({[body.mode]:body.draft})[body.mode];qt().analytics={...saved,drafts:{...saved.drafts,[body.mode]:draft}};return Response.json({draft});}if(body.expectedRevision!==saved.revision)throw new Error("作图区已被其他操作更新，请刷新列表后重试。");
    let charts=[...saved.charts],id=body.id;
    if(body.action==="delete"){if(!charts.some(c=>c.id===id))throw new Error("图表已不存在，请刷新列表。");charts=charts.filter(c=>c.id!==id);}
    else if(body.action==="save"){
      const config=chartConfig(body.config),data=series(state,config.sourceId);
      if(config.keys.some(key=>!data.columns.some(c=>c.key===key))||config.type==="scatter"&&!data.columns.some(c=>c.key===config.xKey))throw new Error("所选指标已变化，请重新选择后保存。");
      const index=charts.findIndex(c=>c.id===id);if(id&&index<0)throw new Error("要修改的图表已不存在，请重新载入。");
      const now=new Date().toISOString(),chart={...config,id:id??"chart_"+crypto.randomUUID(),createdAt:index>=0?charts[index].createdAt:now,updatedAt:now};
      if(index>=0)charts[index]=chart;else charts.push(chart);
    }else throw new Error("作图区操作无效。");
    const result=normalize({...saved,revision:saved.revision+1,charts});qt().analytics=result;return Response.json(result);
  }
  async function api(url,method="GET",body){const r=await T0(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
  const defaults={sourceId:"",keys:[],title:"",type:"line",group:"",allGroups:false,from:"",to:"",xKey:"",normalized:false,palette:"coast",period:"day",aggregation:"mean",boxBy:"metric",bins:0,lsl:"",usl:"",capabilitySize:1};
  const refs=config=>[{label:"规格下限",value:config.lsl===""?null:config.lsl===null?null:Number(config.lsl),color:"#d36a5b"},{label:"规格上限",value:config.usl===""?null:config.usl===null?null:Number(config.usl),color:"#d36a5b"}];
  function Field({label,children,...props}){return h("label",{className:"analysis-field"},h("span",null,label),children??h("input",{"aria-label":label,...props}));}
  function Select({label,value,onChange,options}){return h(Field,{label},h("select",{"aria-label":label,value,onChange:e=>onChange(e.target.value)},...options.map(o=>h("option",{key:o.value,value:o.value},o.label))));}
  function SpecFields({config,update}){return h(R.Fragment,null,h(Field,{label:"规格下限 LSL",type:"number",step:"any",placeholder:"可留空",value:config.lsl??"",onChange:e=>update({lsl:e.target.value})}),h(Field,{label:"规格上限 USL",type:"number",step:"any",placeholder:"可留空",value:config.usl??"",onChange:e=>update({usl:e.target.value})}));}
  function useData(sourceId,refreshKey){const pointVersion=PointExclusions.useVersion();const [data,setData]=R.useState(null),[error,setError]=R.useState("");
    R.useEffect(()=>{let live=true;setData(null);setError("");if(sourceId)api("/api/analytics?id="+encodeURIComponent(sourceId)).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[sourceId,refreshKey,pointVersion]);return {data,error};}
  function csv(rows,columns,extra=()=>[""]){
    const quote=v=>'"'+String(typeof v==="string"&&/^[=+\-@\t\r]/.test(v)?"'"+v:v??"").replace(/"/g,'""')+'"';
    return "\ufeff"+[["时间（北京时间）","分组",...columns.map(c=>c.label+(c.unit?" ("+c.unit+")":"")),"时段","已排除读数（原始值）"],...rows.map(r=>[P.date(r.time),r.group,...columns.map(c=>r.values[c.key]??""),...extra(r),columns.filter(c=>Object.hasOwn(r.excludedValues??{},c.key)).map(c=>c.label+"="+r.excludedValues[c.key]).join("；")])].map(row=>row.map(quote).join(",")).join("\r\n");
  }
  function exportReport(element,title,extra=""){
    const figures=[...element.querySelectorAll(".analysis-figure")].filter(el=>el.querySelector("svg")).map(el=>`<section><h2>${P.escape(el.querySelector("h3")?.textContent??"")}</h2><p>${P.escape(el.querySelector(".analysis-figure-head p")?.textContent??"")}</p>${el.querySelector("svg").outerHTML}</section>`).join("");
    const table=element.querySelector(".capability-table")?.outerHTML??"";
    P.download(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${P.escape(title)}</title><style>body{max-width:1100px;margin:32px auto;padding:20px;font:14px/1.7 Arial,'Microsoft YaHei',sans-serif;color:#294454}svg{width:100%;height:auto}section{break-inside:avoid;margin:28px 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9e4ea;padding:9px;text-align:left}h1{font-size:26px}.muted{color:#647987}@media print{button{display:none}}</style><h1>${P.escape(title)}</h1><p>导出时间：${P.escape(P.date(Date.now()))}（北京时间）</p><p>${P.escape(extra)}</p>${table}${figures}<p>能力指数采用个体值 I-MR 估计组内标准差（相邻有效个体的移动极差均值 / 1.128），总体标准差使用 n−1。缺失值不补零，且打断移动极差。统计使用全部选中记录，图形可能抽样。能力指数基于稳定、近似独立且近似正态过程的解释假设；时序分析中的过程能力表另附 Anderson–Darling 正态性检验。不能据此单独判定改善原因。</p></html>`,title+".html","text/html;charset=utf-8");
  }
  function SavedChart({chart,sources,refreshKey,onLoad,onDelete}){
    const [expanded,setExpanded]=R.useState(false),{data,error}=useData(expanded?chart.sourceId:"",refreshKey);let rows=[],failure=error;
    try{if(data)rows=M.select(data.points,chart);}catch(e){failure=e.message;}
    return h("section",{className:"analysis-saved-card"},h("div",{className:"analysis-saved-head"},h("div",null,h("b",null,chart.title),h("p",{className:"small muted"},P.types[chart.type]+" · "+(sources.find(s=>s.id===chart.sourceId)?.name??"来源已不可用"))),h("div",{className:"button-row"},h("button",{className:"button small-button","aria-expanded":expanded,onClick:()=>setExpanded(!expanded)},expanded?"收起图表":"展开图表"),h("button",{className:"button small-button",onClick:()=>onLoad(chart)},"载入编辑"),h("button",{className:"button small-button",onClick:()=>{if(window.confirm("删除保存的图表“"+chart.title+"”？原始数据会保留。"))onDelete(chart.id);}},"删除图表"))),
      expanded&&(failure?h("p",{role:"alert",className:"error-banner"},failure):data?h(P.Figure,{config:chart,rows,columns:data.columns,references:refs(chart),subtitle:data.name+"；分组 "+(chart.allGroups?"全部":chart.group||"未分组")+"；时间 "+(chart.from||"全部起始")+" 至 "+(chart.to||"全部结束")+"。读取当前数据，后续追加会反映在图中。"}):h("p",{role:"status"},"正在读取图表数据…")));
  }
  function Capability(props){return h(CapabilityReports.Workspace,{...props,Field,Select,SpecFields,api});}
  function Page({mode,refreshKey,onImport}){
    const [catalog,setCatalog]=R.useState({sources:[],charts:[],revision:0}),[config,setConfig]=AnalysisDrafts.usePart(mode,"config",{...defaults,...ViewDefaults.analysis()}),[error,setError]=R.useState(""),[notice,setNotice]=R.useState(""),[loading,setLoading]=R.useState(true),[editing,setEditing]=AnalysisDrafts.usePart(mode,"editing",null),[busy,setBusy]=R.useState(false),root=R.useRef(null),opening=R.useRef(true);
    const update=patch=>{setConfig(old=>({...old,...patch}));setError("");setNotice("");};
    async function reload(){const value=await api("/api/analytics");AnalysisDrafts.seed(value.drafts);setCatalog(value);setConfig(old=>old.sourceId?old:{...old,sourceId:value.sources[0]?.id??""});return value;}
    R.useEffect(()=>{let live=true;setLoading(true);api("/api/analytics").then(value=>{if(live){AnalysisDrafts.seed(value.drafts);setCatalog(value);setConfig(old=>({...old,sourceId:old.sourceId||value.sources[0]?.id||"",...opening.current?ViewDefaults.analysis():{}}));opening.current=false;}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[refreshKey]);
    const {data,error:dataError}=useData(config.sourceId,refreshKey);
    R.useEffect(()=>{if(!data)return;setConfig(old=>{const keys=old.keys.filter(k=>data.columns.some(c=>c.key===k)),first=keys[0]??data.columns[0]?.key;
      const available=[...new Set(data.points.filter(r=>first&&Object.hasOwn(r.values,first)).map(r=>r.group))];
      return {...old,keys:keys.length?keys:first?[first]:[],group:available.includes(old.group)||old.allGroups?old.group:available[0]??"",xKey:data.columns.some(c=>c.key===old.xKey)?old.xKey:data.columns.find(c=>c.key!==first)?.key??first??""};});},[data]);
    const column=data?.columns.find(c=>c.key===config.keys[0]);
    const groupOptions=[...new Set(data?.points.filter(r=>!column||Object.hasOwn(r.values,column.key)).map(r=>r.group)??[])];
    const selection=R.useMemo(()=>{try{let rows=data?M.select(data.points,config):[];if(mode!=="plotting"&&column)rows=rows.filter(r=>Object.hasOwn(r.values,column.key));return {rows,error:""};}catch(e){return {rows:[],error:e.message};}},[data,config.group,config.allGroups,config.from,config.to,column?.key,mode]);
    const rows=selection.rows,rangeError=selection.error,summary=R.useMemo(()=>column?M.capability(rows,column.key):null,[rows,column?.key]);
    async function save(asNew=false){setBusy(true);setError("");try{await Ei();const value=await api("/api/analytics","PUT",{action:"save",id:asNew?undefined:editing??undefined,config,expectedRevision:catalog.revision});setCatalog(old=>({...old,...value}));setEditing(asNew||!editing?value.charts.at(-1).id:editing);setNotice("图表配置已保存到作图区，也会包含在保存的工作台文件中。");}catch(e){setError(e.message);await reload().catch(()=>{});}finally{setBusy(false);}}
    async function remove(id){setError("");try{const value=await api("/api/analytics","PUT",{action:"delete",id,expectedRevision:catalog.revision});setCatalog(old=>({...old,...value}));if(editing===id)setEditing(null);}catch(e){setError(e.message);await reload().catch(()=>{});}}
    function load(chart){setConfig({...chart,lsl:chart.lsl??"",usl:chart.usl??""});setEditing(chart.id);setNotice("已载入“"+chart.title+"”，修改后点击“保存修改”。");root.current?.scrollIntoView({behavior:"smooth",block:"start"});}
    const figureConfig={...config,title:config.title||(mode==="timeseries"?"时序分析 · "+(column?.label??""):P.types[config.type]),type:mode==="timeseries"?"line":config.type};
    const references=mode==="timeseries"&&summary?[{label:"均值",value:summary.mean,color:"#477be3"},{label:"I图上控制限",value:summary.upperControl,color:"#b08b48"},{label:"I图下控制限",value:summary.lowerControl,color:"#b08b48"},...refs(config)]:refs(config);
    return h("div",{className:"analysis-workbench",ref:root},h(AnalysisDrafts.Notice,{mode}),loading&&h("p",{role:"status"},"正在读取分析数据…"),
      h("section",{className:"panel analysis-controls"},h("div",{className:"analysis-figure-head"},h("div",null,h("h2",null,mode==="capability"?"前后能力分析":mode==="timeseries"?"时序分析":"自由作图"),h("p",{className:"muted"},"直接使用当前账号已导入的生产、LIMS检验或日报指标，分析过程不修改原始数据。")),h("button",{className:"button",onClick:onImport},"导入分析数据")),
        !loading&&!catalog.sources.length?h("p",{className:"analysis-empty"},"还没有可分析的数据。请先导入表格，再选择装置和指标。"):h(R.Fragment,null,h("div",{className:"analysis-fields"},
          h(Select,{label:"分析数据来源",value:config.sourceId,onChange:sourceId=>{setEditing(null);update({sourceId,keys:[],group:"",allGroups:false,...ViewDefaults.analysis(),xKey:"",lsl:"",usl:"",normalized:false});},options:catalog.sources.map(s=>({value:s.id,label:s.name}))}),
          h(Select,{label:mode==="plotting"?"主要指标 / 纵轴":"分析指标",value:config.keys[0]??"",onChange:key=>update({keys:[key],group:data?.points.find(r=>Object.hasOwn(r.values,key))?.group??"",allGroups:false,normalized:false,lsl:"",usl:""}),options:(data?.columns??[]).map(c=>({value:c.key,label:(c.source==="lims"?"LIMS · ":"")+c.label+(c.unit?" / "+c.unit:"")}))}),
          h(Select,{label:"采样分组",value:config.allGroups?"*":JSON.stringify(config.group),onChange:value=>update(value==="*"?{allGroups:true}:{group:JSON.parse(value),allGroups:false}),options:[...groupOptions.map(g=>({value:JSON.stringify(g),label:g||"未分组"})),{value:"*",label:"全部分组（合并分析）"}]}),
          h(Field,{label:"分析开始（北京时间）",type:"datetime-local",value:config.from,onChange:e=>update({from:e.target.value})}),h(Field,{label:"分析结束（北京时间）",type:"datetime-local",value:config.to,onChange:e=>update({to:e.target.value})})),
          config.allGroups&&groupOptions.length>1&&h("p",{className:"analysis-notice small"},"当前选择了全部分组：统计会合并不同采样点，时序线仍按分组分别绘制。能力分析建议使用同一工况、同一采样点。"),
          data&&h("p",{className:"small muted"},`选中 ${rows.length} 条记录，主要指标 ${summary?.n??0} 个有效值、${summary?.missing??0} 个缺失值。缺失不补零；大数据图形会抽样，统计及数据导出使用全部选中记录。`))),
      [error,dataError,rangeError].filter(Boolean).map((message,i)=>h("p",{key:i,role:"alert",className:"error-banner"},message)),notice&&h("p",{role:"status",className:"analysis-notice"},notice),
      data&&column&&!rangeError&&h(R.Fragment,null,mode==="capability"?h(Capability,{key:config.sourceId+":"+column.key,rows,column,config,update,root,sourceName:data.name,sources:catalog.sources,refreshKey}):h(R.Fragment,null,
        h("section",{className:"panel analysis-controls"},mode==="plotting"?h(R.Fragment,null,h("div",{className:"analysis-fields"},
          h(Field,{label:"图表标题",value:config.title,maxLength:120,placeholder:column.label,onChange:e=>update({title:e.target.value})}),
          h(Select,{label:"图表类型",value:config.type,onChange:type=>update({type,...["scatter","histogram"].includes(type)?{keys:config.keys.slice(0,1),normalized:false}:{}}),options:Object.entries(P.types).map(([value,label])=>({value,label}))}),
          h(Select,{label:"图表配色",value:config.palette,onChange:palette=>update({palette}),options:Object.entries(P.paletteNames).map(([value,label])=>({value,label}))}),
          config.type==="scatter"&&h(Select,{label:"散点横轴指标",value:config.xKey,onChange:xKey=>update({xKey}),options:data.columns.map(c=>({value:c.key,label:c.label+(c.unit?" / "+c.unit:"")}))}),
          config.type==="bar"&&h(R.Fragment,null,h(Select,{label:"柱状图汇总周期",value:config.period,onChange:period=>update({period}),options:[{value:"day",label:"按日"},{value:"week",label:"按周（周一开始）"},{value:"month",label:"按月"},{value:"all",label:"按采样分组"}]}),h(Select,{label:"柱状图汇总方法",value:config.aggregation,onChange:aggregation=>update({aggregation}),options:[{value:"mean",label:"有效值均值"},{value:"sum",label:"有效值求和"}]})),
          config.type==="histogram"&&h(Select,{label:"直方图分箱",value:String(config.bins),onChange:bins=>update({bins:Number(bins)}),options:[{value:"0",label:"自动（四分位距规则）"},...[5,10,15,20,30,50,100].map(n=>({value:String(n),label:n+"箱"}))]}),
          config.type==="box"&&h(Select,{label:"箱线图分组",value:config.boxBy,onChange:boxBy=>update({boxBy}),options:[{value:"metric",label:"按指标"},{value:"group",label:"按采样分组（单个指标）"}]}),h(SpecFields,{config,update})),
          h("details",{className:"analysis-palette-picker"},h("summary",null,"预览全部12组配色"),h("div",{className:"analysis-palette-grid"},...Object.entries(P.palettes).map(([id,colors])=>h("button",{key:id,type:"button","aria-pressed":config.palette===id,onClick:()=>update({palette:id}),className:"palette-choice"},h("span",null,P.paletteNames[id]),h("span",{className:"palette-stripes","aria-hidden":true},...colors.map(color=>h("i",{key:color,style:{background:color}}))))))),
          ["line","area","bar","box"].includes(config.type)&&h("fieldset",{className:"analysis-metrics"},h("legend",null,"同图指标（最多6个）"),...data.columns.map(c=>h("label",{key:c.key},h("input",{type:"checkbox",checked:config.keys.includes(c.key),disabled:!config.keys.includes(c.key)&&config.keys.length>=6,"aria-label":"同图指标："+c.label,onChange:e=>{const keys=e.target.checked?[...config.keys,c.key]:config.keys.filter(k=>k!==c.key);if(keys.length)update({keys});}}),c.label+(c.unit?" / "+c.unit:""))),h("label",{className:"analysis-normalize"},h("input",{type:"checkbox",checked:config.normalized,onChange:e=>update({normalized:e.target.checked})}),"各指标归一化到0–1（比较变化形态）")),
          config.type==="scatter"&&h("p",{className:"small muted"},"散点图只配对同一条记录中的横、纵轴数值。跨装置或不同采样时间的配对请使用左侧“关系分析”。"),
          config.type==="bar"&&config.aggregation==="sum"&&h("p",{className:"analysis-notice small"},"求和不等于时间积分。流量、含量和统计量请按用途选择均值；仅对适合累加的数据求和。"),
          h("div",{className:"button-row"},h("button",{className:"button primary",disabled:busy,onClick:()=>save(false)},editing?"保存修改":"保存到作图区"),editing&&h("button",{className:"button",disabled:busy,onClick:()=>save(true)},"另存为新图表"))) :h(R.Fragment,null,h("div",{className:"analysis-fields"},h(SpecFields,{config,update})),h("div",{className:"analysis-stat-strip"},...[['有效样本',summary.n],['均值',summary.mean],['标准差',summary.sd],['3σ外点',summary.controlSignals]].map(([label,v])=>h("div",{key:label},h("small",null,label),h("b",null,P.format(v))))),h("p",{className:"small muted"},"I图控制限=均值±3×组内标准差，组内标准差=移动极差均值/1.128。MR图按同一分组相邻记录计算，缺失读数打断配对；0个超限点不代表过程已通过完整稳定性检验。"))),
        h("div",{className:"button-row analysis-export-row"},h(PointExclusions.Tools,{...config,title:figureConfig.title}),h("button",{className:"button",onClick:()=>P.download(csv(rows,data.columns.filter(c=>config.keys.includes(c.key)||config.type==="scatter"&&c.key===config.xKey)),(config.title||"分析数据")+".csv","text/csv;charset=utf-8")},"导出分析数据"),h("button",{className:"button",onClick:()=>exportReport(root.current,figureConfig.title,`${data.name}；分组 ${config.allGroups?"全部":config.group||"未分组"}；时间 ${config.from||"全部起始"} 至 ${config.to||"全部结束"}；有效样本 ${summary.n}。`)},"导出分析报告")),
        h(P.Figure,{config:figureConfig,rows,columns:data.columns,references,subtitle:data.name+" · "+(config.allGroups?"全部分组":config.group||"未分组")}),
        mode==="timeseries"&&h(ProcessCapability.Panel,{rows,column,config,update,Field}),
        mode==="timeseries"&&h(P.Figure,{config:{...config,keys:["range"],type:"line",title:"移动极差 MR",normalized:false},pointQuery:{...config,keys:[column.key]},rows:M.movingRanges(rows,column.key),columns:[{key:"range",label:"相邻个体移动极差",unit:column.unit}],references:[{label:"MR均值",value:summary.mrbar,color:"#477be3"},{label:"MR上控制限",value:summary.mrbar===null?null:summary.mrbar*3.267,color:"#b08b48"},{label:"MR下控制限",value:0,color:"#b08b48"}],subtitle:"移动极差使用相邻有效读数的绝对差；不同分组分别计算。"}))),
      mode==="plotting"&&h("section",{className:"panel analysis-board"},h("div",{className:"analysis-figure-head"},h("div",null,h("h2",null,"我的作图区"),h("p",{className:"small muted"},"保存图表条件，后续打开自动读取当前数据；配置随账号隔离并包含在保存的工作台文件中。最多24张。")),h("button",{className:"button",onClick:()=>reload().catch(e=>setError(e.message))},"刷新图表列表")),!catalog.charts.length?h("p",{className:"analysis-empty"},"选好数据和图形后，点击“保存到作图区”，在这里积累常用图表。"):catalog.charts.map(chart=>h(SavedChart,{key:chart.id,chart,sources:catalog.sources,refreshKey,onLoad:load,onDelete:remove}))));
  }
  return {Nav,pages,Page,request,normalize,chartConfig,sources,series};
})();
