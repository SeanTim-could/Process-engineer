"""Reject private credentials before embedding a public web page."""
from pathlib import Path
import base64
import importlib.util
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('auth_sync',ROOT/'scripts/sync-account-auth.py')
sync=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class PublicAccountConfiguration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(ROOT/'启动工程师工作台.html').read_text()

    def config(self,**changes):
        return {'enabled':True,'url':'https://fixture.supabase.co','publicKey':'sb_publishable_fixture',**changes}

    def test_private_keys_are_rejected_even_when_disabled(self):
        payload=base64.urlsafe_b64encode(json.dumps({'role':'service_role'}).encode()).decode().rstrip('=')
        for enabled in [True,False]:
            for key in ['sb_secret_fixture','header.'+payload+'.signature']:
                with self.subTest(enabled=enabled,key_type=key.split('_')[0]):
                    with self.assertRaises(ValueError):sync.render(self.html,self.config(enabled=enabled,publicKey=key))

    def test_invalid_urls_cannot_expand_the_connection_policy(self):
        for url in ['http://fixture.supabase.co','https://fixture.supabase.co; connect-src *','https://user:password@fixture.supabase.co','https://fixture.supabase.co/path']:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):sync.render(self.html,self.config(url=url))

    def test_only_the_configured_origin_is_added(self):
        result=sync.render(self.html,self.config())
        self.assertIn("connect-src 'self' https://fixture.supabase.co;",result)
        self.assertEqual(result.count('id="managed-accounts-style"'),1)

    def test_web_build_rejects_private_keys_before_writing(self):
        spec=importlib.util.spec_from_file_location('web_build',ROOT/'scripts/build-web.py')
        web=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(web)
        original=(ROOT/'启动工程师工作台.html').read_bytes()
        with self.assertRaises(ValueError):web.build(self.config(publicKey='sb_secret_fixture'))
        self.assertEqual((ROOT/'启动工程师工作台.html').read_bytes(),original)

    def test_origin_is_normalized_for_shared_website_sessions(self):
        config=sync.normalize_config(self.config(url='https://fixture.supabase.co/'))
        self.assertEqual(config['url'],'https://fixture.supabase.co')

    def test_checked_in_configuration_is_current(self):
        config=json.loads((ROOT/'frontend/auth-config.json').read_text())
        self.assertEqual(sync.render(self.html,config),self.html)

if __name__=='__main__':unittest.main(verbosity=2)
