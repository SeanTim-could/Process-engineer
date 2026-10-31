"""Synthetic Excel files and a mocked Excel COM instance; no PI server is contacted."""
from contextlib import contextmanager
from datetime import datetime, timezone
import http.client
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer

from openpyxl import Workbook
from document_index import DocumentIndex
from excel_reader import ExcelReader, timestamp, numeric, parse_rows, config, refresh_excel
from launcher import make_handler


class ExcelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.path = self.root / 'PI测试.xlsx'
        book = Workbook()
        sheet = book.active
        sheet.title = 'PI'
        sheet.append(['时间', '温度', '流量'])
        sheet.append([datetime(2026, 10, 28, 8), 20, 0])
        sheet.append([datetime(2026, 10, 28, 8, 5), 21, '#N/A'])
        sheet.append(['bad-time', 999, 999])
        sheet.append([datetime(2026, 10, 28, 8, 10), '=1+2', 4])
        book.save(self.path)
        book.close()
        self.reader = ExcelReader()
        self.selected = self.reader.select(self.path)
        self.body = {'fileId': self.selected['fileId'], 'sheet': 'PI', 'timeColumn': 'A', 'startRow': 2,
                     'columns': [{'column': 'B', 'label': '温度', 'unit': '℃'}, {'column': 'C', 'label': '流量', 'unit': 't/h'}]}

    def tearDown(self):
        self.temp.cleanup()

    def test_actual_python_file_reads_cached_values_and_preserves_original(self):
        original = self.path.read_bytes()
        self.assertEqual(self.reader.describe(self.body['fileId'])['sheets'], ['PI'])
        result = self.reader.read(self.body)
        self.assertEqual(len(result['rows']), 3)
        self.assertEqual(result['rows'][0]['values'], {'c_1': 20, 'c_2': 0})
        self.assertEqual(result['rows'][1]['values'], {'c_1': 21})
        self.assertEqual(result['rows'][2]['values'], {'c_2': 4})  # Uncalculated formula cache is not zero.
        self.assertEqual(result['issues']['invalidTimes'], 1)
        self.assertEqual(result['issues']['invalidValues'], 1)
        self.assertNotIn(str(self.path), json.dumps(result))
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(self.reader.read(self.body)['digest'], result['digest'])
        with self.assertRaises(ValueError):
            self.reader.read({**self.body, 'fileId': '../outside.xlsx'})

    def test_dates_numeric_quality_and_bounds(self):
        self.assertEqual(timestamp(datetime(2026, 10, 28, 8)), timestamp('2026-10-28T00:00:00Z'))
        self.assertEqual(timestamp(45000) - timestamp(45000, True), -1462 * 86400000)
        self.assertEqual(numeric(0), 0)
        for value in [True, float('nan'), float('inf'), '#VALUE!', -2146826246]:
            with self.assertRaises(ValueError):
                numeric(value)
        for patch_body in [{'timeColumn': 'B'}, {'startRow': 0}, {'endRow': 20002}, {'columns': []}]:
            with self.assertRaises(ValueError):
                config({**self.body, **patch_body})
        rows = [('2026-10-28 08:00', 1), ('2026-10-28 08:00', 1)]
        columns = config({**self.body, 'columns': self.body['columns'][:1]})['columns']
        result, issues, _ = parse_rows(rows, columns, 1, 2)
        self.assertEqual(len(result), 1)
        self.assertEqual(issues['duplicates'], 1)
        with self.assertRaises(ValueError):
            parse_rows([rows[0], (rows[0][0], 2)], columns, 1, 2)

    def test_open_excel_uses_unsaved_values_without_save_or_close(self):
        selected = self.reader.select(self.path, 'open')
        events = []
        class Area:
            @property
            def Value2(self):
                events.append('Value2')
                return ((datetime(2026, 10, 28, 9), 999, 1),)
        class Cells:
            def __call__(self, row, column):
                return SimpleNamespace(End=lambda direction: SimpleNamespace(Row=2))
        sheet = SimpleNamespace(Cells=Cells(), Rows=SimpleNamespace(Count=1048576), Range=lambda *args: Area())
        book = SimpleNamespace(FullName=str(self.path), Date1904=False, Worksheets=SimpleNamespace(Item=lambda name: sheet))
        app = SimpleNamespace(Ready=True, CalculationState=0, CalculateFull=lambda: events.append('CalculateFull'), Workbooks=SimpleNamespace(Count=1, Item=lambda i: book))
        @contextmanager
        def active(path=None):
            yield app
        with patch('excel_reader.active_excel', active):
            result = self.reader.read({**self.body, 'fileId': selected['fileId']})
            self.assertEqual(result['rows'][0]['values']['c_1'], 999)
            self.assertEqual(events, ['CalculateFull', 'Value2', 'Value2'])
            self.assertEqual(result['refresh']['mode'], 'calculate')
            events.clear()
            self.reader.read({**self.body, 'fileId': selected['fileId'], 'refreshMode': 'none'})
            self.assertEqual(events, ['Value2', 'Value2'])
            events.clear()
            app.CalculateFull = lambda: (_ for _ in ()).throw(RuntimeError('PI offline'))
            with self.assertRaisesRegex(ValueError, '刷新失败'):
                self.reader.read({**self.body, 'fileId': selected['fileId']})
            self.assertEqual(events, [], 'A failed refresh must not read cached old results')
            app.CalculationState = 1
            with self.assertRaisesRegex(ValueError, '正在编辑或计算'):
                self.reader.read({**self.body, 'fileId': selected['fileId']})
        self.assertEqual(self.reader.read(self.body)['rows'][0]['values']['c_1'], 20)

    def test_limits_and_concurrent_reads(self):
        self.reader.lock.acquire()
        try:
            with self.assertRaisesRegex(ValueError, '上一轮'):
                self.reader.read(self.body)
        finally:
            self.reader.lock.release()
        with self.assertRaises(ValueError):
            self.reader.read({**self.body, 'columns': [{'column': 'XFD', 'label': 'x', 'unit': ''}]})
        with self.assertRaises(ValueError):
            self.reader.read({**self.body, 'sheet': 'missing'})
        self.path.unlink()
        with self.assertRaises(ValueError):
            self.reader.read(self.body)

    def test_refresh_waits_scopes_macro_and_rejects_failures(self):
        events = []
        app = SimpleNamespace(Ready=True, CalculationState=0, CalculateFull=lambda: events.append('calculated'),
                              Run=lambda name: events.append(name))
        book = SimpleNamespace(Name="PI O'Brien.xlsm")
        result = refresh_excel(app, book, {})
        self.assertEqual(events, ['calculated'])
        self.assertEqual(result['mode'], 'calculate')
        result = refresh_excel(app, book, {'refreshMode': 'macro', 'refreshMacro': 'Module1.RefreshPI'})
        self.assertEqual(events[-1], "'PI O''Brien.xlsm'!Module1.RefreshPI")
        self.assertEqual(result['mode'], 'macro')
        for name in ['external.xlsm!Run', "Bad'!x", 'foo(1)', '', '../Run']:
            with self.assertRaises(ValueError):
                refresh_excel(app, book, {'refreshMode': 'macro', 'refreshMacro': name})
        app.CalculateFull = lambda: (_ for _ in ()).throw(RuntimeError('PI offline'))
        with self.assertRaisesRegex(ValueError, '刷新失败'):
            refresh_excel(app, book, {})
        self.assertIsNone(refresh_excel(app, book, {'refreshMode': 'none'}))
        with self.assertRaisesRegex(ValueError, '文件模式无法刷新'):
            self.reader.read({**self.body, 'refreshMode': 'calculate'})

    def test_refresh_busy_and_timeout_do_not_read_old_results(self):
        app = SimpleNamespace(Ready=True, CalculationState=0)
        def calculate():
            app.CalculationState = 1
        app.CalculateFull = calculate
        with patch('excel_reader.time.monotonic', side_effect=[0, 61]):
            with self.assertRaisesRegex(ValueError, '超过60秒'):
                refresh_excel(app, SimpleNamespace(), {})
        with self.assertRaisesRegex(ValueError, '正在编辑或计算'):
            refresh_excel(app, SimpleNamespace(), {})

    def test_picked_file_capability_is_restored_after_service_restart(self):
        # Exercise the codec boundary without relying on Windows in this fixture.
        codec = lambda data, decrypt=False: data[::-1]
        cache = self.root / 'capabilities.dat'
        first = ExcelReader(cache, codec)
        chosen = first.select(self.path)
        self.assertNotIn(str(self.path).encode(), cache.read_bytes())
        self.assertEqual(first.select(self.path)['fileId'], chosen['fileId'])
        second = ExcelReader(cache, codec)
        self.assertEqual(second.restore(chosen['fileId'])['name'], self.path.name)
        self.assertEqual(second.read({**self.body, 'fileId': chosen['fileId']})['rows'][0]['values']['c_1'], 20)
        self.assertEqual(second.select(self.path)['fileId'], chosen['fileId'])
        with self.assertRaises(ValueError):
            second.restore(str(self.path))
        self.path.unlink()
        with self.assertRaisesRegex(ValueError, '不可访问'):
            second.restore(chosen['fileId'])
        cache.write_bytes(b'corrupt')
        corrupted = ExcelReader(cache, codec)
        self.assertTrue(corrupted.memory_warning)
        with self.assertRaises(ValueError):
            corrupted.restore(chosen['fileId'])


