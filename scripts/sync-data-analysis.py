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
    code='\n'.join((ROOT/'frontend'/name).read_text() for name in ['analysis-math.js','analysis-plots.js','data-analysis.js'])
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
    html=html[:match.start(2)]+base64.b64encode(js.encode()).decode()+html[match.end(2):]
    css='<style id="data-analysis-style">\n'+(ROOT/'frontend/data-analysis.css').read_text().rstrip()+'\n</style>'
    if 'id="data-analysis-style"' in html:html=re.sub(r'<style id="data-analysis-style">.*?</style>',lambda _:css,html,flags=re.S)
    else:html=html.replace('</head>',css+'\n</head>',1)
    return html

if __name__=='__main__':
    path=ROOT/'启动工程师工作台.html'
    path.write_text(render(path.read_text()))
