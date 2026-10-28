"""Embed the analysis workspace and its guarded integration points."""
from pathlib import Path
import base64
import re

ROOT=Path(__file__).resolve().parents[1]
START='/* data-analysis:start */'
END='/* data-analysis:end */'

def render(html):
    match=re.search(r'(<script[^>]+src="data:text/javascript;base64,)([^"]+)',html)
    if not match:raise ValueError('Standalone script not found')
    js=base64.b64decode(match[2]).decode()
    code='\n'.join((ROOT/'frontend'/name).read_text() for name in ['analysis-math.js','analysis-point-math.js','formula-syntax.js','analysis-plots.js','point-exclusions.js','analysis-drafts.js','capability-math.js','capability-split-chart.js','capability-reports.js','process-capability.js','pi-daily.js','excel-sync.js','data-analysis.js'])
    block=START+'\n'+code+'\n'+END
    if START in js:
        js=js[:js.index(START)]+block+js[js.index(END)+len(END):]
    else:
        def replace(old,new):
            nonlocal js
            if js.count(old)!=1:raise ValueError('Analysis integration marker missing: '+old[:100])
            js=js.replace(old,new)
        replace('var B=oe(yt(),1),w$=[',block+'var B=oe(yt(),1),w$=[...DataAnalysis.pages,')
        replace('comparison:Pd(),profile:zd(),fileLinks:[]','analytics:{version:1,revision:0,charts:[]},comparison:Pd(),profile:zd(),fileLinks:[]')
        replace('settings:r,records:t.records,reports:t.reports','analytics:DataAnalysis.normalize(t.analytics),settings:r,records:t.records,reports:t.reports')
        replace('else if(r.pathname==="/api/offline/merge"','else if(r.pathname==="/api/analytics"){a=await DataAnalysis.request(e)}else if(r.pathname==="/api/offline/merge"')
        replace('Ri=c==="profile"||c==="files"||c==="documents"','Ri=c==="profile"||c==="files"||c==="documents"||["timeseries","capability","plotting"].includes(c)')
        replace('jsx)("h1",{children:c==="documents"?', 'jsx)("h1",{children:c==="timeseries"?"把每一次波动，看得更清楚。":c==="capability"?"用数据，比较调整前后的能力。":c==="plotting"?"选好数据，画出你的工艺视角。":c==="documents"?')
        # The page description uses the same leading condition but a separate class.
        replace('className:"page-description",children:c==="documents"?', 'className:"page-description",children:["timeseries","capability","plotting"].includes(c)?"选择真实数据，查看时序、比较能力，或保存常用图表。":c==="documents"?')
        start=js.index('(0,B.jsx)("p",{className:"nav-caption",children:')
        end=js.index('(0,B.jsxs)("div",{className:"sidebar-bottom"',start)
        js=js[:start]+'(0,B.jsx)(DataAnalysis.Nav,{items:w$,current:c,onSelect:Fi,reportCount:vt?g.length+t.metricReports.length:0}),'+js[end:]
        replace('$e&&c==="lims"&&(0,B.jsx)(NN,', '["timeseries","capability","plotting"].includes(c)&&(0,B.jsx)(DataAnalysis.Page,{mode:c,refreshKey:Sr,onImport:()=>{He(null),z(!0)}},c),$e&&c==="lims"&&(0,B.jsx)(NN,')

    # Guarded upgrades of the original bundle: keep source records and formula
    # inputs intact, mask only chart/summary views, and refresh existing hooks.
    def hook(old,new):
        nonlocal js
        if new in js:return
        if old not in js:
            if new not in js:raise ValueError('Enhancement integration marker missing: '+old[:90])
            return
        if js.count(old)!=1:raise ValueError('Ambiguous enhancement marker: '+old[:90])
        js=js.replace(old,new)
    hook('function l3(e){let t=e.trim()', 'function l3(e){let t=FormulaSyntax.normalize(e).trim()')
    hook('function jm(e,t,r){if(!e.length)', 'function jm(e,t,r){return jmCore(typeof PointExclusions!=="undefined"?PointExclusions.filterRecords(e,t,r):e,t,r)}function jmCore(e,t,r){if(!e.length)')
    hook('VG(t.state);Eu.profile=', 'VG(t.state);PointExclusions.seed(t.state.analytics);Eu.profile=')
    hook('await ZG(n.state,t.revision);if(r.pathname', 'await ZG(n.state,t.revision);PointExclusions.seed(n.state.analytics);if(r.pathname')
    hook('function B1(e="production"){let[t,r]', 'function B1(e="production"){let pointVersion=PointExclusions.useVersion();let[t,r]')
    hook('()=>I.abort()},[S?.id,p]);', '()=>I.abort()},[S?.id,p,pointVersion]);')
    hook('onDatasetChange:u,onChanged:c}){let[f,d]', 'onDatasetChange:u,onChanged:c}){let pointVersion=PointExclusions.useVersion();let[f,d]')
    hook('[p,r,v,ne?.id,e]),He=', '[p,r,v,ne?.id,e,pointVersion]),He=')
    hook('s),u=l.dataset,c=l.points,f=t.get("from")', 's),u=l.dataset,c=t.get("format")==="csv"?l.points.map(PointExclusions.original):PointExclusions.apply(o.id,l.points),f=t.get("from")')
    hook('function zN(){let e=Lu()', 'function zN(){PointExclusions.useVersion();let e=Lu()')
    hook('Vt=vt?h:Q,lt=', 'Vt=vt?PointExclusions.recordView(h):Q,lt=')
    start=js.index('function to(e,t)');end=js.index('function C1(',start)
    segment=js[start:end]
    if 'PointExclusions.apply' not in segment:
        if segment.count('points:n}')!=1:raise ValueError('Scoped series points marker missing')
        js=js[:start]+segment.replace('points:n}','points:PointExclusions.apply(e.dataset.id,n)}')+js[end:]
    hook('connectMissing:connectMissing=!1}){let l=a??r,', 'connectMissing:connectMissing=!1}){PointExclusions.useVersion();let pointSource=new URL(o,"http://offline.local").searchParams.get("id");r=PointExclusions.apply(pointSource,r);a=a?PointExclusions.apply(pointSource,a):a;let l=a??r,')
    hook('className:"panel auto-chart-card","data-column-key":e.key,children:[', 'className:"panel auto-chart-card","data-column-key":e.key,children:[(0,ue.jsx)(PointExclusions.LegacyTools,{url:o,title:e.label}),')
    start=js.index('function S$({');end=js.index('function ',start+15)
    segment=js[start:end]
    if 'PointExclusions.Tools' not in segment:
        marker='className:"panel chart-panel",children:['
        if segment.count(marker)!=1:raise ValueError('Daily chart toolbar marker missing')
        replacement=marker+'(0,B.jsx)(PointExclusions.Tools,{sourceId:"raw:"+t.id,keys:[d.id],allGroups:true,from:c??"",to:f??"",title:d.label}),'
        js=js[:start]+segment.replace(marker,replacement)+js[end:]
    marker=r'(0,xe.jsx)("textarea",{ref:ie,"aria-label":"\u8BA1\u7B97\u516C\u5F0F",value:j,rows:3,maxLength:2048,placeholder:"[\u4EA7\u54C1\u91CF] / [\u8FDB\u6599\u91CF]",onChange:Q=>{H(Q.target.value),Ke()}})]})'
    if 'FormulaSyntax.Assistance,{value:j' not in js:
        if js.count(marker)!=1:raise ValueError('Formula textarea marker missing')
        js=js.replace(marker,marker+',(0,xe.jsx)(FormulaSyntax.Assistance,{value:j,inputRef:ie,onChange:value=>{H(value),Ke()}})')

    # Connect manual exclusions in display series without changing statistics.
    hook('function UE(e,t,r,a,n){let i=WK(GK(e,t,r,a,n)),', 'function UE(e,t,r,a,n){let i=AnalysisPointMath.plotSeries(WK(GK(e,t,r,a,n)),e,t,a,n),')
    hook('value:jm([b],d,t)})),h=t.targets[d.id]', 'value:jm([b],d,t)}));m=PointExclusions.rawChartData(m,e,d,t);let h=t.targets[d.id]')

    # Excel values arrive through a user-authorized local popup, then use the
    # existing account-local import/validation and cross-unit calculation graph.
    hook('var B=oe(yt(),1),w$=[...DataAnalysis.pages,', 'var B=oe(yt(),1),w$=[...ExcelSync.pages,...DataAnalysis.pages,')
    hook('analytics:DataAnalysis.normalize(t.analytics),settings:r', 'excelSync:ExcelSync.normalize(t.excelSync),analytics:DataAnalysis.normalize(t.analytics),settings:r')
    hook('else if(r.pathname==="/api/analytics")', 'else if(r.pathname==="/api/excel-sync"){a=await ExcelSync.request(e)}else if(r.pathname==="/api/analytics")')
    hook('AnalysisDrafts.reset(n.state.analytics?.drafts);', 'AnalysisDrafts.reset(n.state.analytics?.drafts);ExcelSync.reset();')
    hook('"timeseries","capability","plotting"].includes(c),zs=', '"timeseries","capability","plotting","excel-sync"].includes(c),zs=')
    hook('className:"page-description",children:["timeseries","capability","plotting"].includes(c)?', 'className:"page-description",children:c==="excel-sync"?"由Python读取Excel结果，自动加入当前账号的工作台。清晰预览，按时间追加。": ["timeseries","capability","plotting"].includes(c)?')
    hook('jsx)("h1",{children:c==="timeseries"?', 'jsx)("h1",{children:c==="excel-sync"?"让Excel里的数据，自动加入工作台。":c==="timeseries"?')
    marker='["timeseries","capability","plotting"].includes(c)&&(0,B.jsx)(DataAnalysis.Page,'
    hook(marker,'c==="excel-sync"&&(0,B.jsx)(ExcelSync.Page,{settings:d}),'+marker)
    hook('Q=(0,It.useMemo)(()=>p3(),[]);async function ze', 'Q=(0,It.useMemo)(()=>p3(),[]);ExcelSync.useImports(detail=>{Qt(v=>v+1);t.refresh(!t.dataset&&t.view.unitId===detail.unitId?detail.datasetId:undefined).catch(()=>{});});async function ze')

    html=html[:match.start(2)]+base64.b64encode(js.encode()).decode()+html[match.end(2):]
    css='<style id="data-analysis-style">\n'+(ROOT/'frontend/data-analysis.css').read_text().rstrip()+'\n</style>'
    if 'id="data-analysis-style"' in html:html=re.sub(r'<style id="data-analysis-style">.*?</style>',lambda _:css,html,flags=re.S)
    else:html=html.replace('</head>',css+'\n</head>',1)
    return html

if __name__=='__main__':
    path=ROOT/'启动工程师工作台.html'
    path.write_text(render(path.read_text()))
