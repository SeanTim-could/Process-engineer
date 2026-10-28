"""Refresh the cross-device module embedded in the standalone HTML; no build dependencies."""
from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / '启动工程师工作台.html'
START = '/* cross-unit-calculations:start */'
END = '/* cross-unit-calculations:end */'

def main():
    html = HTML.read_text(encoding='utf-8')
    match = re.search(r'(<script[^>]+src="data:text/javascript;base64,)([^"]+)', html)
    if not match:
        raise SystemExit('Embedded application script not found')
    js = base64.b64decode(match[2]).decode('utf-8')
    module = (ROOT / 'frontend/shared-formulas.js').read_text(encoding='utf-8') + '\n' + (ROOT / 'frontend/cross-unit-calculations.js').read_text(encoding='utf-8')
    block = START + '\n' + module + '\n' + END
    if START in js:
        js = js[:js.index(START)] + block + js[js.index(END) + len(END):]
    else:
        marker = 'var HN={};'
        if js.count(marker) != 1:
            raise SystemExit('Calculation API module marker not found')
        js = js.replace(marker, block + marker)
    old = 'function Ho(e,t){let r=$l(e),'
    new = 'function Ho(e,t){return SharedFormulas.calculate(e,t)}function HoCore(e,t){let r=$l(e),'
    if new not in js:
        if js.count(old) != 1: raise SystemExit('Shared formula integration marker not found')
        js = js.replace(old, new)
    html = html[:match.start(2)] + base64.b64encode(js.encode('utf-8')).decode('ascii') + html[match.end(2):]
    HTML.write_text(html, encoding='utf-8')

if __name__ == '__main__':
    main()
