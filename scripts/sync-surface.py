"""Guarded presentation hooks over the recovered original bundle."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TITLE=(ROOT/'scripts/surface-root-title-original.txt').read_text()
PAIRS=[
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
]
def prepare(js):
 js=js.replace('language:Surface.validLanguage(t.language)','language:["zh-CN","en"].includes(t.language)?t.language:(()=>{throw new Error("界面语言无效。")})()')
 js=js.replace("Surface.use(c);ExcelSync.useImports","ExcelSync.useImports")
 for old,new in PAIRS:
  if new in js:js=js.replace(new,old)
 return js

def apply(js):
 for old,new in PAIRS:
  if js.count(old)!=(2 if old in ['children:[b.label,x.label?','let b=x.column,S=pg(x.points,b,l.columns,u);'] else 1):raise ValueError('Surface integration marker missing: '+old[:85])
  js=js.replace(old,new)
 return js
