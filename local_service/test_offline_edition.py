"""Offline packaging and local launch selection use synthetic files only."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest
from zipfile import ZipFile

from launcher import launch_url

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('offline_builder',ROOT/'scripts/build-offline.py')
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class OfflineEditionTests(unittest.TestCase):
    def test_render_removes_accounts_without_rewriting_the_managed_source(self):
        source=(ROOT/builder.HTML_NAME).read_bytes()
        config=(ROOT/'frontend/auth-config.json').read_bytes()
        html=builder.render(source.decode())
        js=base64.b64decode(re.search(r'<script[^>]+src="data:text/javascript;base64,([^"]+)',html)[1]).decode()
        self.assertIn(builder.MARKER,html)
        self.assertIn("connect-src 'none'",html)
        self.assertNotIn('managed-accounts-style',html)
        self.assertNotIn('web-entry-redirect',html)
        for removed in ['function Login(){','function Password(','function Admin(){','/auth/v1/','.supabase.co','BackupMerge.']:
            self.assertNotIn(removed,js)
        for feature in ['var PCAMath','var PCAWorkspace','var LiveSeries','var Dashboard','var ExcelSync','var WorkspaceFiles']:
            self.assertIn(feature,js)
        self.assertEqual(source,(ROOT/builder.HTML_NAME).read_bytes())
        self.assertEqual(config,(ROOT/'frontend/auth-config.json').read_bytes())

    def test_archives_contain_an_offline_app_and_local_only_start_scripts(self):
        with tempfile.TemporaryDirectory() as folder:
            archives=builder.build(folder)
            self.assertEqual(len(archives),2)
            for archive in archives:
                with ZipFile(archive) as package:
                    self.assertIsNone(package.testzip())
                    html=next(n for n in package.namelist() if n.endswith('/'+builder.HTML_NAME))
                    self.assertIn(builder.MARKER,package.read(html).decode())
                    self.assertTrue(any(n.endswith('/离线版使用说明.md') for n in package.namelist()))
                    for name in package.namelist():
                        if name.endswith(('启动离线工作台.bat','启动Excel同步.bat','启动Excel同步Python.bat')):
                            self.assertIn('--offline',package.read(name).decode())
                            self.assertNotIn('https://',package.read(name).decode())
                self.assertTrue(Path(str(archive)+'.sha256').is_file())

    def test_windows_archive_replaces_both_html_resources_and_keeps_the_runtime(self):
        with tempfile.TemporaryDirectory() as folder:
            portable=Path(folder)/'runtime'
            (portable/'_internal').mkdir(parents=True)
            (portable/'ProcessEngineerWorkbench.exe').write_bytes(b'fixture executable')
            (portable/'_internal/python312.dll').write_bytes(b'fixture runtime')
            (portable/'build-info.json').write_text(json.dumps({'runtime_verification':{'ok':True}}))
            result=builder.build(Path(folder)/'output',portable)
            with ZipFile(result[-1]) as package:
                prefix='ProcessEngineerWorkbench/'
                self.assertEqual(package.read(prefix+builder.HTML_NAME),package.read(prefix+'_internal/'+builder.HTML_NAME))
                self.assertEqual(package.read(prefix+'_internal/python312.dll'),b'fixture runtime')
                info=json.loads(package.read(prefix+'build-info.json'))
                self.assertFalse(info['authentication'])
                self.assertEqual(info['html_sha256'],hashlib.sha256(package.read(prefix+builder.HTML_NAME)).hexdigest())

    def test_offline_launches_never_open_the_website(self):
        origin='http://127.0.0.1:8765'
        for frozen in [False,True]:
            for excel in [False,True]:
                self.assertEqual(launch_url(origin,frozen=frozen,excel_sync=excel,offline=True),origin)
                self.assertEqual(launch_url(origin,frozen=frozen,excel_sync=excel,documents=True,offline=True),origin+'/documents')
        self.assertEqual(launch_url(origin,excel_sync=True),'https://workbench.myprocessworkbench.com/')
        self.assertEqual(launch_url(origin,frozen=True),origin+'/documents')


if __name__=='__main__':
    unittest.main(verbosity=2)
