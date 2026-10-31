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
from document_index import DocumentIndex, protect
from excel_reader import ExcelReader, ExcelScheduler

PORT = 8765
APP_HTML = '启动工程师工作台.html'


def runtime_path():
    if getattr(sys, 'frozen', False):
        external = Path(sys.executable).resolve().parent / APP_HTML
        if external.is_file():
            return external
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent)) / APP_HTML


def check_runtime():
    """Exercise bundled dependencies without opening Office or user documents."""
    import pythoncom
    import tkinter
    import win32com.client
    import openpyxl
    from io import BytesIO

    pythoncom.CoInitialize()
    try:
        probe = b'Workbench portable runtime check'
        if protect(protect(probe), decrypt=True) != probe:
            raise RuntimeError('Windows 索引加密自检失败。')
        tcl = tkinter.Tcl()
        tcl_version = tcl.eval('info patchlevel')
        html = runtime_path()
        if not html.is_file() or '<html' not in html.read_text('utf-8').lower():
            raise RuntimeError('工作台网页资源缺失。')
        frozen = bool(getattr(sys, 'frozen', False))
        bundled_modules = False
        if frozen:
            bundle = Path(sys._MEIPASS).resolve()
            bundled_modules = all(Path(module.__file__).resolve().is_relative_to(bundle)
                                  for module in (pythoncom, tkinter, win32com.client, openpyxl))
            if not bundled_modules:
                raise RuntimeError('运行组件未完整包含在便携包中。')
        bridge = Path(__file__).with_name('excel_bridge.html')
        if not bridge.is_file():
            raise RuntimeError('Excel同步窗口资源缺失。')
        memory = BytesIO()
        book = openpyxl.Workbook()
        book.active['A1'] = 123.5
        book.save(memory)
        book.close()
        memory.seek(0)
        book = openpyxl.load_workbook(memory, read_only=True, data_only=True)
        if book.active['A1'].value != 123.5:
            raise RuntimeError('Excel数值读取自检失败。')
        book.close()
        return {'ok': True, 'frozen': frozen, 'bundled_modules': bundled_modules,
                'python': sys.version.split()[0], 'tcl': tcl_version,
                'com_runtime': True, 'dpapi': True, 'html': True,
                'excel_reader': True, 'excel_bridge': True, 'openpyxl': openpyxl.__version__,
                'excel_live_tested': False,
                'office_documents_tested': False}
    finally:
        pythoncom.CoUninitialize()


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


def choose_excel():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    try:
        root.withdraw()
        root.attributes('-topmost', True)
        return filedialog.askopenfilename(parent=root, title='选择Python读取的Excel文件',
                                          filetypes=[('Excel', '*.xlsx *.xlsm')])
    finally:
        root.destroy()


