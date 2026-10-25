"""Synthetic tests; no company documents or Windows Office are required."""
import http.client
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer

from document_index import DocumentIndex, allowed
from launcher import make_handler
from office_reader import normalize, read_office


def identity(data, decrypt=False):
    return data


class IndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.root = self.base / 'docs'
        self.root.mkdir()
        self.calls = []

        def reader(path):
            self.calls.append(path.name)
            return {'chunks': [{'text': path.read_text(), 'location': 'PPT 第 2 页'}], 'truncated': False}

        self.index = DocumentIndex(self.base / 'cache.dat', reader, identity)

    def tearDown(self):
        if self.index.worker:
            self.index.worker.join(5)
        self.temp.cleanup()

    def scan(self, folder=None):
        self.index.start(str(folder or self.root))
        self.index.worker.join(5)
        self.assertFalse(self.index.status()['running'])

    def test_incremental_restore_change_delete_and_chinese_search(self):
        a = self.root / '精馏.pptx'
        b = self.root / '规程.docx'
        a.write_text('精馏塔 压差 12 kPa <script>alert(1)</script>')
        b.write_text('精馏塔 温度 85 ℃')
        self.scan()
        self.assertEqual(len(self.calls), 2)
        result = self.index.search('精馏塔 压差')
        self.assertEqual(result['total'], 1)
        self.assertIn('<script>', result['results'][0]['snippet'])  # UI must render text, not HTML.
        self.assertEqual(self.index.search('精馏塔', 'word')['total'], 1)
        self.scan()
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.index.status()['reused'], 2)
        restored = DocumentIndex(self.index.cache, codec=identity)
        self.assertEqual(restored.search('压差')['total'], 1)
        a.write_text('精馏塔 压差 更新数据')
        self.assertEqual(self.index.search('压差')['total'], 0)
        self.assertEqual(self.index.search('压差')['staleFiles'], 1)
        b.unlink()
        self.scan()
        self.assertEqual(self.index.status()['fileCount'], 1)
        self.assertEqual(len(self.calls), 3)
        self.assertIn('更新数据', self.index.search('压差')['results'][0]['snippet'])

    def test_root_switch_and_clear_preserve_originals(self):
        original = self.root / 'a.docx'
        original.write_text('旧资料')
        self.scan()
        other = self.base / 'other'
        other.mkdir()
        (other / 'b.pptx').write_text('新资料')
        self.scan(other)
        self.assertEqual(self.index.search('旧资料')['total'], 0)
        self.index.clear()
        self.assertTrue(original.exists())
        self.assertFalse(self.index.cache.exists())
        self.assertEqual(self.index.status()['fileCount'], 0)

    def test_empty_invalid_inputs_and_unknown_open(self):
        for value in ('', ' ', 123):
            with self.assertRaises(ValueError):
                self.index.start(value)
        self.scan()
        self.assertEqual(self.index.status()['fileCount'], 0)
        with self.assertRaises(ValueError):
            self.index.open_path('../outside.docx')
        for query, kind, offset in [('', 'all', 0), ('x' * 201, 'all', 0), ('x', 'exe', 0), ('x', 'all', -1)]:
            with self.assertRaises(ValueError):
                self.index.search(query, kind, offset)

    def test_links_cannot_escape_root_and_temp_files_ignored(self):
        outside = self.base / 'outside.docx'
        outside.write_text('private')
        (self.root / 'link.docx').symlink_to(outside)
        (self.root / '~$temp.docx').write_text('private')
        (self.root / 'not.pdf').write_text('private')
        self.assertFalse(allowed(self.root / 'link.docx', self.root))
        self.scan()
        self.assertEqual(self.calls, [])

    def test_reader_errors_not_saved_as_success(self):
        (self.root / 'bad.docx').write_text('secret')
        self.index.reader = lambda _: (_ for _ in ()).throw(RuntimeError('secret document content'))
        self.scan()
        status = self.index.status()
        self.assertEqual(status['fileCount'], 0)
        self.assertEqual(status['done'], 1)
        self.assertEqual(len(status['issues']), 1)
        self.assertNotIn('secret', json.dumps(status))

    def test_cache_failure_visible_and_results_still_available(self):
        (self.root / 'a.pptx').write_text('pressure')
        self.index.codec = lambda *_: (_ for _ in ()).throw(OSError())
        self.scan()
        self.assertIn('保存失败', self.index.status()['cacheError'])
        self.assertEqual(self.index.search('pressure')['total'], 1)

    def test_corrupt_cache_visible(self):
        self.index.cache.write_bytes(b'broken')
        restored = DocumentIndex(self.index.cache, codec=identity)
        self.assertIn('未能读取', restored.status()['cacheError'])

    def test_file_and_text_limits_visible(self):
        (self.root / 'a.docx').write_text('one')
        (self.root / 'b.docx').write_text('two')
        with patch('document_index.MAX_FILES', 1):
            self.scan()
        self.assertEqual(self.index.status()['fileCount'], 1)
        self.assertIn('最多处理', self.index.status()['warning'])
        self.index.reader = lambda _: {'chunks': [{'text': 'limited', 'location': 'Word 段落'}], 'truncated': True}
        self.index.files = {}
        self.scan()
        self.assertEqual(len(self.index.status()['issues']), 2)
        self.assertTrue(self.index.search('limited')['results'][0]['truncated'])

    def test_cancel_and_concurrent_start(self):
        (self.root / 'a.docx').write_text('completed')
        (self.root / 'b.docx').write_text('pending')
        entered, release = threading.Event(), threading.Event()
        original = self.index.reader

        def reader(path):
            entered.set()
            release.wait(3)
            return original(path)

        self.index.reader = reader
        self.index.start(str(self.root))
        self.assertTrue(entered.wait(2))
        with self.assertRaises(ValueError):
            self.index.start(str(self.root))
        with self.assertRaises(ValueError):
            self.index.clear()
        self.index.cancel.set()
        release.set()
        self.index.worker.join(4)
        self.assertEqual(self.index.status()['phase'], 'canceled')
        self.assertEqual(self.index.status()['fileCount'], 1)

    def test_result_pagination_and_moved_file_open_guard(self):
        file = self.root / 'many.pptx'
        file.write_text('pagination')
        self.index.reader = lambda _: {'chunks': [{'text': '压差 ' + str(n), 'location': f'PPT 第 {n} 页'}
                                                   for n in range(45)], 'truncated': False}
        self.scan()
        first = self.index.search('压差')
        second = self.index.search('压差', offset=30)
        self.assertEqual(first['total'], 45)
        self.assertEqual(len(first['results']), 30)
        self.assertEqual(len(second['results']), 15)
        file.unlink()
        with self.assertRaises(ValueError):
            self.index.open_path(first['results'][0]['id'])

    def test_large_file_is_skipped_explicitly(self):
        (self.root / 'large.docx').write_text('large')
        with patch('document_index.MAX_BYTES', 1):
            self.scan()
        self.assertEqual(self.calls, [])
        self.assertEqual(self.index.status()['fileCount'], 0)
        self.assertIn('100 MB', self.index.status()['issues'][0]['reason'])


