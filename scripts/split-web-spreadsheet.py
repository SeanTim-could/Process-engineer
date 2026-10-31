"""Detach the existing spreadsheet implementation from website startup.

The standalone HTML keeps its embedded implementation. Only two async website
entry points need it: workbook import and workbook template generation. Markers
are checked so a future bundle change cannot silently break that boundary.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]

def split(script, asset):
    text = script.decode()
    start = text.index('var xN={};Ui(xN,')
    end = text.index('var zi=oe(Se(),1);', start)
    vendor = ('"use strict";window.WorkbenchSheetJSFactory=(Ui,H$)=>{' + text[start:end]
              + 'yN();return xN;};').encode()
    url = asset(('spreadsheet', 'js'), vendor)
    integrity = 'sha256-' + base64.b64encode(hashlib.sha256(vendor).digest()).decode()
    loader = (ROOT/'frontend/web-spreadsheet.js').read_text()
    loader = loader.replace('/*SPREADSHEET_ASSET*/null', json.dumps({'url':'./'+url,'integrity':integrity}))
    text = text[:start] + loader + text[end:]
    changes = [
        ('await Promise.resolve().then(()=>(yN(),xN))', 'await WorkbenchSpreadsheet()'),
        (';yN();function I$(e){let t=Md.book_new()', ';async function I$(e){const {utils:Md,write:S0}=await WorkbenchSpreadsheet();let t=Md.book_new()'),
        ('a=I$(r.name);return new Response(a,', 'a=await I$(r.name);return new Response(a,'),
    ]
    for old,new in changes:
        if text.count(old) != 1:
            raise ValueError('Spreadsheet lazy-load marker missing: '+old)
        text = text.replace(old,new)
    if 'yN()' in text:
        raise ValueError('Unexpected eager spreadsheet initialization')
    return text.encode(), url
