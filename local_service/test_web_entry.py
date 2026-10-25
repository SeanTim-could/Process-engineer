"""Verify website navigation without opening local APIs to remote websites."""
import http.client
import json
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest

from document_index import DocumentIndex
from launcher import make_handler


class WebEntryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.html = self.base / 'app.html'
        self.html.write_text("<html><head><meta content=\"connect-src 'none'\"></head></html>")
        self.index = DocumentIndex(self.base / 'cache.dat')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), lambda *_: None)
        self.host = f'127.0.0.1:{self.server.server_port}'
        self.origin = 'http://' + self.host
        self.server.RequestHandlerClass = make_handler(self.index, self.html, 'test-token', self.origin)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        self.temp.cleanup()

    def request(self, path, method='GET', body=None, **headers):
        defaults = {'Host': self.host, 'Origin': self.origin, 'X-Workbench-Token': 'test-token',
                    'Content-Type': 'application/json'}
        defaults.update(headers)
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        connection.request(method, path, json.dumps(body).encode() if body is not None else None, defaults)
        response = connection.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        connection.close()
        return result

    def test_website_click_opens_only_the_document_view(self):
        headers = {'Origin': 'https://seantim-could.github.io',
                   'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate',
                   'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1',
                   'X-Workbench-Token': ''}
        code, body, response_headers = self.request('/documents', **headers)
        self.assertEqual(code, 200)
        self.assertIn(b'"view": "documents"', body)
        self.assertEqual(response_headers['Cross-Origin-Opener-Policy'], 'same-origin')
        self.assertEqual(response_headers['X-Frame-Options'], 'DENY')
        self.assertEqual(response_headers['Referrer-Policy'], 'no-referrer')
        self.assertNotIn('Access-Control-Allow-Origin', response_headers)
        self.assertEqual(self.request('/', **headers)[0], 403)

    def test_cross_site_fetch_and_embedded_pages_stay_blocked(self):
        base = {'Sec-Fetch-Site': 'cross-site'}
        for mode, destination, user in [('cors', 'empty', ''), ('navigate', 'iframe', '?1'),
                                        ('navigate', 'document', '')]:
            with self.subTest(mode=mode, destination=destination, user=user):
                code, _, _ = self.request('/documents', **base, **{
                    'Sec-Fetch-Mode': mode, 'Sec-Fetch-Dest': destination, 'Sec-Fetch-User': user})
                self.assertEqual(code, 403)
        self.assertEqual(self.request('/documents', Host='evil.example')[0], 403)

    def test_website_cannot_query_or_modify_the_index_even_with_a_token(self):
        for endpoint in ['status', 'folder', 'index', 'search', 'open', 'cancel', 'clear']:
            with self.subTest(endpoint=endpoint):
                method = 'GET' if endpoint == 'status' else 'POST'
                code, _, headers = self.request('/local-api/' + endpoint, method,
                                                None if method == 'GET' else {},
                                                Origin='https://seantim-could.github.io')
                self.assertEqual(code, 403)
                self.assertNotIn('Access-Control-Allow-Origin', headers)

    def test_local_page_still_requires_a_current_session(self):
        self.assertEqual(self.request('/documents')[0], 200)
        self.assertEqual(self.request('/local-api/status', **{'X-Workbench-Token': 'old-token'})[0], 403)
        self.assertEqual(self.request('/local-api/status')[0], 200)


if __name__ == '__main__':
    unittest.main()