class HttpTests(IndexTests):
    def setUp(self):
        super().setUp()
        self.html = self.base / 'app.html'
        self.html.write_text("<html><head><meta content=\"connect-src 'none'\"></head><body></body></html>")
        self.opened = []
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), lambda *_: None)
        self.host = f'127.0.0.1:{self.server.server_port}'
        self.origin = 'http://' + self.host
        self.server.RequestHandlerClass = make_handler(self.index, self.html, 'test-token', self.origin,
                                                        picker=lambda: str(self.root), opener=self.opened.append)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        super().tearDown()

    def request(self, path, method='GET', body=None, **headers):
        defaults = {'Host': self.host, 'Origin': self.origin, 'X-Workbench-Token': 'test-token',
                    'Content-Type': 'application/json'}
        defaults.update(headers)
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        conn.request(method, path, json.dumps(body).encode() if body is not None else None, defaults)
        res = conn.getresponse()
        status, data, returned_headers = res.status, res.read(), dict(res.getheaders())
        conn.close()
        return status, data, returned_headers

    def test_http_auth_origin_host_and_no_cors(self):
        self.assertEqual(self.request('/local-api/status', **{'X-Workbench-Token': 'bad'})[0], 403)
        self.assertEqual(self.request('/local-api/status', Host='evil.example')[0], 403)
        self.assertEqual(self.request('/local-api/clear', 'POST', {}, Origin='https://evil.example')[0], 403)
        self.assertEqual(self.request('/local-api/status', Origin='null')[0], 403)
        code, _, headers = self.request('/local-api/status')
        self.assertEqual(code, 200)
        self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(headers['Cache-Control'], 'no-store')

    def test_html_is_only_static_file_and_boot_injected(self):
        code, body, _ = self.request('/')
        self.assertEqual(code, 200)
        self.assertIn(b'__WORKBENCH_LOCAL__', body)
        self.assertIn(b"connect-src 'self'", body)
        self.assertIn("connect-src 'none'", self.html.read_text())
        self.assertEqual(self.request('/../cache.dat')[0], 404)
        self.assertEqual(self.request('/', **{'Sec-Fetch-Site': 'cross-site'})[0], 403)

    def test_http_search_and_allowlisted_open(self):
        (self.root / 'a.docx').write_text('关键词 安全')
        self.scan()
        code, data, _ = self.request('/local-api/search', 'POST', {'query': '关键词'})
        self.assertEqual(code, 200)
        hit = json.loads(data)['results'][0]
        self.assertEqual(self.request('/local-api/open', 'POST', {'id': hit['id']})[0], 200)
        self.assertEqual(self.opened, [self.root / 'a.docx'])
        self.assertEqual(self.request('/local-api/open', 'POST', {'id': 'C:\\private.docx'})[0], 400)
        self.assertEqual(self.request('/local-api/search', 'GET')[0], 405)
        self.assertEqual(self.request('/local-api/folder', 'POST', {})[0], 200)


class ReaderTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(normalize('甲\r\n乙\r丙\x07丁\x0b戊'), '甲\n乙\n丙 丁\n戊')

    def run_word(self, security_fails=False, initially_open=0):
        self.events = []
        events = self.events
        doc = types.SimpleNamespace(Content=types.SimpleNamespace(Text='第一段\r第二段\x07'),
                                    Close=lambda **kw: events.append(('close', kw)))

        class Collection:
            Count = initially_open

            def Open(self, **kw):
                events.append(('open', kw))
                return doc

        class App:
            Documents = Collection()

            def __setattr__(self, name, value):
                if name == 'AutomationSecurity':
                    events.append(('security', value))
                    if security_fails:
                        raise RuntimeError('policy')
                object.__setattr__(self, name, value)

            def Quit(self):
                events.append(('quit',))

        com = types.SimpleNamespace(CoInitialize=lambda: events.append(('init',)),
                                    CoUninitialize=lambda: events.append(('uninit',)))
        client = types.SimpleNamespace(DispatchEx=lambda _: App())
        def module(name):
            return com if name == 'pythoncom' else client
        with patch('office_reader.sys.platform', 'win32'), patch('office_reader.importlib.import_module', module):
            return read_office(Path('test.docx'))

    def test_word_readonly_macros_locations_and_cleanup(self):
        result = self.run_word()
        self.assertEqual(len(result['chunks']), 2)
        self.assertIn('第 2 段', result['chunks'][1]['location'])
        self.assertLess(self.events.index(('security', 3)), next(i for i, e in enumerate(self.events) if e[0] == 'open'))
        opened = next(e[1] for e in self.events if e[0] == 'open')
        self.assertTrue(opened['ReadOnly'])
        self.assertFalse(opened['AddToRecentFiles'])
        self.assertIn(('close', {'SaveChanges': 0}), self.events)
        self.assertEqual(self.events[-1], ('uninit',))

    def test_security_failure_does_not_open_and_existing_session_not_quit(self):
        with self.assertRaises(RuntimeError):
            self.run_word(security_fails=True)
        self.assertFalse(any(e[0] == 'open' for e in self.events))
        self.assertEqual(self.events[-1], ('uninit',))
        self.run_word(initially_open=2)
        self.assertNotIn(('quit',), self.events)

    def test_ppt_slides_groups_tables_and_readonly(self):
        events = []
        def shape(text):
            return types.SimpleNamespace(Type=1, HasTextFrame=True, HasTable=False,
                                         TextFrame=types.SimpleNamespace(HasText=True,
                                             TextRange=types.SimpleNamespace(Text=text)))
        class Items:
            def __init__(self, items):
                self.items, self.Count = items, len(items)
            def Item(self, index):
                return self.items[index-1]
        table = types.SimpleNamespace(Rows=types.SimpleNamespace(Count=1), Columns=types.SimpleNamespace(Count=2),
                                     Cell=lambda r,c: types.SimpleNamespace(Shape=shape('表格'+str(c))))
        group = types.SimpleNamespace(Type=6, GroupItems=Items([shape('组合文字')]), HasTextFrame=False, HasTable=False)
        table_shape = types.SimpleNamespace(Type=1, HasTextFrame=False, HasTable=True, Table=table)
        doc = types.SimpleNamespace(Slides=Items([types.SimpleNamespace(Shapes=Items([shape('第一页'), group])),
                                                types.SimpleNamespace(Shapes=Items([table_shape]))]),
                                    Close=lambda: events.append(('close',)))
        collection = types.SimpleNamespace(Count=0, Open=lambda *args:(events.append(('open', args)) or doc))
        app = types.SimpleNamespace(Presentations=collection, Quit=lambda:events.append(('quit',)))
        com = types.SimpleNamespace(CoInitialize=lambda:None, CoUninitialize=lambda:events.append(('uninit',)))
        client = types.SimpleNamespace(DispatchEx=lambda _:app)
        with patch('office_reader.sys.platform','win32'), patch('office_reader.importlib.import_module',lambda name:com if name=='pythoncom' else client):
            result = read_office(Path('test.pptx'))
        self.assertEqual(app.AutomationSecurity, 3)
        self.assertEqual(events[0], ('open', ('test.pptx', -1, 0, -1)))
        self.assertEqual([c['text'] for c in result['chunks']], ['第一页','组合文字','表格1 | 表格2'])
        self.assertIn('第 2 页', result['chunks'][-1]['location'])
        self.assertIn(('close',),events)
        self.assertEqual(events[-1],('uninit',))


if __name__ == '__main__':
    unittest.main()
