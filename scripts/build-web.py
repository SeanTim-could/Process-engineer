"""Generate a small website login and cacheable application assets.

The original Chinese-named HTML remains a standalone portable application.
Run this after either embedded-module synchronizer changes that file.
"""
from pathlib import Path
import base64
import hashlib
import html as markup
import importlib.util
import json
import re

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'

LOADER='''<main class="startup-screen" role="status" aria-live="polite"><div><b>工程师工作台</b><h1>正在加载工作台…</h1><p>首次打开需要下载界面资源，请稍候。</p></div></main>'''
LOADER_CSS='''.startup-screen{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#e8f7ef,#f5f9fc);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#244435}.startup-screen div{max-width:440px}.startup-screen b{color:#087f5b}.startup-screen h1{font-size:26px;margin:12px 0}.startup-screen p{color:#66796f}'''
REDIRECT='''<script id="web-entry-redirect">if(location.hostname==="seantim-could.github.io"&&decodeURIComponent(location.pathname).endsWith("/启动工程师工作台.html"))location.replace(new URL("./index.html",location.href));</script>'''

def asset(name,content):
    digest=hashlib.sha256(content).hexdigest()[:16]
    relative=f'assets/{name[0]}.{digest}.{name[1]}'
    (ROOT/relative).write_bytes(content)
    return relative

def build(config_override=None):
    source=ROOT/'启动工程师工作台.html'
    html=source.read_text()
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
    script_url=asset(('workbench','js'),script)
    css='\n'.join(re.findall(r'<style\b[^>]*>(.*?)</style>',html,re.S))
    style_url=asset(('workbench','css'),css.encode())
    web=re.sub(r'<style\b[^>]*>.*?</style>','',html,flags=re.S)
    web=re.sub(r'<script id="web-entry-redirect">.*?</script>','',web,flags=re.S)
    web=re.sub(r'<script[^>]+src="data:text/javascript;base64,[^\"]+"[^>]*></script>',
        f'<script defer src="./{script_url}"></script>',web)
    web=web.replace("script-src 'unsafe-inline' data: blob:","script-src 'self' 'unsafe-inline' data: blob:")
    web=web.replace("style-src 'unsafe-inline'","style-src 'self' 'unsafe-inline'")
    if config['enabled']:
        key=json.dumps('workbench-auth:'+config['url'])
        guard='<script>try{var s=JSON.parse(sessionStorage.getItem('+key+')||"null");if(!s||!s.access_token||!s.refresh_token)location.replace(new URL("./index.html",location.href));}catch(e){location.replace(new URL("./index.html",location.href));}</script>'
        web=web.replace('<link rel="icon"',guard+'<link rel="icon"',1)
    web=web.replace('</head>',f'<style>{LOADER_CSS}</style><link rel="stylesheet" href="./{style_url}"></head>',1)
    (ROOT/'workbench.html').write_text(web)

    public={**config,'prefetch':['./workbench.html','./'+script_url,'./'+style_url]}
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
    return {'index_bytes':len(page.encode()),'workbench_html_bytes':len(web.encode()),'script':script_url,'style':style_url}

if __name__=='__main__':print(json.dumps(build(),ensure_ascii=False))