class ExcelHttpTests(ExcelTests):
    def setUp(self):
        super().setUp()
        self.html = self.root / 'app.html'
        self.html.write_text('<html><head></head></html>')
        self.index = DocumentIndex(self.root / 'cache')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), lambda *_: None)
        self.origin = f'http://127.0.0.1:{self.server.server_port}'
        self.server.RequestHandlerClass = make_handler(self.index, self.html, 'fixture-token', self.origin,
                                                      excel=self.reader, excel_picker=lambda: str(self.path))
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.RequestHandlerClass.excel_scheduler.close()
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(3)
        super().tearDown()

    def send(self, path, method='POST', body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        values = {'Origin': self.origin, 'X-Workbench-Token': 'fixture-token', 'Content-Type': 'application/json'}
        values.update(headers or {})
        conn.request(method, path, json.dumps(body or {}).encode() if method == 'POST' else None, values)
        r = conn.getresponse()
        answer = r.status, r.read(), dict(r.getheaders())
        conn.close()
        return answer

    def test_excel_api_is_local_token_bound_and_file_capability_bound(self):
        status, body, _ = self.send('/local-api/excel/files', body={'mode': 'file'})
        self.assertEqual(status, 200)
        file_id = json.loads(body)['files'][0]['fileId']
        self.assertEqual(self.send('/local-api/excel/read', body={**self.body, 'fileId': file_id})[0], 200)
        for path in ['files', 'sheets', 'read', 'tasks/start', 'tasks/status', 'tasks/ack', 'tasks/now', 'tasks/stop']:
            self.assertEqual(self.send('/local-api/excel/' + path, body=self.body, headers={'Origin': 'https://seantim-could.github.io'})[0], 403)
            self.assertEqual(self.send('/local-api/excel/' + path, body=self.body, headers={'X-Workbench-Token': 'wrong'})[0], 403)
        self.assertEqual(self.send('/local-api/excel/read', body={**self.body, 'fileId': str(self.path)})[0], 400)

    def test_only_user_navigation_can_open_the_bridge_and_no_cors_is_granted(self):
        remote = {'Origin': 'https://seantim-could.github.io', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1'}
        status, body, headers = self.send('/excel-bridge', 'GET', headers=remote)
        self.assertEqual(status, 200)
        self.assertIn(b'window.ExcelLocal=', body)
        self.assertNotIn(b'/*LOCAL_CONFIG*/', body)
        self.assertEqual(headers['Cross-Origin-Opener-Policy'], 'unsafe-none')
        self.assertNotIn('Access-Control-Allow-Origin', headers)
        for bad in [{'Sec-Fetch-Mode': 'cors'}, {'Sec-Fetch-Dest': 'iframe'}, {'Sec-Fetch-User': ''}]:
            self.assertEqual(self.send('/excel-bridge', 'GET', headers={**remote, **bad})[0], 403)
        self.assertEqual(self.send('/excel-bridge?local=1', 'GET')[2]['Cross-Origin-Opener-Policy'], 'same-origin')


if __name__ == '__main__':
    unittest.main()
