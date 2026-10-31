"""Guarded presentation hooks over the recovered original bundle."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TITLE=(ROOT/'scripts/surface-root-title-original.txt').read_text()
PAIRS=[
 ('Q=(0,It.useMemo)(()=>p3(),[]);ExcelSync.useImports','Q=(0,It.useMemo)(()=>p3(),[]);Surface.use(c);ExcelSync.useImports'),
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
]
def prepare(js):
 for old,new in PAIRS:
  if new in js:js=js.replace(new,old)
 return js

def apply(js):
 for old,new in PAIRS:
  if js.count(old)!=(2 if old=='children:[b.label,x.label?' else 1):raise ValueError('Surface integration marker missing: '+old[:85])
  js=js.replace(old,new)
 return js
