"""Background scheduling with synthetic readings; no PI connection or real Excel."""
from copy import deepcopy
import json
import threading
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from excel_reader import ExcelScheduler, active_excel


def wait_for(check, seconds=4):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        value = check()
        if value:
            return value
        time.sleep(.01)
    raise AssertionError('background task did not reach expected state')


class FakeReader:
    def __init__(self):
        self.values = {'a': [{'time': 1, 'values': {'c_1': 20, 'c_2': 0}}],
                       'b': [{'time': 2, 'values': {'c_1': 99}}]}
        self.calls = []
        self.fail = set()
        self.block = None

    def source(self, token):
        if token not in self.values:
            raise ValueError('invalid capability')
        return token, 'open'

    def read(self, settings):
        token = settings['fileId']
        self.calls.append(token)
        if token in self.fail:
            self.fail.remove(token)
            raise ValueError('Excel暂时忙')
        if self.block:
            self.block.wait(3)
        return {'version': 1, 'sourceId': token * 64, 'filename': token + '.xlsx', 'sheet': 'PI',
                'columns': [{'key': 'c_1', 'label': '温度', 'unit': ''}, {'key': 'c_2', 'label': '流量', 'unit': ''}],
                'rows': deepcopy(self.values[token]), 'readAt': str(len(self.calls)), 'digest': str(len(self.calls))}


class SchedulerTests(unittest.TestCase):
    def setUp(self):
        self.reader = FakeReader()
        self.scheduler = ExcelScheduler(self.reader)

    def tearDown(self):
        self.scheduler.close()
        if self.scheduler.worker:
            self.scheduler.worker.join(4)

    def start(self, token='a', owner='a' * 36):
        body = {'owner': owner, 'interval': 10, 'settings': {'fileId': token, 'sheet': 'PI', 'timeColumn': 'A',
               'columns': [{'column': 'B', 'label': '温度'}]}}
        task = self.scheduler.start(body)['taskId']
        return task, body

    def ready(self, task):
        def check():
            state = self.scheduler.status(task)
            return state if state['readAt'] and not state['reading'] else None
        return wait_for(check)

    def test_multiple_jobs_run_without_browser_poll_and_retry_after_busy(self):
        self.reader.fail.add('a')
        a, body = self.start()
        b, _ = self.start('b', 'b' * 36)
        wait_for(lambda: len(self.reader.calls) == 2)
        self.assertEqual(set(self.reader.calls), {'a', 'b'})
        state = self.scheduler.status(a)
        self.assertIn('暂时忙', state['error'])
        self.assertTrue(state['running'])
        self.assertEqual(self.ready(b)['delivery']['snapshot']['rows'][0]['values']['c_1'], 99)
        self.scheduler.now(a)
        self.assertEqual(self.ready(a)['failures'], 0)
        self.assertEqual(self.scheduler.start(body)['taskId'], a, 'start retries must not duplicate a running job')
        self.scheduler.stop(a)
        self.assertTrue(self.scheduler.status(b)['running'], 'stopping one task must not stop others')
        with self.assertRaises(ValueError):
            self.scheduler.status(a)

    def test_acknowledgement_retains_newer_values_and_lost_ack_can_replay(self):
        a, _ = self.start()
        first = self.ready(a)['delivery']
        self.assertEqual(self.scheduler.status(a)['delivery']['id'], first['id'])
        self.reader.values['a'][0]['values']['c_1'] = 21
        self.reader.values['a'].append({'time': 3, 'values': {'c_1': 22}})
        self.scheduler.now(a)
        wait_for(lambda: self.scheduler.status(a)['readAt'] == '2')
        self.assertEqual(self.scheduler.status(a)['delivery']['snapshot']['rows'][0]['values']['c_1'], 20)
        self.scheduler.acknowledge(a, first['id'])
        second = self.scheduler.status(a)['delivery']
        self.assertEqual(second['snapshot']['rows'], [{'time': 1, 'values': {'c_1': 21}}, {'time': 3, 'values': {'c_1': 22}}])
        self.scheduler.acknowledge(a, 'forged')
        self.assertEqual(self.scheduler.status(a)['delivery']['id'], second['id'])
        self.scheduler.acknowledge(a, second['id'])
        self.scheduler.now(a)
        wait_for(lambda: self.scheduler.status(a)['readAt'] == '3')
        self.assertNotIn('delivery', self.scheduler.status(a), 'unchanged sheets must not resend full tables')

    def test_buffer_limit_never_drops_undelivered_data(self):
        a, _ = self.start()
        first = self.ready(a)['delivery']
        self.reader.values['a'] = [{'time': 2, 'values': {'c_1': 30}}]
        with patch('excel_reader.MAX_ROWS', 1):
            self.scheduler.now(a)
            wait_for(lambda: self.scheduler.status(a)['failures'] == 1)
        self.assertEqual(self.scheduler.status(a)['delivery'], first)
        self.scheduler.acknowledge(a, first['id'])
        self.scheduler.now(a)
        wait_for(lambda: self.scheduler.status(a)['failures'] == 0)
        self.assertEqual(self.scheduler.status(a)['delivery']['snapshot']['rows'][0]['time'], 2)

    def test_stop_during_read_discards_late_result_and_worker_can_restart(self):
        gate = self.reader.block = threading.Event()
        a, _ = self.start()
        wait_for(lambda: self.reader.calls)
        self.scheduler.stop(a)
        gate.set()
        wait_for(lambda: self.scheduler.worker is None)
        b, _ = self.start('b', 'b' * 36)
        self.assertEqual(self.ready(b)['delivery']['snapshot']['filename'], 'b.xlsx')
        with self.assertRaises(ValueError):
            self.scheduler.status(a)
        with self.assertRaises(ValueError):
            self.scheduler.start({'owner': '../bad'})

    def test_exact_running_workbook_selects_its_own_excel_instance(self):
        chosen, wrong = object(), object()
        moniker = SimpleNamespace(GetDisplayName=lambda *args: '/tmp/selected.xlsx')
        table = SimpleNamespace(EnumRunning=lambda: [moniker], GetObject=lambda m: SimpleNamespace(QueryInterface=lambda iid: 'book-dispatch'))
        events = []
        com = SimpleNamespace(CoInitialize=lambda: events.append('init'), CoUninitialize=lambda: events.append('uninit'),
                              GetRunningObjectTable=lambda: table, CreateBindCtx=lambda n: None, IID_IDispatch='dispatch')
        client = SimpleNamespace(Dispatch=lambda value: SimpleNamespace(Application=chosen), GetActiveObject=lambda name: wrong)
        with patch('excel_reader.sys.platform', 'win32'), patch('excel_reader.importlib.import_module', side_effect=lambda name: com if name == 'pythoncom' else client):
            with active_excel('/tmp/selected.xlsx') as app:
                self.assertIs(app, chosen)
            with active_excel('/tmp/other.xlsx') as app:
                self.assertIs(app, wrong)
        self.assertEqual(events, ['init', 'uninit', 'init', 'uninit'])


if __name__ == '__main__':
    unittest.main()
