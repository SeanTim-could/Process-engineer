"""Build separate login-free editions without changing the managed website."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]
HTML_NAME='启动工程师工作台.html'
MARKER='<meta name="workbench-edition" content="offline">'


def render(html):
    match=re.search(r'(<script[^>]+src="data:text/javascript;base64,)([^"]+)',html)
    if not match:
        raise ValueError('Standalone script not found')
    js=base64.b64decode(match[2]).decode()
    start='/* managed-accounts:start */'
    end='/* managed-accounts:end */'
    if js.count(start)!=1 or js.count(end)!=1:
        raise ValueError('Account edition markers missing')
    js=js[:js.index(start)]+'/* offline-workspace:start */\n'+(ROOT/'frontend/offline-auth.js').read_text()+'\n/* offline-workspace:end */'+js[js.index(end)+len(end):]
    merge='else if(r.pathname==="/api/offline/merge"&&e.method==="POST"){a=await BackupMerge.handle(e,t.state,t.revision)}'
    if js.count(merge)!=1:
        raise ValueError('Managed import route marker missing')
    js=js.replace(merge,'')
    for old,new in [('Workbench-Excel-Python.zip','Workbench-Offline-Python.zip'),('Workbench-Windows-Portable.zip','Workbench-Offline-Windows.zip')]:
        js=js.replace(old,new)
    html=html[:match.start(2)]+base64.b64encode(js.encode()).decode()+html[match.end(2):]
    html=re.sub(r'<script id="web-entry-redirect">.*?</script>','',html,flags=re.S)
    html=re.sub(r'<style id="managed-accounts-style">.*?</style>','',html,flags=re.S)
    html=re.sub(r"connect-src [^;]+", "connect-src 'none'", html, count=1)
    html=html.replace('</head>',MARKER+'</head>',1)
    html=html.replace('<title>工艺工程师工作台</title>','<title>工程师工作台 · 免登录离线版</title>')
    if any(token in js for token in ['.supabase.co','/auth/v1/','/functions/v1/workbench-accounts','function Login(){','function Password(','function Admin(){','BackupMerge.']):
        raise ValueError('Offline edition still contains an account integration')
    return html


def checksum(archive):
    with ZipFile(archive) as target:
        if target.testzip() is not None:
            raise RuntimeError('Offline package CRC verification failed')
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_name(archive.name+'.sha256').write_text(digest+'  '+archive.name+'\n',encoding='ascii')
    return archive


def pack(folder,archive):
    with ZipFile(archive,'w',ZIP_DEFLATED) as target:
        for file in sorted(folder.rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                target.write(file,str(Path(folder.name)/file.relative_to(folder)))
    return checksum(archive)


def batch(python=False,documents=False,excel=False):
    arguments=' --offline'+(' --documents' if documents else '')+(' --excel-sync' if excel else '')
    lines=['@echo off','chcp 65001 >nul','setlocal','cd /d "%~dp0"']
    if not python:
        lines+=['if exist "%~dp0ProcessEngineerWorkbench.exe" (','  "%~dp0ProcessEngineerWorkbench.exe"'+arguments,'  goto end',')']
    lines+=['if defined WORKBENCH_PYTHON (','  "%WORKBENCH_PYTHON%" -u "%~dp0local_service\\launcher.py"'+arguments,') else (','  where py >nul 2>nul','  if not errorlevel 1 (','    py -3 -u "%~dp0local_service\\launcher.py"'+arguments,'  ) else (','    python -u "%~dp0local_service\\launcher.py"'+arguments,'  )',')',':end','echo.','echo 离线服务已结束。数据请通过工作台的保存或另存为保留。','pause']
    return ('\r\n'.join(lines)+'\r\n').encode('utf-8')


def prepare(folder,html):
    folder.mkdir(parents=True,exist_ok=True)
    (folder/HTML_NAME).write_text(html,encoding='utf-8')
    shutil.copy2(ROOT/'离线版使用说明.md',folder/'离线版使用说明.md')
    for name in ['THIRD-PARTY-NOTICES.txt','Dashboard使用说明.md','PCA使用说明.md']:
        shutil.copy2(ROOT/name,folder/name)
    shutil.copytree(ROOT/'licenses',folder/'licenses',dirs_exist_ok=True)


def companion(folder,html):
    prepare(folder,html)
    for name in ['安装Excel同步依赖.bat','requirements-excel-sync.txt','Excel自动同步使用说明.md']:
        shutil.copy2(ROOT/name,folder/name)
    guide=(ROOT/'Excel自动同步使用说明.md').read_text()
    guide='# Excel自动同步 · 免登录离线版\n\n完整解压本包，双击“启动离线工作台.bat”，直接进入本机工作台。无需登录网站。在“数据管理 → Excel自动同步”选择装置、分组，点击“连接本机Excel”，预览后允许发送。默认每60秒读取一次；PI分钟点需在Excel中设置1m取样间隔。使用本包的启动脚本，不要打开网站的登录入口。\n\n'+guide[guide.index('## 两种读取方式'):]
    guide=guide.replace('退出账号','关闭工作台').replace('按工作台账号及装置','按本机工作空间及装置').replace('本账号','本机工作空间').replace('当前账号','本机工作空间').replace('按账号','按本机工作空间')
    (folder/'Excel自动同步使用说明.md').write_text(guide,encoding='utf-8')
    (folder/'local_service').mkdir(exist_ok=True)
    for name in ['launcher.py','document_index.py','office_reader.py','excel_reader.py','excel_bridge.html']:
        shutil.copy2(ROOT/'local_service'/name,folder/'local_service'/name)
    for name,options in [('启动离线工作台.bat',{}),('启动工作台.bat',{}),('启动本地检索.bat',{'documents':True}),('启动Excel同步.bat',{'excel':True}),('启动Excel同步Python.bat',{'python':True,'excel':True})]:
        (folder/name).write_bytes(batch(**options))


def build(output,portable_dir=None):
    output=Path(output)
    output.mkdir(parents=True,exist_ok=True)
    html=render((ROOT/HTML_NAME).read_text())
    stage=output/'offline-staging'
    if stage.exists():
        shutil.rmtree(stage)
    single=stage/'WorkbenchOffline'
    prepare(single,html)
    result=[pack(single,output/'Workbench-Offline.zip')]
    source=stage/'WorkbenchOfflinePython'
    companion(source,html)
    result.append(pack(source,output/'Workbench-Offline-Python.zip'))
    if portable_dir:
        portable=stage/'ProcessEngineerWorkbench'
        shutil.copytree(portable_dir,portable)
        companion(portable,html)
        (portable/'便携版使用说明.txt').write_text((ROOT/'离线版使用说明.md').read_text(),encoding='utf-8')
        # Both the preferred external HTML and the bundled fallback must be offline.
        (portable/'_internal'/HTML_NAME).write_text(html,encoding='utf-8')
        info=json.loads((portable/'build-info.json').read_text())
        info.update(edition='offline',authentication=False,html_sha256=hashlib.sha256((portable/HTML_NAME).read_bytes()).hexdigest())
        (portable/'build-info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        result.append(pack(portable,output/'Workbench-Offline-Windows.zip'))
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Build login-free offline workbench packages')
    parser.add_argument('--output',default=str(ROOT/'Windows-Build'))
    parser.add_argument('--portable-dir',help='Verified Windows distribution to include in the offline edition')
    args=parser.parse_args()
    for archive in build(args.output,args.portable_dir):
        print(archive)
