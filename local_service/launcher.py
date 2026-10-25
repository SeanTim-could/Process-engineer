"""Loopback-only Office companion and launcher for the offline workbench."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import importlib.util
import json
import os
import secrets
import sys
import webbrowser
from urllib.parse import urlsplit
from document_index import DocumentIndex

PORT = 8765
APP_HTML = '启动工程师工作台.html'


def runtime_path():
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent)) / APP_HTML


def choose_folder():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    try:
        root.withdraw()
        root.attributes('-topmost', True)
        return filedialog.askdirectory(parent=root, title='选择要检索的 Word / PPT 文件夹')
    finally:
        root.destroy()


def make_handler(index, html_path, token, origin, picker=choose_folder, opener=None):
    opener = opener or (lambda path: os.startfile(str(path)))

    class Handler(BaseHTTPRequestHandler):
        server_version = 'WorkbenchLocal'

        def log_message(self, *_):
            pass  # Do not log document names, queries, contents or tokens.

        def reply(self, status, payload, content_type='application/json; charset=utf-8'):
            data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.end_headers()
            self.wfile.write(data)

        def handle_request(self):
            if self.headers.get('Host', '') != urlsplit(origin).netloc:
                return self.reply(403, {'error': '主机校验失败。'})
            path = urlsplit(self.path).path
            if self.command == 'GET' and path in {'/', '/index.html', '/' + APP_HTML, '/documents'}:
                # Only the dedicated document page accepts a user-clicked link
                # from a website. API requests still require the local origin
                # and session token; no CORS access is granted to that website.
                user_navigation = (
                    path == '/documents'
                    and self.headers.get('Sec-Fetch-Mode') == 'navigate'
                    and self.headers.get('Sec-Fetch-Dest') == 'document'
                    and self.headers.get('Sec-Fetch-User') == '?1'
                )
                if self.headers.get('Sec-Fetch-Dest') in {'iframe', 'frame'}:
                    return self.reply(403, {'error': '请在独立窗口打开本机文档检索。'})
                if self.headers.get('Sec-Fetch-Site') == 'cross-site' and not user_navigation:
                    return self.reply(403, {'error': '请从本机启动器打开工作台。'})
                html = html_path.read_text('utf-8').replace("connect-src 'none'", "connect-src 'self'")
                boot = json.dumps({'token': token, 'version': 1,
                                   'view': 'documents' if path == '/documents' else 'overview'}, ensure_ascii=True)
                html = html.replace('</head>', '<script>window.__WORKBENCH_LOCAL__=' + boot + ';</script></head>', 1)
                return self.reply(200, html.encode('utf-8'), 'text/html; charset=utf-8')
            if not path.startswith('/local-api/'):
                return self.reply(404, {'error': '地址不存在。'})
            if not secrets.compare_digest(self.headers.get('X-Workbench-Token', ''), token):
                return self.reply(403, {'error': '本机连接已失效，请刷新页面。'})
            request_origin = self.headers.get('Origin')
            if request_origin is not None and request_origin != origin:
                return self.reply(403, {'error': '只接受工作台本机页面的请求。'})
            if self.command != 'POST' and path != '/local-api/status':
                return self.reply(405, {'error': '请求方式不支持。'})
            if self.command == 'POST' and request_origin != origin:
                return self.reply(403, {'error': '来源校验失败，请刷新工作台。'})
            try:
                body = {}
                if self.command == 'POST':
                    length = int(self.headers.get('Content-Length', '0'))
                    if length < 0 or length > 8192:
                        return self.reply(413, {'error': '请求内容过大。'})
                    if self.headers.get_content_type() != 'application/json':
                        return self.reply(415, {'error': '请求格式不正确。'})
                    body = json.loads(self.rfile.read(length) or b'{}')
                    if not isinstance(body, dict):
                        raise ValueError('请求格式不正确。')
                if path == '/local-api/status':
                    return self.reply(200, index.status())
                if path == '/local-api/folder':
                    return self.reply(200, {'folder': picker()})
                if path == '/local-api/index':
                    index.start(body.get('folder', ''))
                    return self.reply(202, index.status())
                if path == '/local-api/cancel':
                    index.cancel.set()
                    return self.reply(200, {'ok': True})
                if path == '/local-api/search':
                    return self.reply(200, index.search(body.get('query', ''), body.get('kind', 'all'), body.get('offset', 0)))
                if path == '/local-api/open':
                    opener(index.open_path(body.get('id', '')))
                    return self.reply(200, {'ok': True})
                if path == '/local-api/clear':
                    index.clear()
                    return self.reply(200, index.status())
                return self.reply(404, {'error': '接口不存在。'})
            except (ValueError, FileNotFoundError, NotADirectoryError) as error:
                return self.reply(400, {'error': str(error) if isinstance(error, ValueError) else '找不到文件夹或文件，请检查路径。'})
            except Exception:
                return self.reply(500, {'error': '本机操作失败，请检查 Office、权限和启动窗口。'})

        def do_GET(self):
            self.handle_request()

        def do_POST(self):
            self.handle_request()

    return Handler


def main(argv=None):
    parser = argparse.ArgumentParser(description='工艺工程师工作台本机服务')
    parser.add_argument('--documents', action='store_true', help='启动后直接打开文档检索')
    args = parser.parse_args(argv)
    if sys.platform != 'win32':
        print('本地文档检索启动器需要 Windows。双击 HTML 仍可使用原有工作台。')
        return 1
    if importlib.util.find_spec('pythoncom') is None or importlib.util.find_spec('win32com') is None:
        print('缺少 pywin32。请先运行“安装本地检索依赖.bat”。')
        return 1
    html = runtime_path()
    if not html.is_file():
        print('找不到工作台网页。请先完整解压，保留文件夹结构。')
        return 1
    storage = Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local')) / 'ProcessEngineerWorkbench' / 'DocumentSearch'
    index = DocumentIndex(storage / 'index.dat')
    origin = f'http://127.0.0.1:{PORT}'
    token = secrets.token_urlsafe(32)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), make_handler(index, html, token, origin))
    except OSError:
        print(f'本机端口 {PORT} 已被占用。若工作台已启动，请使用已打开的窗口；否则先关闭占用程序，再启动。')
        return 1
    print('工艺工程师工作台已启动：' + origin)
    print('请保留此窗口。关闭窗口会停止文档检索，浏览器内已保存的生产数据不会删除。')
    print('首次迁移请先从原网页“完整备份”，再在新地址“恢复备份”。')
    print('读取停住时，请查看 Office 的授权、密码或文件打开提示。取消将在当前文件结束后生效。')
    webbrowser.open(origin + ('/documents' if args.documents else ''))
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        index.cancel.set()
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
