"""Portable resource selection and archive checks, without requiring Windows."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

from build_windows import verify_archive
from launcher import APP_HTML, runtime_path


class PortableTests(unittest.TestCase):
    def test_frozen_app_prefers_the_html_beside_the_executable(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            bundle = root / '_internal'
            bundle.mkdir()
            external = root / APP_HTML
            external.write_text('<html>updated</html>', encoding='utf-8')
            with patch.object(sys, 'frozen', True, create=True), \
                    patch.object(sys, 'executable', str(root / 'ProcessEngineerWorkbench.exe')), \
                    patch.object(sys, '_MEIPASS', str(bundle), create=True):
                self.assertEqual(runtime_path(), external)
                external.unlink()
                self.assertEqual(runtime_path(), bundle / APP_HTML)

    def test_archive_requires_the_runtime_and_user_instructions(self):
        prefix = 'ProcessEngineerWorkbench/'
        required = ['ProcessEngineerWorkbench.exe',
                    f'_internal/python{sys.version_info.major}{sys.version_info.minor}.dll',
                    '启动本地检索.bat', '启动工程师工作台.html', '便携版使用说明.txt', 'build-info.json',
                    '_internal/excel_bridge.html', '启动Excel同步Python.bat', 'local_service/excel_reader.py']
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder) / 'portable.zip'
            with ZipFile(archive, 'w') as package:
                package.writestr(prefix + required[0], b'EXE fixture, not executable')
            with self.assertRaises(RuntimeError):
                verify_archive(archive)
            with ZipFile(archive, 'w') as package:
                for name in required:
                    package.writestr(prefix + name, b'fixture')
            verify_archive(archive)


if __name__ == '__main__':
    unittest.main()
