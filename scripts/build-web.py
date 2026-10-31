"""Generate a small website login and cacheable application assets.

The original Chinese-named HTML remains a standalone portable application.
Run this after either embedded-module synchronizer changes that file.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import html as markup
import importlib.util
import json
import re

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'

LOADER='''<main class="startup-screen" role="status" aria-live="polite"><div><b>工程师工作台</b><h1>正在加载工作台…</h1><p id="web-startup-status">正在加载界面并验证身份，请稍候。</p><button id="web-startup-retry" type="button" hidden onclick="location.reload()">重新加载</button></div></main>'''
LOADER_CSS='''html,body{margin:0}.startup-screen{box-sizing:border-box;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#e8f7ef,#f5f9fc);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#244435}.startup-screen div{max-width:440px}.startup-screen b{color:#087f5b}.startup-screen h1{font-size:26px;margin:12px 0}.startup-screen p{color:#66796f}.startup-screen button{padding:10px 18px;border:0;border-radius:8px;background:#087f5b;color:white;font:inherit;cursor:pointer}'''
REDIRECT='''<script id="web-entry-redirect">if(location.hostname==="seantim-could.github.io"&&decodeURIComponent(location.pathname).endsWith("/启动工程师工作台.html"))location.replace(new URL("./index.html",location.href));</script>'''

def asset(name,content):
    digest=hashlib.sha256(content).hexdigest()[:16]
    relative=f'assets/{name[0]}.{digest}.{name[1]}'
    (ROOT/relative).write_bytes(content)
    return relative

def compressed_asset(relative, content):
    """Reuse a verified gzip fingerprint across Python/zlib versions in CI."""
    target=ROOT/(relative+'.gz')
    if target.exists():
        if gzip.decompress(target.read_bytes())!=content:
            raise ValueError('Compressed fingerprint does not match '+relative)
    else:
        with target.open('wb') as output:
            with gzip.GzipFile(filename='',mode='wb',fileobj=output,mtime=0,compresslevel=9) as packed:
                packed.write(content)
    digest=hashlib.sha256(content).digest()
    return {'url':'./'+relative,'compressed':'./'+relative+'.gz','bytes':target.stat().st_size,
            'sha256':digest.hex(),'integrity':'sha256-'+base64.b64encode(digest).decode()}

def build(config_override=None):
    source=ROOT/'启动工程师工作台.html'
    html=source.read_text()
    analysis_spec=importlib.util.spec_from_file_location('data_analysis_sync',ROOT/'scripts/sync-data-analysis.py')
    analysis=importlib.util.module_from_spec(analysis_spec)
    analysis_spec.loader.exec_module(analysis)
    html=analysis.render(html)
    files_spec=importlib.util.spec_from_file_location('workspace_files_sync',ROOT/'scripts/sync-workspace-files.py')
    files=importlib.util.module_from_spec(files_spec)
    files_spec.loader.exec_module(files)
    html=files.render(html)
    spec=importlib.util.spec_from_file_location('account_auth_sync',ROOT/'scripts/sync-account-auth.py')
    auth=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(auth)
    config=auth.normalize_config(config_override if config_override is not None else json.loads((ROOT/'frontend/auth-config.json').read_text()))
    html=auth.render(html,config)
    ASSETS.mkdir(exist_ok=True)
    if 'id="web-entry-redirect"' not in html:
        html=html.replace('<link rel="icon"',REDIRECT+'<link rel="icon"',1)
    if 'id="startup-screen-style"' not in html:
        html=html.replace('</head>','<style id="startup-screen-style">'+LOADER_CSS+'</style></head>',1)
    html=html.replace('<div id="root"></div>','<div id="root">'+LOADER+'</div>',1)
    source.write_text(html)

    match=re.search(r'<script[^>]+src="data:text/javascript;base64,([^\"]+)"[^>]*></script>',html)
    if not match:raise ValueError('Standalone application script not found')
    script=base64.b64decode(match[1])
    split_spec=importlib.util.spec_from_file_location('web_spreadsheet_split',ROOT/'scripts/split-web-spreadsheet.py')
    splitter=importlib.util.module_from_spec(split_spec)
    split_spec.loader.exec_module(splitter)
    script,spreadsheet_url=splitter.split(script,asset)
    # The loading screen can paint before the stylesheet arrives. Start the app
    # after styles are ready, while its download and live auth request overlap.
    script=b'(window.WorkbenchStartup?.styleReady||Promise.resolve()).then(()=>{\n'+script+'\nwindow.WorkbenchStartup?.ready();}).catch(()=>window.WorkbenchStartup?.fail("工作台未能加载，请重新加载。"));'.encode()
    script_url=asset(('workbench','js'),script)
    css='\n'.join(re.findall(r'<style\b[^>]*>(.*?)</style>',html,re.S))
    style_url=asset(('workbench','css'),css.encode())
    startup_assets={'script':compressed_asset(script_url,script),'style':compressed_asset(style_url,css.encode())}
    web=re.sub(r'<style\b[^>]*>.*?</style>','',html,flags=re.S)
    web=re.sub(r'<script id="web-entry-redirect">.*?</script>','',web,flags=re.S)
    web=re.sub(r'<script[^>]+src="data:text/javascript;base64,[^\"]+"[^>]*></script>','',web)
    web=web.replace("script-src 'unsafe-inline' data: blob:","script-src 'self' 'unsafe-inline' data: blob:")
    web=web.replace("style-src 'unsafe-inline'","style-src 'self' 'unsafe-inline'")
    if config['enabled']:
        key=json.dumps('workbench-auth:'+config['url'])
        guard='<script>try{var s=JSON.parse(sessionStorage.getItem('+key+')||"null");if(!s||!s.access_token||!s.refresh_token)location.replace(new URL("./index.html",location.href));}catch(e){location.replace(new URL("./index.html",location.href));}</script>'
        bootstrap='<script>window.WorkbenchWebAuthConfig='+json.dumps(config,ensure_ascii=True)+';</script><script>'+(ROOT/'frontend/web-auth-bootstrap.js').read_text()+'</script>'
        warm='<link rel="preconnect" href="'+markup.escape(config['url'])+'" crossorigin>'
        web=web.replace('<link rel="icon"',guard+warm+bootstrap+'<link rel="icon"',1)
    web=re.sub(r'<main class="startup-screen".*?</main>',lambda _:LOADER,web,flags=re.S)
    startup='<script>window.WorkbenchAssets='+json.dumps(startup_assets)+';</script><script>'+(ROOT/'frontend/web-startup.js').read_text()+'</script>'
    web=web.replace('<link rel="icon"',startup+'<link rel="icon"',1)
    web=web.replace('</head>',f'<style>{LOADER_CSS}</style></head>',1)
    (ROOT/'workbench.html').write_text(web)

    public={**config,'prefetch':['./workbench.html',startup_assets['script']['compressed'],startup_assets['style']['compressed']]}
    origin=config['url'] if config['enabled'] else ''
    connect="'self' "+origin if origin else "'self'"
    css=(ROOT/'frontend/account-auth.css').read_text()
    css+='\n*{box-sizing:border-box}body{margin:0;color:#244435;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}.account-form{width:min(440px,100%)}.account-login>section{width:min(440px,100%)}.account-form button{font:inherit;cursor:pointer;border:0;border-radius:9px;background:#087f5b;color:#fff}.account-form button:disabled{opacity:.6;cursor:wait}.account-form .form-label{display:block}.muted{color:#77897f}.small{font-size:12px}.error-banner{padding:10px;background:#fff1ef;border-radius:8px;color:#a83627}#web-login-status{min-height:1.6em} .account-form input{font:inherit}'
    script=(ROOT/'frontend/web-login.js').read_text()
    page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src CONNECT; form-action 'none'; base-uri 'none'">
<title>登录 · 工艺工程师工作台</title>PRECONNECT<style>STYLE</style></head><body><main class="account-login"><section><form id="web-login-form" class="account-form">
<span class="account-brand">工程师工作台</span><h1>登录你的工作台</h1><p class="muted">请使用管理员发放的工号和密码。</p>
<label class="form-label">登录工号<input aria-label="登录工号" name="employee" autocomplete="username" maxlength="40" required></label>
<label class="form-label">登录密码<input aria-label="登录密码" name="password" type="password" autocomplete="current-password" maxlength="128" required></label>
<p id="web-login-error" class="error-banner" role="alert" hidden></p><button id="web-login-submit" type="submit" disabled>登录</button>
<p id="web-login-status" class="small muted" role="status" aria-live="polite"></p><p class="small muted">没有账号或忘记密码，请联系管理员。</p>
<noscript>请启用浏览器的 JavaScript 后使用工作台。</noscript></form></section></main><script>window.WorkbenchWebConfig=CONFIG;
SCRIPT</script></body></html>'''
    page=page.replace('PRECONNECT',f'<link rel="preconnect" href="{markup.escape(origin)}" crossorigin>' if origin else '').replace('CONNECT',markup.escape(connect,quote=True))
    page=page.replace('STYLE',css).replace('CONFIG',json.dumps(public,ensure_ascii=True)).replace('SCRIPT',script)
    (ROOT/'index.html').write_text(page)
    # Keep previously published fingerprints: a cached page may still reference
    # them during deployment. Only the current pair is prefetched/downloaded.
    return {'index_bytes':len(page.encode()),'workbench_html_bytes':len(web.encode()),'script':script_url,'style':style_url,'spreadsheet':spreadsheet_url,'startup_compressed_bytes':sum(v['bytes'] for v in startup_assets.values())}

if __name__=='__main__':print(json.dumps(build(),ensure_ascii=False))
