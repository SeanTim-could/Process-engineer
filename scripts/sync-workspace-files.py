"""Embed Office-style workspace files and stable integration hooks."""
from pathlib import Path
import base64
import re

ROOT=Path(__file__).resolve().parents[1]
START='/* workspace-files:start */'
END='/* workspace-files:end */'

def render(html):
    match=re.search(r'(<script[^>]+src="data:text/javascript;base64,)([^"]+)',html)
    js=base64.b64decode(match[2]).decode()
    block=START+'\n'+(ROOT/'frontend/workspace-files.js').read_text()+'\n'+END
    if START in js:
        js=js[:js.index(START)]+block+js[js.index(END)+len(END):]
    else:
        def replace(old,new):
            nonlocal js
            if js.count(old)!=1:raise ValueError('File integration marker missing: '+old[:90])
            js=js.replace(old,new)
        replace('function Xwe(){',block+'function Xwe(){')
        replace('analytics:{version:1,revision:0,charts:[]}', 'analytics:{version:1,revision:0,charts:[],drafts:{}}')
        replace('function T0(e,t){','''function T0(e,t){try{let url=new URL(e instanceof Request?e.url:String(e),"http://offline.local"),method=t?.method??(e instanceof Request?e.method:"GET");if(url.pathname==="/api/offline/backup"&&method.toUpperCase()==="GET"){let namespace=AccountAuth.storageKey();return Ei().then(()=>{AccountAuth.assertWorkspace(namespace);return T0Core(e,t)});}return T0Core(e,t);}catch(error){return Promise.reject(error);}}function T0Core(e,t){''')
        replace('let t=await KG();VG(t.state);Eu.profile=', 'let t=await KG();WorkspaceFiles.changed(t.revision);VG(t.state);Eu.profile=')
        replace('version:1,exportedAt:new Date().toISOString(),state:{...t.state,profile:', 'version:1,exportedAt:new Date().toISOString(),workspaceRevision:t.revision,state:{...t.state,profile:')
        replace('return n.dirty&&a.ok&&await ZG(n.state,t.revision),a', 'if(n.dirty&&a.ok){await ZG(n.state,t.revision);if(r.pathname==="/api/offline/restore"){AnalysisDrafts.reset(n.state.analytics?.drafts);await WorkspaceFiles.forget();}WorkspaceFiles.changed(t.revision+1);}return a')
        start=js.index('async function p(){r(!0);try{await Ei();',js.index('function Xwe(){'))
        end=js.index('async function v(y){',start)
        js=js[:start]+'''async function p(){r(!0);try{n(await WorkspaceFiles.save(false))}catch(error){if(error.name!=="AbortError")n(error.message)}finally{r(!1)}}async function g(){r(!0);try{n(await WorkspaceFiles.save(true))}catch(error){if(error.name!=="AbortError")n(error.message)}finally{r(!1)}}(0,Pi.useEffect)(()=>WorkspaceFiles.shortcuts(p,g,t),[t]);async function openDocument(){try{if(typeof window.showOpenFilePicker==="function"){let selection=await WorkspaceFiles.chooseOpen();if(selection)await v(selection.file,selection);}else h.current?.click();}catch(error){if(error.name!=="AbortError")n(error.message);}}'''+js[end:]
        replace('async function v(y){r(!0);','async function v(y,selection){r(!0);')
        replace('await e.refresh(),l(w=>w+1)', 'await WorkspaceFiles.opened(y,selection?.handle,selection?.scope),await e.refresh(),l(w=>w+1)')
        replace('onClick:()=>h.current?.click(),children:', 'onClick:()=>openDocument(),children:')
        # Replace just the standalone toolbar labels; the archive format remains
        # compatible with all earlier JSON backups.
        start=js.index('function Xwe(){')
        end=js.index('i&&(0,Ye.jsxs)("div",{className:"offline-help"',start)
        toolbar=js[start:end]
        for old,new in [('保存到本机','保存'),('完整备份','另存为'),('恢复备份','打开')]:
            # Compiled labels use escaped Unicode, but newly readable text may not.
            escaped=''.join('\\u%04X'%ord(c) for c in old)
            toolbar=toolbar.replace('"'+escaped+'"','"'+new+'"').replace('"'+old+'"','"'+new+'"')
        caption_start=toolbar.index('(0,Ye.jsx)("span",{children:u.mode===')
        caption_end=toolbar.index('})]})',caption_start)+2
        toolbar=toolbar[:caption_start]+'(0,Ye.jsx)(WorkspaceFiles.Status,{})'+toolbar[caption_end:]
        js=js[:start]+toolbar+js[end:]
    js=js.replace('return Ei().then(()=>{AccountAuth.assertWorkspace(namespace);return T0Core(e,t)});','return AnalysisDrafts.resume().then(()=>Ei()).then(()=>{AccountAuth.assertWorkspace(namespace);return T0Core(e,t)});')
    js=js.replace('(u.mode==="temporary"||F1())','(u.mode==="temporary"||F1()||WorkspaceFiles.hasUnsaved())')
    js=js.replace('disabled:t,onClick:()=>{p()},children:', 'disabled:t,title:"保存到当前文件（Ctrl+S）",onClick:()=>{p()},children:')
    js=js.replace('disabled:t,onClick:()=>{g()},children:', 'disabled:t,title:"另存为新文件（Ctrl+Shift+S）",onClick:()=>{g()},children:')
    # Keep existing inline instructions aligned with the new file actions.
    for old,new in [('保存到本机','保存'),('完整备份','另存为'),('恢复备份','打开文件')]:
        escaped=''.join('\\u%04X'%ord(c) for c in old)
        js=js.replace(escaped,new)
    html=html[:match.start(2)]+base64.b64encode(js.encode()).decode()+html[match.end(2):]
    return html

if __name__=='__main__':
    path=ROOT/'启动工程师工作台.html'
    path.write_text(render(path.read_text()))
