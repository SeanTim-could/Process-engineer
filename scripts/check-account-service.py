"""Read-only readiness checks for the configured Supabase project.

Never signs in, guesses a password, creates accounts, or prints returned identity
rows. The public project key is the only credential used.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
import json
import sys

ROOT=Path(__file__).resolve().parents[1]

def check_service(config):
    if not config['enabled']:
        print('Account service is not enabled; no live requests made.')
        return
    base=config['url'].rstrip('/')
    origin='https://seantim-could.github.io'
    def request(path,method='GET',body=None,headers=None):
        req=Request(base+path,method=method,data=None if body is None else json.dumps(body).encode(),
                    headers={'apikey':config['publicKey'],'Content-Type':'application/json',**(headers or {})})
        try:response=urlopen(req,timeout=25)
        except HTTPError as error:response=error
        with response:
            raw=response.read(65536)
            try:data=json.loads(raw) if raw else None
            except ValueError:data=None
            return response.status,response.headers,data
    def require(value,message):
        if not value:raise RuntimeError(message)

    status,_,settings=request('/auth/v1/settings')
    require(status==200 and isinstance(settings,dict),'Cannot read Auth settings with the configured public key.')
    require(settings.get('disable_signup') is True,'Self-service signup must be disabled before enabling managed accounts.')
    require(settings.get('external',{}).get('email') is True,'The email/password login provider is not enabled.')
    print('PASS: project public key works; self-service signup is disabled; email login is enabled.',flush=True)

    status,_,_=request('/rest/v1/workbench_profiles?select=id&limit=1')
    require(status in (401,403),'Anonymous callers must not be allowed to read the account identity table.')
    print('PASS: the identity table denies anonymous reads.',flush=True)

    path='/functions/v1/workbench-accounts'
    status,headers,_=request(path,'OPTIONS',headers={'Origin':origin,'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'authorization,apikey,content-type'})
    require(status==204 and headers.get('Access-Control-Allow-Origin')==origin,'Function CORS/preflight does not allow the workbench origin; check WORKBENCH_ALLOWED_ORIGINS and the deployed function.')

    status,headers,data=request(path,'POST',{'action':'list'},{'Origin':origin})
    require(status==401 and isinstance(data,dict) and data.get('error')=='请先登录。',
        'The function must reach its own login check and reject anonymous management; verify its environment variables and disable legacy JWT verification.')
    require(headers.get('Access-Control-Allow-Origin')==origin,'Function error responses must include the correct workbench CORS origin.')
    print('PASS: the deployed account function runs and rejects management without login.',flush=True)

    status,_,data=request(path,'POST',{'action':'list'},{'Origin':origin,'Authorization':'Bearer workbench-readiness-invalid-token'})
    require(status==401 and isinstance(data,dict) and data.get('error')=='登录已失效，请重新登录。',
        'The function must verify and reject an invalid Auth token.')
    status,headers,_=request(path,'POST',{'action':'list'},{'Origin':'https://untrusted.example'})
    require(status==403 and not headers.get('Access-Control-Allow-Origin'),'The function must reject origins outside the configured list.')
    print('PASS: forged tokens and unconfigured origins are rejected.',flush=True)

if __name__=='__main__':
    try:
        check_service(json.loads((ROOT/'frontend/auth-config.json').read_text()))
    except (RuntimeError,URLError,TimeoutError) as error:
        message=str(error).replace('%','%25').replace('\r','%0D').replace('\n','%0A')
        print('::error::'+message,file=sys.stderr)
        sys.exit(1)