def make_handler(index, html_path, token, origin, picker=choose_folder, opener=None,
                 excel=None, excel_picker=choose_excel):
    opener = opener or (lambda path: os.startfile(str(path)))
    excel = excel or ExcelReader(index.cache.with_name('excel-files.dat') if os.name == 'nt' else None, protect)

    scheduler = ExcelScheduler(excel)

    class Handler(BaseHTTPRequestHandler):
        excel_scheduler = scheduler
        server_version = 'WorkbenchLocal'

        def log_message(self, *_):
            pass  # Do not log document names, queries, contents or tokens.

        def reply(self, status, payload, content_type='application/json; charset=utf-8', coop='same-origin'):
            data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Cross-Origin-Opener-Policy', coop)
            self.send_header('Referrer-Policy', 'no-referrer')
            self.end_headers()
            self.wfile.write(data)

        def handle_request(self):
            if self.headers.get('Host', '') != urlsplit(origin).netloc:
                return self.reply(403, {'error': '主机校验失败。'})
            # Read a bounded POST body before returning an authentication error.
            # Closing with unread request bytes can reset the connection on
            # Windows before the client receives the intended 403 response.
            raw_body = b''
            if self.command == 'POST':
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                except ValueError:
                    return self.reply(400, {'error': '请求长度无效。'})
                limit = 32768 if urlsplit(self.path).path.startswith('/local-api/excel/') else 8192
                if length < 0 or length > limit:
                    return self.reply(413, {'error': '请求内容过大。'})
                previous_timeout = self.connection.gettimeout()
                try:
                    self.connection.settimeout(5)
                    raw_body = self.rfile.read(length)
                except (OSError, TimeoutError):
                    return self.reply(400, {'error': '请求内容未完整接收。'})
                finally:
                    self.connection.settimeout(previous_timeout)
                if len(raw_body) != length:
                    return self.reply(400, {'error': '请求内容未完整接收。'})
            path = urlsplit(self.path).path
            if self.command == 'GET' and path in {'/', '/index.html', '/' + APP_HTML, '/documents', '/excel-bridge'}:
                # Only the dedicated document page accepts a user-clicked link
                # from a website. API requests still require the local origin
                # and session token; no CORS access is granted to that website.
                user_navigation = (
                    path in {'/documents', '/excel-bridge'}
                    and self.headers.get('Sec-Fetch-Mode') == 'navigate'
                    and self.headers.get('Sec-Fetch-Dest') == 'document'
                    and self.headers.get('Sec-Fetch-User') == '?1'
                )
                if self.headers.get('Sec-Fetch-Dest') in {'iframe', 'frame'}:
                    return self.reply(403, {'error': '请在独立窗口打开本机文档检索。'})
                if self.headers.get('Sec-Fetch-Site') == 'cross-site' and not user_navigation:
                    return self.reply(403, {'error': '请从本机启动器打开工作台。'})
                if path == '/excel-bridge':
                    bridge = Path(__file__).with_name('excel_bridge.html').read_text('utf-8')
                    bridge = bridge.replace('/*LOCAL_CONFIG*/', 'window.ExcelLocal=' + json.dumps({'token': token, 'origin': origin}) + ';')
                    # This dedicated, user-opened popup needs its website opener.
                    # Local APIs retain origin + token checks and grant no CORS access.
                    return self.reply(200, bridge.encode('utf-8'), 'text/html; charset=utf-8', coop='same-origin' if urlsplit(self.path).query == 'local=1' else 'unsafe-none')
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
                    if self.headers.get_content_type() != 'application/json':
                        return self.reply(415, {'error': '请求格式不正确。'})
                    body = json.loads(raw_body or b'{}')
                    if not isinstance(body, dict):
                        raise ValueError('请求格式不正确。')
                if path == '/local-api/status':
                    return self.reply(200, index.status())
                if path == '/local-api/excel/files':
                    mode = body.get('mode', 'file')
                    if mode == 'open':
                        return self.reply(200, {'files': excel.opened()})
                    if mode != 'file':
                        raise ValueError('读取模式无效。')
                    selected = excel_picker()
                    return self.reply(200, {'files': [excel.select(selected)] if selected else []})
                if path == '/local-api/excel/sheets':
                    return self.reply(200, excel.describe(body.get('fileId')))
                if path == '/local-api/excel/restore':
                    return self.reply(200, excel.restore(body.get('fileId')))
                if path == '/local-api/excel/tasks/start':
                    return self.reply(200, scheduler.start(body))
                if path == '/local-api/excel/tasks/status':
                    return self.reply(200, scheduler.status(body.get('taskId')))
                if path == '/local-api/excel/tasks/ack':
                    return self.reply(200, scheduler.acknowledge(body.get('taskId'), body.get('deliveryId')))
                if path == '/local-api/excel/tasks/now':
                    return self.reply(200, scheduler.now(body.get('taskId')))
                if path == '/local-api/excel/tasks/stop':
                    return self.reply(200, scheduler.stop(body.get('taskId')))
                if path == '/local-api/excel/read':
                    return self.reply(200, excel.read(body))
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
            except ImportError:
                return self.reply(500, {'error': '缺少Excel读取依赖，请先运行“安装Excel同步依赖.bat”。'})
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
    parser.add_argument('--excel-sync', action='store_true', help='启动后打开网站的Excel自动同步入口')
    parser.add_argument('--no-browser', action='store_true', help='只启动服务，不自动打开浏览器')
    parser.add_argument('--self-test', action='store_true', help='检查运行组件，不打开文档或启动服务')
    args = parser.parse_args(argv)
    if sys.platform != 'win32':
        print('本地文档检索启动器需要 Windows。双击 HTML 仍可使用原有工作台。')
        return 1
    if args.self_test:
        try:
            print(json.dumps(check_runtime(), ensure_ascii=True))
            return 0
        except Exception as error:
            print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=True))
            return 1
    if importlib.util.find_spec('pythoncom') is None or importlib.util.find_spec('win32com') is None:
        if getattr(sys, 'frozen', False):
            print('便携包运行组件缺失，请完整解压并保留 _internal 文件夹。')
        else:
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
    print('当前读取程序：' + sys.executable)
    if args.excel_sync:
        print('Excel由Python读取；已打开模式可在每次读取前刷新公式。文件模式仅读取上次保存结果。')
    print('请保留此窗口。关闭窗口会停止文档检索和Excel读取，浏览器内已保存的数据不会删除。')
    print('仅检索文档无需迁移生产数据。如需在本机使用生产数据，请先在网站“另存为”工作台JSON文件，再在本机“打开”。')
    print('读取停住时，请查看 Office 的授权、密码或文件打开提示。取消将在当前文件结束后生效。')
    if not args.no_browser:
        if args.excel_sync:
            webbrowser.open('https://seantim-could.github.io/Process-engineer/')
            print('登录后打开“数据管理 → Excel自动同步”，点击“连接本机Excel”。')
        else:
            documents = args.documents or bool(getattr(sys, 'frozen', False))
            webbrowser.open(origin + ('/documents' if documents else ''))
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        index.cancel.set()
        server.RequestHandlerClass.excel_scheduler.close()
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
