"""Guarded presentation hooks over the recovered original bundle."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TITLE=(ROOT/'scripts/surface-root-title-original.txt').read_text()
PAIRS=[
 ('(s[l.key]=u??null)', '(s[l.key]=ImportValues.value(u??null,l))'),
 ('a=await i(e)}let n=$r();', 'a=await i(await ImportValues.request(e))}let n=$r();'),
 ('function HK(e,t,r){', 'function HK(e,t,r){return typeof DailyFlow!=="undefined"&&DailyFlow?DailyFlow.integral(e,t,r,HKInstant)??HKInstant(e,t,r):HKInstant(e,t,r)}function HKInstant(e,t,r){'),
 ('function Qs(e,t,r){', 'function Qs(e,t,r){let result=QsInstant(e,t,r);return typeof DailyFlow!=="undefined"&&DailyFlow?DailyFlow.summarize(result,e,t,r,HKInstant):result}function QsInstant(e,t,r){'),
 ('maxGapHours:o.maxGapHours??null,showTotal:', 'maxGapHours:o.maxGapHours??null,...o.flowBasis===undefined?{}:{flowBasis:DailyFlow.basis(o.flowBasis)},showTotal:'),
 ('(0,se.jsx)(RG,{column:o}),xr(o.unit)?.totalUnit&&', '(0,se.jsx)(RG,{column:o}),(0,se.jsx)(DailyFlow.Settings,{column:o,onChange:patch=>i(o.key,patch)}),xr(o.unit)?.totalUnit&&'),
 ('children:"\\u8D44\\u6599\\u3001\\u4E3B\\u9898\\u8272\\u548C\\u6587\\u4EF6\\u7D22\\u5F15\\u5747\\u5305\\u542B\\u5728\\u201C另存为\\u201D\\u4E2D\\u3002"', 'children:"另存为包含主题、语言和文件索引，不包含姓名、工号或登录信息。"'),
 ('state:{...t.state,profile:AccountAuth.decorate(t.state.profile)}});else if', 'state:WorkspaceFiles.exportState(t.state)});else if'),
 ('let i=DC(await e.json());Object.assign(qt(),i)', 'let i=WorkspaceFiles.restoreState(DC(await e.json()),t.state);Object.assign(qt(),i)'),
 ('o="profile"in t?jx(t.profile):zd()', 'o="profile"in t?jx({name:"",employeeId:"",...t.profile}):zd()'),
 ('archived:!!s.archived}}),n=new Set(cc.map', 'archived:!!s.archived,...(s.oee===void 0?{}:{oee:OEEWorkspace.unit(s.oee)})}}),n=new Set(cc.map'),
 ('D?(0,Ce.jsxs)(Ce.Fragment,{children:[(0,Ce.jsxs)("div",{className:"mapping-grid"', 'D?(0,Ce.jsxs)(Ce.Fragment,{children:[(0,Ce.jsx)(OEEView.Settings,{unit:D,onChange:H,disabled:d}),(0,Ce.jsxs)("div",{className:"mapping-grid"'),
 ('else if(r.pathname==="/api/pca"){a=await PCAWorkspace.request(e)}', 'else if(r.pathname==="/api/oee"){a=await OEEWorkspace.request(e)}else if(r.pathname==="/api/pca"){a=await PCAWorkspace.request(e)}'),
 ('"/api/dashboard","/api/pca"].includes(r.pathname)', '"/api/dashboard","/api/pca","/api/oee"].includes(r.pathname)'),
 ('c==="excel-sync"&&(0,B.jsx)(ExcelSync.Page,{settings:d}),', 'c==="oee"&&(0,B.jsx)(OEEView.Page,{unitId:t.view.unitId,refreshKey:Sr}),c==="excel-sync"&&(0,B.jsx)(ExcelSync.Page,{settings:d}),'),
 ('["live-data","excel-sync","dashboard","pca"].includes(c),c)', '["live-data","excel-sync","dashboard","pca","oee"].includes(c),c)'),
 ('["timeseries","capability","plotting","excel-sync","live-data","dashboard","pca"].includes(c),zs=', '["timeseries","capability","plotting","excel-sync","live-data","dashboard","pca","oee"].includes(c),zs='),

 ('let i=(n.getAttribute("viewBox")??"").split(/[ ,]+/).map(Number),o=i[2]', 'Surface.transparentPng(n);let i=(n.getAttribute("viewBox")??"").split(/[ ,]+/).map(Number),o=i[2]'),
 ('return d.fillStyle="#ffffff",d.fillRect(0,0,f.width,f.height),d.drawImage(c,0,0,f.width,f.height),', 'return d.drawImage(c,0,0,f.width,f.height),'),

 ('function QG({workspace:e,trends:t=!1}){', 'function QG(props){return (0,Z.jsx)(OverviewCards.Workspace,{...props,render:workspace=>(0,Z.jsx)(QGContent,{...props,workspace})})}function QGContent({workspace:e,trends:t=!1}){'),
 ('className:"shared-range-heading",children:[', 'className:"shared-range-heading",children:[(0,Z.jsx)(OverviewCards.Controls,{}),'),
 ('(0,Z.jsx)("div",{className:"kpi-grid",children:p.filter', '(0,Z.jsx)(OverviewCards.Grid,{kind:"kpi",className:"kpi-grid",children:p.filter'),
 ('className:"kpi-card kpi-0",children:[', 'className:"kpi-card kpi-0","data-overview-key":JSON.stringify([b.key,x.group]),"data-overview-label":[b.label,x.group].filter(Boolean).join(" · "),children:['),
 ('(0,Z.jsx)(jo,{size:17})', '(0,Z.jsx)(OverviewCards.Tools,{fallback:(0,Z.jsx)(jo,{size:17})})'),
 ('(0,Z.jsx)("div",{children:m?p.filter(x=>x.column.key===m.key).map(y):', '(0,Z.jsx)(OverviewCards.Grid,{kind:"chart",children:m?p.filter(x=>x.column.key===m.key).map(y):'),
 ('o&&(0,Z.jsx)(Ax,{dataset:l,onClose:()=>s(!1)', 'o&&(0,Z.jsx)(Ax,{dataset:OverviewCards.fullDataset(l),onClose:()=>s(!1)'),

 ('let b=x.column,S=pg(x.points,b,l.columns,u);', 'let b=x.column,S=pg(PointExclusions.apply(l.id,x.points),b,l.columns,u);'),
 ('(0,ue.jsxs)("b",{children:[(0,ue.jsx)("small",{className:"stat-value-label",children:"\\u5747\\u503C"}),nt(c.mean,3),(0,ue.jsx)("small",{children:c.meanUnit})]})', '(0,ue.jsxs)("div",{className:"mean-period-row",children:[(0,ue.jsxs)("b",{children:[(0,ue.jsx)("small",{className:"stat-value-label",children:"\\u5747\\u503C"}),nt(c.mean,3),(0,ue.jsx)("small",{children:c.meanUnit})]}),(0,ue.jsx)(PeriodComparison.Legacy,{rows:l,column:e,range:n,current:c})]})'),
 ('className:"kpi-value",children:[nt(S.mean,3),(0,Z.jsx)("small",{children:S.meanUnit})]', 'className:"kpi-value kpi-period-value",children:[(0,Z.jsxs)("span",{children:[nt(S.mean,3),(0,Z.jsx)("small",{children:S.meanUnit})]}),(0,Z.jsx)(PeriodComparison.Legacy,{rows:x.points,column:b,range:u,current:S,sourceId:l.id})]'),
 ('function AN({columns:e,onChange:t,importing:r=!1,onDelete:a}){', 'function AN({columns:e,onChange:t,importing:r=!1,onDelete:a,removalSelection:removal}){'),
 ('className:"table-wrap recognition-table",children:[(0,se.jsxs)("table",{children:[(0,se.jsx)("thead",{children:(0,se.jsxs)("tr",{children:[', 'className:"table-wrap recognition-table",children:[(0,se.jsxs)("table",{children:[(0,se.jsx)("thead",{children:(0,se.jsxs)("tr",{children:[removal&&(0,se.jsx)(MetricRemoval.Header,{selection:removal}),'),
 ('children:e.map(o=>(0,se.jsxs)("tr",{className:o.enabled?"":"column-disabled",children:[', 'children:e.map(o=>(0,se.jsxs)("tr",{className:o.enabled?"":"column-disabled",children:[removal&&(0,se.jsx)(MetricRemoval.Check,{selection:removal,column:o}),'),
 ('(0,ue.jsx)(AN,{columns:s,onChange:l,onDelete:g=>h(E1(s,[g]).map(v=>v.key))})', '(0,ue.jsx)(MetricRemoval.Editor,{columns:s,onChange:l,onSelectionChange:()=>h(null),onDelete:g=>h(E1(s,g).map(v=>v.key))})'),
 ('className:"panel chart-panel",children:[(0,B.jsx)(PointExclusions.Tools,{sourceId:"raw:"+t.id,keys:[d.id],allGroups:true,from:c??"",to:f??"",title:d.label}),', 'className:"panel chart-panel compact-chart-panel",children:['),
 ('(0,B.jsxs)("div",{className:"segmented",children:[', '(0,B.jsx)(PointExclusions.Tools,{sourceId:"raw:"+t.id,keys:[d.id],allGroups:true,from:c??"",to:f??"",title:d.label}),(0,B.jsxs)("div",{className:"segmented",children:['),
 ('className:"panel auto-chart-card","data-column-key":e.key,children:[(0,ue.jsx)(Dashboard.LegacyPin,{url:o,title:e.label}),(0,ue.jsx)(PointExclusions.LegacyTools,{url:o,title:e.label}),', 'className:"panel auto-chart-card compact-chart-card","data-column-key":e.key,children:['),
 ('f.label]})]}),(0,ue.jsxs)("a",{className:"button small-button"', 'f.label]})]}),(0,ue.jsxs)("div",{className:"button-row chart-actions",children:[(0,ue.jsx)(Dashboard.LegacyPin,{url:o,title:e.label}),(0,ue.jsx)(PointExclusions.LegacyTools,{url:o,title:e.label}),(0,ue.jsxs)("a",{className:"button small-button"'),
 ('children:[(0,ue.jsx)(ur,{size:15}),"PNG"]})]})', 'children:[(0,ue.jsx)(ur,{size:15}),"PNG"]})]})]})'),
 ((ROOT/'scripts/surface-workspace-card-original.txt').read_text(),'null/* workspace-summary-removed */'),
 ('Q=(0,It.useMemo)(()=>p3(),[]);ExcelSync.useImports','Q=(0,It.useMemo)(()=>p3(),[]);Surface.use(c,e.profile);ExcelSync.useImports'),
 ('(0,B.jsx)("span",{className:"brand-mark",children:(0,B.jsx)(Ks,{size:24})})','(0,B.jsx)(Surface.Logo,{})'),
 ('children:'+TITLE,'children:Surface.pageTitle(c)'),
 ('function Fi(he){he==="charts"','function Fi(he){if(he==="reports")return;he==="charts"'),
 ('e.label,s&&(0,ue.jsx)("span",{className:"badge neutral"','Surface.chartTitle({sourceId:pointSource},[e]),s&&(0,ue.jsx)("span",{className:"badge neutral"'),
 ('children:[b.label,x.label?','children:[Surface.chartTitle({sourceId:l.id},[b]),x.label?'),
 ('`${S.label}\\uFF1A${nt(S.totalValue,3)} ${S.unit}`','`累计：${nt(S.totalValue,3)} ${S.unit}`'),
 ('(0,Z.jsx)(E0,{unitId:e.view.unitId,month:e.view.month,onMonthChange:x=>e.updateView({month:x}),note:h,onSaved:e.saveNote},io(e.view.unitId,e.view.month))','null/* monthly-focus-removed */'),
 ('let G=ug(v,I,u.columns,b,y,s==="lims"&&t.get("connectMissing")==="1");A=', 'let G=Surface.exportSvg(ug(v,I,u.columns,b,y,s==="lims"&&t.get("connectMissing")==="1"),a.name+" · "+I.label);A='),
 ('children:"\\u540C\\u56FE\\u6BD4\\u8F83"', 'children:Surface.comparisonTitle(i.lines)'),
 ('__html:G.svg', '__html:Surface.exportSvg(G.svg,Surface.comparisonTitle(i.lines))'),
 ('_0(G.svg,', '_0(Surface.exportSvg(G.svg,Surface.comparisonTitle(i.lines)),'),
 ('m$(Q,Xe,ze,$e,`${He} \\u2192 ${Ke} \\xB7 ${z} \\u81F3 ${G}`)', 'Surface.exportSvg(m$(Q,Xe,ze,$e,`${He} \\u2192 ${Ke} \\xB7 ${z} \\u81F3 ${G}`),ze+" × "+$e)'),
 ('__html:ug(e.points,o,e.dataset.columns,"raw")', '__html:Surface.exportSvg(ug(e.points,o,e.dataset.columns,"raw"),Surface.chartTitle({sourceId:e.dataset.id},[o]))'),
 ('function pD(e,t,r){var a=null;', 'function pD(e,t,r){if(typeof Surface!=="undefined"&&Surface)t=Surface.localize(e,t);var a=null;'),
 ('return qC(e,i,n)};xt.createRef=', 'if(typeof Surface!=="undefined"&&Surface)n=Surface.localize(e,n);return qC(e,i,n)};xt.createRef='),
 ('function yD({children:e}){let[t,r]', 'function yD({children:e}){Surface.useRefresh();let[t,r]'),
 ('theme:t.theme}}function GC(', 'theme:t.theme,...t.language===undefined?{}:{language:["zh-CN","en"].includes(t.language)?t.language:(()=>{throw new Error("界面语言无效。")})()}}}function GC('),
 ('document.documentElement.dataset.theme=a.theme;return()=>{document.documentElement.dataset.theme=e.theme}},[a.theme,e.theme]', 'document.documentElement.dataset.theme=a.theme;Surface.previewLanguage(a.language??"zh-CN");return()=>{document.documentElement.dataset.theme=e.theme;Surface.previewLanguage(e.language??"zh-CN")}},[a.theme,e.theme,a.language,e.language]'),
 ('(0,ut.jsxs)("div",{className:"theme-settings",children:[', '(0,ut.jsx)(Surface.LanguageSettings,{value:a.language??"zh-CN",disabled:!r||i,onChange:language=>{n({...a,language}),c(!1)}}),(0,ut.jsxs)("div",{className:"theme-settings",children:['),
 ('[Q,Xe,ze,$e,He,Ke,z,G]),rt=', '[Q,Xe,ze,$e,He,Ke,z,G,Surface.language()]),rt='),
 ('children:[Number(b.slice(5)),"\\u6708"]', 'children:Surface.monthLabel(Number(b.slice(5)))'),
 ('children:["\\u4E00","\\u4E8C","\\u4E09","\\u56DB","\\u4E94","\\u516D","\\u65E5"].map(b=>(0,et.jsx)("span",{children:b},b))', 'children:["\\u4E00","\\u4E8C","\\u4E09","\\u56DB","\\u4E94","\\u516D","\\u65E5"].map(b=>(0,et.jsx)("span",{children:Surface.weekday(b)},b))'),
 ('className:"button-row chart-actions",children:[(0,ue.jsx)(Dashboard.LegacyPin', 'className:"button-row chart-actions",children:[(0,ue.jsx)(OverviewCards.Tools,{}),(0,ue.jsx)(Dashboard.LegacyPin'),
]
# Window formulas retain the native parser, validation, revision checks and save route.
PAIRS += [
 ('function Qs(e,t,r){let result=QsInstant(e,t,r);', 'function Qs(e,t,r){if(t.formula?.calculationMode==="interval")return IntervalFormulas.stats(t,r);let result=QsInstant(e,t,r);'),
 ('...t.matching!==void 0?{matching:IE(t.matching)}:{}};if(TE(a.expression', '...t.matching!==void 0?{matching:IE(t.matching)}:{},...t.calculationMode===undefined?{}:IntervalFormulas.configuration(t)};if(TE(a.expression'),
 ('let d={...u,source:t.source??o?.source??"production",formula:f},m=uc(', 'let d=IntervalFormulas.decorate({...u,source:t.source??o?.source??"production",formula:f},t,a),m=uc('),
 ('staged.datasets[a.id]={dataset:{...a,columns:m},points:Ho(m,r.points)};CrossUnit.recalculate(staged);', 'staged.datasets[a.id]={dataset:{...a,columns:m},points:Ho(m,r.points)};IntervalFormulas.validate(staged);CrossUnit.recalculate(staged);'),
 ('let h=staged.datasets[a.id].points;if(t.action==="preview"){let g=ag(m)', 'let h=staged.datasets[a.id].points;if(t.action==="preview"&&IntervalFormulas.is(d))return IntervalFormulas.preview(staged,a.id,d,t);if(t.action==="preview"){let g=ag(m)'),
 ('[referenceDevice,setReferenceDevice]=(0,Gr.useState)(r)', '[calculationMode,setCalculationMode]=(0,Gr.useState)("point"),[referenceDevice,setReferenceDevice]=(0,Gr.useState)(r)'),
 ('function He(Q){setReferenceDevice(r)', 'function He(Q){setCalculationMode(Q?.formula?.calculationMode??"point"),setReferenceDevice(r)'),
 ('let Sr=Q=>({action:Q,id:e.id,key:A?.key,label:D,unit:I,expression:j,', 'let Sr=Q=>({action:Q,id:e.id,key:A?.key,label:D,unit:I,calculationMode,expression:j,'),
 ('className:"modal-body formula-editor",children:[', 'className:"modal-body formula-editor",children:[(0,xe.jsx)(IntervalFormulas.Mode,{value:calculationMode,onChange:value=>{setCalculationMode(value);Ke()}}),'),
 ('L&&(0,xe.jsxs)("section",{className:"formula-preview"', 'L?.interval&&(0,xe.jsx)(IntervalFormulas.Preview,{value:L.interval}),L&&!L.interval&&(0,xe.jsxs)("section",{className:"formula-preview"'),
 ('(0,xe.jsxs)("td",{children:["\\u6709\\u6548 ",ze.valid," \\xB7 \\u7F3A\\u5931 ",ze.missing," \\xB7 \\u5F02\\u5E38 ",ze.errors]})', 'IntervalFormulas.is(Q)?(0,xe.jsx)("td",{children:(0,xe.jsx)(IntervalFormulas.Value,{column:Q,from:a,to:n})}):(0,xe.jsxs)("td",{children:["\\u6709\\u6548 ",ze.valid," \\xB7 \\u7F3A\\u5931 ",ze.missing," \\xB7 \\u5F02\\u5E38 ",ze.errors]})'),
 ('q(`\\u201C${D}\\u201D\\u5DF2\\u4FDD\\u5B58\\uFF0C\\u5DF2\\u8BA1\\u7B97\\u5168\\u90E8 ', 'q(calculationMode==="interval"?`“${D}”区间公式已保存，结果随所选时段更新。`:`\\u201C${D}\\u201D\\u5DF2\\u4FDD\\u5B58\\uFF0C\\u5DF2\\u8BA1\\u7B97\\u5168\\u90E8 '),
 ('function _N({column:e,columns:t,points:r,', 'function _N(props){return (0,ue.jsx)(IntervalFormulas.is(props.column)?IntervalFormulas.Card:PointChartNative,props)}function PointChartNative({column:e,columns:t,points:r,'),
 ('className:"kpi-bottom",children:(0,Z.jsxs)("div",{children:[(0,Z.jsx)("span",{children:"\\u5747\\u503C"})', 'className:"kpi-bottom",children:(0,Z.jsxs)("div",{children:[(0,Z.jsx)("span",{children:IntervalFormulas.is(b)?"区间计算值":"\\u5747\\u503C"})'),
 ('function ug(e,t,r,a,n,connectMissing=!1){', 'function ug(e,t,r,a,n,connectMissing=!1){if(IntervalFormulas.is(t))return IntervalFormulas.svg(t,n);'),
 ('(0,xe.jsxs)("div",{className:"mapping-grid",children:[(0,xe.jsxs)("label",{className:"form-label",children:["\\u65F6\\u95F4\\u5339\\u914D\\u57FA\\u51C6",(0,xe.jsxs)("select",{"aria-label":"\\u516C\\u5F0F\\u65F6\\u95F4\\u5339\\u914D\\u57FA\\u51C6",value:y,onChange:Q=>{x(Q.target.value),Ke()},children:[(0,xe.jsx)("option",{value:"lims",children:"以主LIMS采样时间为准，匹配其他引用"}),(0,xe.jsx)("option",{value:"production",children:"以当前装置生产时间为准，匹配其他引用"})]})]}),(0,xe.jsxs)("label",{className:"form-label",children:["\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE\\uFF08\\u5206\\u949F\\uFF09",(0,xe.jsx)("input",{"aria-label":"\\u516C\\u5F0F\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE",type:"number",min:"0",max:"44640",value:b,onChange:Q=>{S(Q.target.value),Ke()}})]})]}),(0,xe.jsx)("p",{className:"note-line",children:"同装置生产指标按本行计算；其他装置的数据按最近时间匹配，超过最大时间差或最近记录缺失时留空。LIMS基准使用主采样点时间，仅在各LIMS引用共同覆盖时段内生成结果。"}),y==="lims"&&(0,xe.jsxs)("label",{className:"form-label",children:["\\u4E3B LIMS \\u65F6\\u95F4\\u8F74",(0,xe.jsxs)("select",{"aria-label":"\\u516C\\u5F0F\\u4E3BLIMS\\u65F6\\u95F4\\u8F74",value:Ge,onChange:Q=>{u(Q.target.value),Ke()},children:[(0,xe.jsx)("option",{value:"",children:"\\u81EA\\u52A8\\uFF1A\\u4F7F\\u7528\\u516C\\u5F0F\\u4E2D\\u7684\\u9996\\u4E2ALIMS\\u5F15\\u7528"}),ne.map(Q=>(0,xe.jsx)("option",{value:JSON.stringify({key:Q.key,...Q.group!==void 0?{group:Q.group}:{},...Q.datasetId?{datasetId:Q.datasetId,unitId:Q.unitId}:{}}),children:Q.name},(Q.datasetId??e.id)+":"+Q.key+":"+Q.group))]}),(0,xe.jsx)("small",{children:"\\u53EA\\u5728\\u8FD9\\u4E2A\\u4F4D\\u70B9\\u7684\\u91C7\\u6837\\u65F6\\u523B\\u751F\\u6210\\u7ED3\\u679C\\uFF0C\\u5176\\u4ED6\\u4F4D\\u70B9\\u5339\\u914D\\u6700\\u8FD1\\u8BB0\\u5F55\\uFF0C\\u4E0D\\u4F1A\\u518D\\u6309\\u5404\\u4F4D\\u70B9\\u91CD\\u590D\\u751F\\u6210\\u66F2\\u7EBF\\u3002"})]}),', 'calculationMode==="point"&&(0,xe.jsxs)(xe.Fragment,{children:[(0,xe.jsxs)("div",{className:"mapping-grid",children:[(0,xe.jsxs)("label",{className:"form-label",children:["\\u65F6\\u95F4\\u5339\\u914D\\u57FA\\u51C6",(0,xe.jsxs)("select",{"aria-label":"\\u516C\\u5F0F\\u65F6\\u95F4\\u5339\\u914D\\u57FA\\u51C6",value:y,onChange:Q=>{x(Q.target.value),Ke()},children:[(0,xe.jsx)("option",{value:"lims",children:"以主LIMS采样时间为准，匹配其他引用"}),(0,xe.jsx)("option",{value:"production",children:"以当前装置生产时间为准，匹配其他引用"})]})]}),(0,xe.jsxs)("label",{className:"form-label",children:["\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE\\uFF08\\u5206\\u949F\\uFF09",(0,xe.jsx)("input",{"aria-label":"\\u516C\\u5F0F\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE",type:"number",min:"0",max:"44640",value:b,onChange:Q=>{S(Q.target.value),Ke()}})]})]}),(0,xe.jsx)("p",{className:"note-line",children:"同装置生产指标按本行计算；其他装置的数据按最近时间匹配，超过最大时间差或最近记录缺失时留空。LIMS基准使用主采样点时间，仅在各LIMS引用共同覆盖时段内生成结果。"}),y==="lims"&&(0,xe.jsxs)("label",{className:"form-label",children:["\\u4E3B LIMS \\u65F6\\u95F4\\u8F74",(0,xe.jsxs)("select",{"aria-label":"\\u516C\\u5F0F\\u4E3BLIMS\\u65F6\\u95F4\\u8F74",value:Ge,onChange:Q=>{u(Q.target.value),Ke()},children:[(0,xe.jsx)("option",{value:"",children:"\\u81EA\\u52A8\\uFF1A\\u4F7F\\u7528\\u516C\\u5F0F\\u4E2D\\u7684\\u9996\\u4E2ALIMS\\u5F15\\u7528"}),ne.map(Q=>(0,xe.jsx)("option",{value:JSON.stringify({key:Q.key,...Q.group!==void 0?{group:Q.group}:{},...Q.datasetId?{datasetId:Q.datasetId,unitId:Q.unitId}:{}}),children:Q.name},(Q.datasetId??e.id)+":"+Q.key+":"+Q.group))]}),(0,xe.jsx)("small",{children:"\\u53EA\\u5728\\u8FD9\\u4E2A\\u4F4D\\u70B9\\u7684\\u91C7\\u6837\\u65F6\\u523B\\u751F\\u6210\\u7ED3\\u679C\\uFF0C\\u5176\\u4ED6\\u4F4D\\u70B9\\u5339\\u914D\\u6700\\u8FD1\\u8BB0\\u5F55\\uFF0C\\u4E0D\\u4F1A\\u518D\\u6309\\u5404\\u4F4D\\u70B9\\u91CD\\u590D\\u751F\\u6210\\u66F2\\u7EBF\\u3002"})]})]}),'),
 ('(0,xe.jsx)("p",{children:"\\u6DF7\\u5408\\u516C\\u5F0F\\u53EF\\u9009\\u62E9LIMS\\u6216\\u751F\\u4EA7\\u65F6\\u95F4\\u4E3A\\u57FA\\u51C6\\uFF0C\\u5339\\u914D\\u524D\\u540E\\u6700\\u8FD1\\u8BB0\\u5F55\\uFF0C\\u8DDD\\u79BB\\u76F8\\u540C\\u53D6\\u8F83\\u65E9\\u8BB0\\u5F55\\u3002LIMS\\u57FA\\u51C6\\u53EA\\u4F7F\\u7528\\u4E00\\u4E2A\\u4E3B\\u4F4D\\u70B9\\u7684\\u65F6\\u95F4\\u8F74\\uFF1B\\u9ED8\\u8BA4\\u53D6\\u516C\\u5F0F\\u9996\\u4E2ALIMS\\u5F15\\u7528\\uFF0C\\u4E5F\\u53EF\\u81EA\\u884C\\u9009\\u62E9\\u3002\\u8BA1\\u7B97\\u533A\\u95F4\\u53D6\\u5404LIMS\\u5F15\\u7528\\u8986\\u76D6\\u65F6\\u6BB5\\u7684\\u4EA4\\u96C6\\uFF1B\\u53EA\\u6709\\u4E00\\u6761\\u8BB0\\u5F55\\u7684\\u4F4D\\u70B9\\uFF0C\\u4F7F\\u7528\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE\\u9650\\u5B9A\\u8BE5\\u8BB0\\u5F55\\u524D\\u540E\\u7684\\u6709\\u6548\\u7A97\\u53E3\\u3002\\u56FE\\u8868\\u53EA\\u6536\\u8D77\\u9996\\u5C3E\\u7A7A\\u767D\\uFF0C\\u5185\\u90E8\\u7F3A\\u5931\\u4ECD\\u4F1A\\u65AD\\u7EBF\\u3002\\u9ED8\\u8BA4\\u6700\\u5927\\u65F6\\u95F4\\u5DEE1440\\u5206\\u949F\\uFF0824\\u5C0F\\u65F6\\uFF09\\uFF0C\\u53EF\\u4EE5\\u8C03\\u6574\\uFF1B\\u8D85\\u8FC7\\u9650\\u5236\\u6216\\u6700\\u8FD1\\u8BB0\\u5F55\\u672C\\u8EAB\\u7F3A\\u5931\\u65F6\\u7ED3\\u679C\\u7559\\u7A7A\\u3002\\u751F\\u4EA7\\u5206\\u7EC4\\u548C\\u68C0\\u9A8C\\u91C7\\u6837\\u70B9\\u5206\\u522B\\u9009\\u62E9\\uFF0C\\u4E0D\\u6DF7\\u7528\\u3002\\u9884\\u89C8\\u5217\\u51FA\\u5404\\u5F15\\u7528\\u7684\\u5B9E\\u9645\\u5339\\u914D\\u65F6\\u95F4\\u53CA\\u6709\\u7B26\\u53F7\\u65F6\\u95F4\\u5DEE\\uFF08\\u5339\\u914D\\u8BB0\\u5F55\\u51CF\\u57FA\\u51C6\\u65F6\\u95F4\\uFF09\\u3002\\u8F93\\u5165\\u6309\\u4FDD\\u5B58\\u516C\\u5F0F\\u65F6\\u7684\\u5F15\\u7528\\u5355\\u4F4D\\u8BA1\\u7B97\\uFF1B\\u8F93\\u51FA\\u5355\\u4F4D\\u7531\\u4F60\\u6307\\u5B9A\\uFF0C\\u4E0D\\u81EA\\u52A8\\u63A8\\u5BFC\\u3002\\u5DF2\\u6709\\u517C\\u5BB9\\u5355\\u4F4D\\u6539\\u52A8\\u4F1A\\u81EA\\u52A8\\u6362\\u7B97\\uFF0C\\u907F\\u514D\\u6539\\u53D8\\u516C\\u5F0F\\u7684\\u6570\\u503C\\u542B\\u4E49\\u3002"})', 'calculationMode==="point"&&(0,xe.jsx)("p",{children:"\\u6DF7\\u5408\\u516C\\u5F0F\\u53EF\\u9009\\u62E9LIMS\\u6216\\u751F\\u4EA7\\u65F6\\u95F4\\u4E3A\\u57FA\\u51C6\\uFF0C\\u5339\\u914D\\u524D\\u540E\\u6700\\u8FD1\\u8BB0\\u5F55\\uFF0C\\u8DDD\\u79BB\\u76F8\\u540C\\u53D6\\u8F83\\u65E9\\u8BB0\\u5F55\\u3002LIMS\\u57FA\\u51C6\\u53EA\\u4F7F\\u7528\\u4E00\\u4E2A\\u4E3B\\u4F4D\\u70B9\\u7684\\u65F6\\u95F4\\u8F74\\uFF1B\\u9ED8\\u8BA4\\u53D6\\u516C\\u5F0F\\u9996\\u4E2ALIMS\\u5F15\\u7528\\uFF0C\\u4E5F\\u53EF\\u81EA\\u884C\\u9009\\u62E9\\u3002\\u8BA1\\u7B97\\u533A\\u95F4\\u53D6\\u5404LIMS\\u5F15\\u7528\\u8986\\u76D6\\u65F6\\u6BB5\\u7684\\u4EA4\\u96C6\\uFF1B\\u53EA\\u6709\\u4E00\\u6761\\u8BB0\\u5F55\\u7684\\u4F4D\\u70B9\\uFF0C\\u4F7F\\u7528\\u6700\\u5927\\u5339\\u914D\\u65F6\\u95F4\\u5DEE\\u9650\\u5B9A\\u8BE5\\u8BB0\\u5F55\\u524D\\u540E\\u7684\\u6709\\u6548\\u7A97\\u53E3\\u3002\\u56FE\\u8868\\u53EA\\u6536\\u8D77\\u9996\\u5C3E\\u7A7A\\u767D\\uFF0C\\u5185\\u90E8\\u7F3A\\u5931\\u4ECD\\u4F1A\\u65AD\\u7EBF\\u3002\\u9ED8\\u8BA4\\u6700\\u5927\\u65F6\\u95F4\\u5DEE1440\\u5206\\u949F\\uFF0824\\u5C0F\\u65F6\\uFF09\\uFF0C\\u53EF\\u4EE5\\u8C03\\u6574\\uFF1B\\u8D85\\u8FC7\\u9650\\u5236\\u6216\\u6700\\u8FD1\\u8BB0\\u5F55\\u672C\\u8EAB\\u7F3A\\u5931\\u65F6\\u7ED3\\u679C\\u7559\\u7A7A\\u3002\\u751F\\u4EA7\\u5206\\u7EC4\\u548C\\u68C0\\u9A8C\\u91C7\\u6837\\u70B9\\u5206\\u522B\\u9009\\u62E9\\uFF0C\\u4E0D\\u6DF7\\u7528\\u3002\\u9884\\u89C8\\u5217\\u51FA\\u5404\\u5F15\\u7528\\u7684\\u5B9E\\u9645\\u5339\\u914D\\u65F6\\u95F4\\u53CA\\u6709\\u7B26\\u53F7\\u65F6\\u95F4\\u5DEE\\uFF08\\u5339\\u914D\\u8BB0\\u5F55\\u51CF\\u57FA\\u51C6\\u65F6\\u95F4\\uFF09\\u3002\\u8F93\\u5165\\u6309\\u4FDD\\u5B58\\u516C\\u5F0F\\u65F6\\u7684\\u5F15\\u7528\\u5355\\u4F4D\\u8BA1\\u7B97\\uFF1B\\u8F93\\u51FA\\u5355\\u4F4D\\u7531\\u4F60\\u6307\\u5B9A\\uFF0C\\u4E0D\\u81EA\\u52A8\\u63A8\\u5BFC\\u3002\\u5DF2\\u6709\\u517C\\u5BB9\\u5355\\u4F4D\\u6539\\u52A8\\u4F1A\\u81EA\\u52A8\\u6362\\u7B97\\uFF0C\\u907F\\u514D\\u6539\\u53D8\\u516C\\u5F0F\\u7684\\u6570\\u503C\\u542B\\u4E49\\u3002"})'),
]

PAIRS += [('(0,Z.jsx)("span",{children:IntervalFormulas.is(b)?"区间计算值":"\\u5747\\u503C"})', '(0,Z.jsx)(IntervalFormulas.KPISummary,{column:b,stats:S,range:u})')]

PAIRS += [('children:[b.showTotal!==!1&&S.canTotal?(0,Z.jsxs)("b",{children:[nt(S.totalValue,3)," ",S.unit]})', 'children:[S.interval?(0,Z.jsx)(IntervalFormulas.TableValue,{value:S.interval}):b.showTotal!==!1&&S.canTotal?(0,Z.jsxs)("b",{children:[nt(S.totalValue,3)," ",S.unit]})'), ('className:"summary-detail",children:b.showTotal!==!1&&S.canTotal?S.detail:', 'className:"summary-detail",children:S.interval?(S.interval.reason??"按区间累计值代入公式"):b.showTotal!==!1&&S.canTotal?S.detail:')]

PAIRS += [('className:"kpi-value kpi-period-value",children:[', 'className:"kpi-value kpi-period-value",children:IntervalFormulas.is(b)?(0,Z.jsx)(IntervalFormulas.KPIValue,{column:b,stats:S,range:u}):[')]

PAIRS += [('let D=f===S?.id?s:cachedSeries?.points??[],z=S?to({dataset:f===S.id?u??S:cachedSeries?.dataset??S,points:D},e).points:[];return', 'let D=f===S?.id?s:cachedSeries?.points??[],z=S?to({dataset:f===S.id?u??S:cachedSeries?.dataset??S,points:D},e).points:[];if(S&&["overview","trends","charts","lims","analysis","comparison"].includes(viewPage))z=FormulaDailyData.view($r().state,S.id,z,{columns:S.columns});return'), ('async function va(e,t,r,a){', 'async function va(e,t,r,a){let result=await vaOriginal(e,t,r,a);return e==="GET"&&r&&result.dataset?{...result,points:FormulaDailyData.view($r().state,r,result.points,{columns:result.dataset.columns})}:result}async function vaOriginal(e,t,r,a){'), ('children:[S.interval?(0,Z.jsx)(IntervalFormulas.TableValue,{value:S.interval}):b.showTotal', 'children:[b.showTotal'), ('className:"summary-detail",children:S.interval?(S.interval.reason??"按区间累计值代入公式"):b.showTotal', 'className:"summary-detail",children:b.showTotal')]

PAIRS += [('FormulaDailyData.view($r().state,S.id,z,{columns:S.columns})', 'FormulaDailyData.view($r().state,S.id,z,{columns:S.columns.filter(column=>Ql(column)===e)})')]


# Custom indicator modules retain the six built-in IDs and store new names with
# each column. Every reader uses the same catalog, label and colour helpers.
PAIRS += [
 ('!Yl.some(l=>l.id===o.module)||!FE.some', '!MetricModules.valid(o.module)||!FE.some'),
 ('unit:o.unit.trim(),module:o.module,kind:', 'unit:o.unit.trim(),module:MetricModules.normalize(o.module),kind:'),
 ('(0,se.jsx)("select",{"aria-label":`${o.header}\\u6240\\u5C5E\\u6A21\\u5757`,value:o.module,onChange:s=>i(o.key,{module:s.target.value}),children:Yl.map(s=>(0,se.jsx)("option",{value:s.id,children:s.label},s.id))})', '(0,se.jsx)(MetricModules.Field,{column:o,columns:e,onChange:module=>i(o.key,{module})})'),
 ('Yl.find(v=>v.id===e.module)?.label', '(0,ue.jsx)(MetricModules.Label,{value:e.module})'),
 ('Qt=Yl.filter(Q=>ne?.columns.some', 'Qt=MetricModules.catalog(ne?.columns??[]).filter(Q=>ne?.columns.some'),
 ('h=EN[e.module],p=', 'h=MetricModules.color(e.module),p='),
 ('style:{background:EN[Q.id]}}),Q.label]', 'style:{background:MetricModules.color(Q.id)}}),(0,ue.jsx)(MetricModules.Label,{value:Q.id})]'),
 ('(!Yl.some(G=>G.id===S)||I.module===S)', '(!MetricModules.valid(S)||I.module===S)'),
]


# Overview cards and the detail table share the same enabled indicator catalog.
PAIRS += [('g=new Set([...d.filter(x=>!x.formula).slice(0,4),...d.filter(x=>x.formula)].map(x=>x.key))', 'g=new Set(d.map(x=>x.key))')]


PAIRS += [
 ('else if(r.pathname==="/api/oee"){a=await OEEWorkspace.request(e)}', 'else if(r.pathname==="/api/unit-removal"){a=await UnitRemoval.request(e)}else if(r.pathname==="/api/oee"){a=await OEEWorkspace.request(e)}'),
 ('PointExclusions.seed(n.state.analytics);LiveData.seed(n.state);if(r.pathname', 'PointExclusions.seed(n.state.analytics);LiveData.seed(n.state);if(r.pathname==="/api/unit-removal")UnitRemoval.committed(n.state);if(r.pathname'),
 ('u(L.id),p(!1)},children:[(0,Ce.jsx)(Qi,{size:13}),"\\u6062\\u590D\\u88C5\\u7F6E"]})]},L.id))', 'u(L.id),p(!1)},children:[(0,Ce.jsx)(Qi,{size:13}),"\\u6062\\u590D\\u88C5\\u7F6E"]}),(0,Ce.jsx)(UnitRemoval.Control,{unit:L,draft:o})]},L.id))'),
]


PAIRS += [
 ('else if(r.pathname==="/api/unit-removal"){a=await UnitRemoval.request(e)}', 'else if(r.pathname==="/api/yearly-means"){a=await YearlyMeans.request(e)}else if(r.pathname==="/api/unit-removal"){a=await UnitRemoval.request(e)}'),
 ('h=MetricModules.color(e.module),p=m.some', 'h=MetricModules.color(e.module),annual=YearlyMeans.use(YearlyMeans.fromExport(o),[e],f.unit),p=m.some'),
 ('(0,ue.jsx)("div",{className:"auto-chart-canvas"', '(0,ue.jsx)(YearlyMeans.Controls,{model:annual}),(0,ue.jsx)("div",{className:"auto-chart-canvas"'),
 ('(0,ue.jsx)(Fv,{type:"linear",dataKey:"value",name:e.label', '...annual.refs.map(ref=>(0,ue.jsx)(f2,{y:ref.value,ifOverflow:"extendDomain",stroke:ref.color,strokeDasharray:ref.dash,label:{value:YearlyMeans.caption(ref),position:ref.kind==="current"?"insideTopRight":"insideBottomRight",fill:ref.color,fontSize:10}},ref.id)),(0,ue.jsx)(Fv,{type:"linear",dataKey:"value",name:e.label'),
]


PAIRS += [
 ('function ug(e,t,r,a,n,connectMissing=!1){if(IntervalFormulas.is(t))', 'function ug(e,t,r,a,n,connectMissing=!1,yearlyConfig){if(IntervalFormulas.is(t))'),
 ('let i=UE(e,t,r,a,n),o=i.data,s=lg(o),l=s.flatMap(A=>[A.value,A.limit]).filter(A=>A!==null);', 'let i=UE(e,t,r,a,n),o=i.data,s=lg(o),annual=yearlyConfig?YearlyMeans.model(yearlyConfig,[t],i.unit).refs:[],l=[...s.flatMap(A=>[A.value,A.limit]),...annual.map(ref=>ref.value)].filter(A=>A!==null);'),
 ('ug(v,I,u.columns,b,y,s==="lims"&&t.get("connectMissing")==="1")', 'ug(v,I,u.columns,b,y,s==="lims"&&t.get("connectMissing")==="1",{sourceId:o.id,unitId:a.id,group:m,keys:[I.key],period:b})'),
 ('ug(c,d,e.columns,s,u?.range,u?.connectMissing)', 'ug(c,d,e.columns,s,u?.range,u?.connectMissing,{sourceId:e.id,unitId:t[0]?.unit,group:o,keys:[d.key],period:s})'),
 ('${y}${x}${b("limit"', '${y}${x}${YearlyMeans.svg(annual,{L:75,E:870,y:v})}${b("limit"'),
]

# Shared top notifications, including file actions. Keep each event separately timed.
PAIRS += [
 ('[A,E]=(0,It.useState)(""),[D,z]', '[A,E]=Surface.useNotice(),[D,z]'),
 ('[a,n]=(0,Pi.useState)(""),[i,o]', '[a,n]=Surface.useNotice(),[i,o]'),
 ('(0,It.useEffect)(()=>{if(!A)return;let he=setTimeout(()=>E(""),5e3);return()=>clearTimeout(he)},[A]),', '/* notice timer owned by Surface.Notification */'),
 ('A&&(0,B.jsxs)("div",{className:"toast",role:"status",children:[(0,B.jsx)(ar,{size:18}),(0,B.jsx)("span",{children:A}),(0,B.jsx)("button",{"aria-label":"\\u5173\\u95ED\\u63D0\\u793A",onClick:()=>E(""),children:(0,B.jsx)(Ai,{size:15})})]})', '(0,B.jsx)(Surface.Notification,{notice:A,onClose:()=>E(""),icon:(0,B.jsx)(ar,{size:18})})'),
 ('a&&(0,Ye.jsxs)("div",{className:"offline-message",role:"status",children:[(0,Ye.jsx)("span",{children:a}),(0,Ye.jsx)("button",{"aria-label":"\\u5173\\u95ED\\u79BB\\u7EBF\\u63D0\\u793A",onClick:()=>n(""),children:(0,Ye.jsx)(Ai,{size:16})})]})', '(0,Ye.jsx)(Surface.Notification,{notice:a,onClose:()=>n(""),kind:"offline-message"})'),
]

# Keep selected-period yearly comparisons and compact chart controls consistent.
PAIRS += [
 ('annual=YearlyMeans.use(YearlyMeans.fromExport(o),[e],f.unit)', 'annual=YearlyMeans.use(YearlyMeans.fromExport(o),[e],f.unit,{range:n})'),
 ('(0,ue.jsxs)("div",{className:"button-row chart-actions",children:[(0,ue.jsx)(OverviewCards.Tools,{})', '(0,ue.jsxs)(YearlyMeans.Header,{model:annual,children:[(0,ue.jsx)(OverviewCards.Tools,{})'),
 ('(0,ue.jsx)(YearlyMeans.Controls,{model:annual}),(0,ue.jsx)("div",{className:"auto-chart-canvas"', 'null/* annual controls moved to header */,(0,ue.jsx)("div",{className:"auto-chart-canvas"'),
 ('(0,ue.jsxs)("p",{children:[(0,ue.jsx)(MetricModules.Label,{value:e.module})," \\xB7 ",f.label]})', 'null/* chart module and sampling subtitle removed */'),
 ('YearlyMeans.model(yearlyConfig,[t],i.unit)', 'YearlyMeans.model({...yearlyConfig,range:n},[t],i.unit)'),
]

# Calendar portals escape panel clipping and synchronize valid date edits.
PAIRS += [
 ('d.current?.contains(C.target)||i(!1)', '(d.current?.contains(C.target)||CalendarOverlay.contains(m.current,C.target))||i(!1)'),
 ('(0,Ps.useEffect)(()=>u(h),[h]),(0,Ps.useEffect)(()=>{if(!n)return;', '(0,Ps.useEffect)(()=>u(h),[h]),(0,Ps.useEffect)(()=>{if(!a&&Pn(l))s(l.slice(0,7))},[a,l]),(0,Ps.useEffect)(()=>{if(!n)return;'),
 ('n&&(0,et.jsxs)("div",{className:"calendar-popover",role:"dialog"', 'n&&(0,et.jsxs)(CalendarOverlay.Popover,{anchor:m,onClose:()=>{i(!1),m.current?.focus()},className:"calendar-popover",role:"dialog"'),
]

PAIRS += [('onKeyDown:b=>{b.key==="Enter"&&g()}', 'onKeyDown:b=>{if(b.key==="Enter"){b.preventDefault();b.stopPropagation();g()}}')]

# Adaptive form fields and native comparison interaction hooks.
PAIRS += [
 ('if(typeof Surface!=="undefined"&&Surface)t=Surface.localize(e,t);var a=null;', 'if(typeof Surface!=="undefined"&&Surface)t=Surface.localize(e,t);if(typeof FormControls!=="undefined"&&FormControls)[e,t]=FormControls.adapt(e,t);var a=null;'),
 ('if(typeof Surface!=="undefined"&&Surface)n=Surface.localize(e,n);return qC(e,i,n)', 'if(typeof Surface!=="undefined"&&Surface)n=Surface.localize(e,n);if(typeof FormControls!=="undefined"&&FormControls)[e,n]=FormControls.adapt(e,n);return qC(e,i,n)'),
 ('let I=i.lines.filter(H=>!b.some', 'let comparisonZoom=ComparisonChart.useZoom(i),I=i.lines.filter(H=>!b.some'),
 ('T=jG(H,i);return{data:T,svg:HG(T)', 'T=ComparisonChart.model(jG(H,i),comparisonZoom.range);return{data:T,svg:HG(T)'),
 ('[u,p,w,i,a,e,v]);async function j()', '[u,p,w,i,a,e,v,comparisonZoom.range]);async function j()'),
 ('(0,Ie.jsx)("div",{className:"comparison-plot","data-testid":"comparison-chart",dangerouslySetInnerHTML:{__html:Surface.exportSvg(G.svg,Surface.comparisonTitle(i.lines))}})', '(0,Ie.jsx)(ComparisonChart.Plot,{data:G.data,svg:G.svg,title:Surface.comparisonTitle(i.lines),zoom:comparisonZoom})'),
 ('let o=Math.min(...i),s=Math.max(...i),l=v=>', 'let o=e.range?.[0]??Math.min(...i),s=e.range?.[1]??Math.max(...i),l=v=>'),
 ('unit:g,color:IN[o%8],title:', 'unit:g,color:ComparisonChart.color(i.selection.color,o),title:'),
 ('style:{background:IN[T]}})', 'style:{background:ComparisonChart.color(H.color,T)}})'),
 ('className:"comparison-line-head",children:[(0,Ie.jsxs)("b",', 'className:"comparison-line-head",children:[(0,Ie.jsx)(ComparisonChart.Color,{value:H.color,index:T,onChange:color=>A(H.id,{color})}),(0,Ie.jsxs)("b",'),
 ('return a.add(i.id),{id:i.id,unitId:i.unitId,datasetId:i.datasetId,key:i.key,group:i.group,', 'if(i.color!==undefined&&!ComparisonChart.validColor(i.color))throw new Error("曲线颜色无效，请选择有效颜色。");return a.add(i.id),{...i.color?{color:i.color}:{},id:i.id,unitId:i.unitId,datasetId:i.datasetId,key:i.key,group:i.group,'),
]

def prepare(js):
 js=js.replace('c==="overview"&&(0,B.jsx)(OEEView.Overview,{unitId:t.view.unitId,refreshKey:Sr}),','')
 js=js.replace('language:Surface.validLanguage(t.language)','language:["zh-CN","en"].includes(t.language)?t.language:(()=>{throw new Error("界面语言无效。")})()')
 js=js.replace("Surface.use(c);ExcelSync.useImports","ExcelSync.useImports")
 for old,new in reversed(PAIRS):
  if new in js:js=js.replace(new,old)
 return js

def apply(js):
 for old,new in PAIRS:
  if js.count(old)!=(2 if old in ['children:[b.label,x.label?','let b=x.column,S=pg(x.points,b,l.columns,u);','style:{background:EN[Q.id]}}),Q.label]'] else 1):raise ValueError('Surface integration marker missing: '+old[:85])
  js=js.replace(old,new)
 return js
