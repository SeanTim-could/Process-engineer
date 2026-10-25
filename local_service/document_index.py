"""Incremental, per-user encrypted document index. No document text is logged."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import threading
from datetime import datetime, timezone
from office_reader import SUPPORTED, read_office

MAX_FILES = 3000
MAX_BYTES = 100 * 1024 * 1024


def protect(data, decrypt=False):
    """Windows DPAPI; ciphertext is tied to this Windows user and computer."""
    if os.name != 'nt':
        raise RuntimeError('本地索引加密需要 Windows。')
    from ctypes import wintypes

    class Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    function = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_wchar_p if not decrypt else ctypes.c_void_p,
                         ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD,
                         ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    ok = function(ctypes.byref(source), None if decrypt else 'Workbench document index',
                  None, None, None, 1, ctypes.byref(target))
    if not ok:
        raise RuntimeError('Windows 无法加密或解密本地索引。')
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def allowed(path, root):
    try:
        resolved = path.resolve(strict=True)
        return resolved.is_file() and resolved.is_relative_to(root) and resolved.suffix.lower() in SUPPORTED
    except (OSError, ValueError):
        return False


class DocumentIndex:
    def __init__(self, cache, reader=read_office, codec=protect):
        self.cache, self.reader, self.codec = Path(cache), reader, codec
        self.lock = threading.RLock()
        self.cancel = threading.Event()
        self.root = ''
        self.files = {}
        self.worker = None
        self.state = {'running': False, 'phase': 'idle', 'total': 0, 'done': 0,
                      'updated': 0, 'reused': 0, 'issues': [], 'current': '', 'savedAt': '',
                      'warning': '', 'cacheError': ''}
        if self.cache.exists():
            try:
                payload = json.loads(self.codec(self.cache.read_bytes(), decrypt=True).decode('utf-8'))
                if payload.get('version') != 1 or not isinstance(payload['files'], dict):
                    raise ValueError()
                self.root, self.files = payload['root'], payload['files']
                self.state['savedAt'] = payload.get('savedAt', '')
            except Exception:
                self.state['cacheError'] = '已有索引未能读取，请重新建立索引。原文件不受影响。'

    def status(self):
        with self.lock:
            return {**self.state, 'issues': list(self.state['issues']), 'root': self.root,
                    'fileCount': len(self.files),
                    'chunkCount': sum(len(f['chunks']) for f in self.files.values())}

    def start(self, folder):
        if not isinstance(folder, str) or not folder.strip():
            raise ValueError('请先选择文件夹。')
        root = Path(folder).expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ValueError('选择的路径不是文件夹。')
        with self.lock:
            if self.state['running']:
                raise ValueError('已有索引任务在运行，请等待或取消。')
            self.cancel.clear()
            self.state.update(running=True, phase='scanning', done=0, total=0, updated=0,
                              reused=0, issues=[], current='', warning='', cacheError='')
            self.worker = threading.Thread(target=self._scan, args=(root,), daemon=True)
            self.worker.start()

    def issue(self, name, reason):
        with self.lock:
            if len(self.state['issues']) < 100:
                self.state['issues'].append({'name': name, 'reason': reason})
            else:
                self.state['warning'] = '问题较多，仅显示前 100 条；请缩小索引文件夹。'

    def _scan(self, root):
        with self.lock:
            previous = dict(self.files) if str(root) == self.root else {}
        selected, pending = {}, []
        try:
            def walk_error(error):
                self.issue(Path(error.filename or str(root)).name, '文件夹无法访问，本次未读取。')

            stop = False
            for base, dirs, names in os.walk(root, followlinks=False, onerror=walk_error):
                def linked_directory(name):
                    directory = Path(base) / name
                    return directory.is_symlink() or getattr(directory, 'is_junction', lambda: False)()
                dirs[:] = sorted(d for d in dirs if not linked_directory(d))
                for name in sorted(names):
                    path = Path(base) / name
                    if name.startswith('~$') or path.suffix.lower() not in SUPPORTED or not allowed(path, root):
                        continue
                    if len(pending) >= MAX_FILES:
                        with self.lock:
                            self.state['warning'] = f'本次最多处理 {MAX_FILES} 个文件，其余未索引，请选择更小的文件夹。'
                        stop = True
                        break
                    pending.append(path)
                if stop or self.cancel.is_set():
                    break
            with self.lock:
                self.state.update(total=len(pending), phase='reading')
            for path in pending:
                if self.cancel.is_set():
                    break
                key = hashlib.sha256(str(path).encode('utf-8')).hexdigest()
                with self.lock:
                    self.state['current'] = path.name
                try:
                    if not allowed(path, root):
                        raise ValueError('文件已移动或不在所选文件夹内。')
                    stat = path.stat()
                    signature = [stat.st_mtime_ns, stat.st_size]
                    old = previous.get(key)
                    if stat.st_size > MAX_BYTES:
                        self.issue(path.name, '文件超过 100 MB，未读取。')
                        continue
                    if old and old['signature'] == signature:
                        selected[key] = old
                        with self.lock:
                            self.state['reused'] += 1
                        continue
                    result = self.reader(path)
                    if path.stat().st_mtime_ns != stat.st_mtime_ns:
                        self.issue(path.name, '读取期间文件发生变化，请更新索引后再检索。')
                        continue
                    selected[key] = {'id': key, 'path': str(path), 'name': path.name,
                                     'relative': str(path.relative_to(root)), 'signature': signature,
                                     'kind': 'word' if path.suffix.lower() in {'.doc', '.docx'} else 'ppt',
                                     'chunks': result['chunks'], 'truncated': result['truncated']}
                    if result['truncated']:
                        self.issue(path.name, '文字超过 200 万字符，已索引前部分。')
                    if not result['chunks']:
                        self.issue(path.name, '没有可检索文字；图片、扫描页需要 OCR，本版未启用。')
                    with self.lock:
                        self.state['updated'] += 1
                except ImportError:
                    self.issue(path.name, '缺少 pywin32。请按本地检索说明安装，或使用已打包的启动器。')
                except Exception:
                    self.issue(path.name, 'Office 读取失败。请检查本机打开权限、密码提示及 Office 安装。')
                finally:
                    with self.lock:
                        self.state['done'] += 1
            if self.cancel.is_set():
                # Preserve unchanged old entries not reached by a canceled scan.
                for key, old in previous.items():
                    if key not in selected and allowed(Path(old['path']), root):
                        selected[key] = old
            saved = datetime.now(timezone.utc).isoformat()
            payload = {'version': 1, 'root': str(root), 'files': selected, 'savedAt': saved}
            try:
                ciphertext = self.codec(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
                self.cache.parent.mkdir(parents=True, exist_ok=True)
                temporary = self.cache.with_suffix('.tmp')
                temporary.write_bytes(ciphertext)
                os.replace(temporary, self.cache)
                with self.lock:
                    self.state['savedAt'] = saved
            except Exception:
                with self.lock:
                    self.state['cacheError'] = '本次索引可检索，但保存失败；下次启动需要重新建立。请检查本地存储权限。'
            with self.lock:
                self.root, self.files = str(root), selected
                self.state['phase'] = 'canceled' if self.cancel.is_set() else 'complete'
        except Exception:
            with self.lock:
                self.state.update(phase='error', warning='索引未完成，请检查文件夹权限后重试。')
        finally:
            with self.lock:
                self.state.update(running=False, current='')

    def search(self, query, kind='all', offset=0):
        if not isinstance(query, str) or not query.strip() or len(query) > 200:
            raise ValueError('请输入 1—200 字的关键词。多个关键词用空格隔开。')
        if kind not in {'all', 'word', 'ppt'}:
            raise ValueError('文件类型无效。')
        if not isinstance(offset, int) or offset < 0 or offset > 10000:
            raise ValueError('页码无效。')
        terms = query.casefold().split()
        with self.lock:
            files = list(self.files.values())
            root = Path(self.root) if self.root else None
        hits = []
        stale = 0
        for file in sorted(files, key=lambda f: f['relative'].casefold()):
            if kind != 'all' and file['kind'] != kind:
                continue
            path = Path(file['path'])
            try:
                if root is None or not allowed(path, root) or list((path.stat().st_mtime_ns, path.stat().st_size)) != file['signature']:
                    stale += 1
                    continue
            except OSError:
                stale += 1
                continue
            for chunk in file['chunks']:
                folded = chunk['text'].casefold()
                if not all(term in folded for term in terms):
                    continue
                position = min(folded.find(term) for term in terms)
                start = max(0, position - 65)
                snippet = ('…' if start else '') + chunk['text'][start:start + 340]
                if start + 340 < len(chunk['text']):
                    snippet += '…'
                hits.append({k: file[k] for k in ('id', 'name', 'relative', 'kind', 'truncated')} |
                            {'location': chunk['location'], 'snippet': snippet})
        return {'results': hits[offset:offset + 30], 'total': len(hits), 'offset': offset, 'staleFiles': stale}

    def open_path(self, file_id):
        with self.lock:
            file = self.files.get(file_id)
            root = Path(self.root) if self.root else None
        if file is None or root is None or not allowed(Path(file['path']), root):
            raise ValueError('文件不在当前索引中，或已移动。请更新索引。')
        return Path(file['path'])

    def clear(self):
        with self.lock:
            if self.state['running']:
                raise ValueError('请先取消并等待索引任务结束，再清空。')
            if self.cache.exists():
                self.cache.unlink()
            self.root, self.files = '', {}
            self.state.update(phase='idle', total=0, done=0, updated=0, reused=0,
                              savedAt='', issues=[], warning='', cacheError='')
