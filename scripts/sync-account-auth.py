"""Embed the account client, public configuration and CSS into the offline HTML."""
from pathlib import Path
from urllib.parse import urlsplit
import base64
import json
import re

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'启动工程师工作台.html'
START='/* managed-accounts:start */'
END='/* managed-accounts:end */'

def render(html,config):
    if set(config)!={'enabled','url','publicKey'} or type(config['enabled']) is not bool:
        raise ValueError('Invalid account configuration')
    key=config['publicKey']
    if not isinstance(key,str):
        raise ValueError('The public project key must be a string')
    if key:
        if key.startswith('sb_secret_'):
            raise ValueError('Never embed a server secret, even when login is disabled')
        if not key.startswith('sb_publishable_'):
            try:
                payload=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))
            except (ValueError,IndexError) as error:
                raise ValueError('Use a publishable key or legacy anon key') from error
            if not isinstance(payload,dict) or payload.get('role')!='anon':
                raise ValueError('Only the public anon key may be embedded; never use service_role')
    origin=''
    if config['enabled']:
        url=urlsplit(config['url'])
        if url.scheme!='https' or not url.hostname or not re.fullmatch(r'[A-Za-z0-9.-]+',url.hostname) or url.username or url.password or url.path not in ('','/') or url.query or url.fragment:
            raise ValueError('The account service URL must be an HTTPS origin')
        if not key:
            raise ValueError('The public project key is required')
        origin=f'{url.scheme}://{url.netloc}'
        config={**config,'url':origin}
    match=re.search(r'(<script[^>]+src="data:text/javascript;base64,)([^"]+)',html)
    js=base64.b64decode(match[2]).decode()
    module=(ROOT/'frontend/account-auth.js').read_text()
    block=START+'\nvar AccountAuthConfig='+json.dumps(config,ensure_ascii=True)+';\n'+module+'\n'+END
    if START in js:
        js=js[:js.index(START)]+block+js[js.index(END)+len(END):]
    else:
        marker='var jN={};'
        if js.count(marker)!=1:raise ValueError('Personal API marker missing')
        js=js.replace(marker,block+marker)
    html=html[:match.start(2)]+base64.b64encode(js.encode()).decode()+html[match.end(2):]
    css='<style id="managed-accounts-style">\n'+(ROOT/'frontend/account-auth.css').read_text()+'\n</style>'
    if 'id="managed-accounts-style"' in html:
        html=re.sub(r'<style id="managed-accounts-style">.*?</style>',lambda _:css,html,flags=re.S)
    else:html=html.replace('</head>',css+'\n</head>',1)
    connect="connect-src 'self' "+origin if origin else "connect-src 'none'"
    html=re.sub(r"connect-src [^;]+",lambda _:connect,html,count=1)
    return html

if __name__=='__main__':
    config=json.loads((ROOT/'frontend/auth-config.json').read_text())
    HTML.write_text(render(HTML.read_text(),config))
