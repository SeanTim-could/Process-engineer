"""Loopback fixture for the real browser-to-Python Excel bridge regression."""
import argparse
from datetime import datetime
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'local_service'))
from document_index import DocumentIndex
from launcher import make_handler

parser = argparse.ArgumentParser()
parser.add_argument('folder')
args = parser.parse_args()
folder = Path(args.folder)
folder.mkdir(parents=True, exist_ok=True)
path = folder / 'PI-browser-fixture.xlsx'
book = Workbook()
sheet = book.active
sheet.title = 'PI'
sheet.append(['时间', '温度'])
for minute, value in [(0, 20), (5, 21), (10, 0)]:
    sheet.append([datetime(2026, 10, 28, 8, minute), value])
second = book.create_sheet('PI-B')
second.append(['时间', '压力'])
for minute, value in [(0, 2), (5, 3), (10, 4)]:
    second.append([datetime(2026, 10, 28, 8, minute), value])
book.save(path)
book.close()
index = DocumentIndex(folder / 'index.dat')
origin = 'http://127.0.0.1:8765'
server = ThreadingHTTPServer(('127.0.0.1', 8765), make_handler(index, ROOT / '启动工程师工作台.html',
                                                          'excel-browser-fixture-token', origin,
                                                          excel_picker=lambda: str(path)))
print(json.dumps({'origin': origin, 'workbook': str(path)}), flush=True)
server.serve_forever()
