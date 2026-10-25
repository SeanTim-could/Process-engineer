"""Run synthetic service tests and expose diagnostics in the Actions summary."""
from pathlib import Path
import io
import os
import sys
import unittest


def main():
    root = Path(__file__).resolve().parent.parent
    output = io.StringIO()
    suite = unittest.defaultTestLoader.discover(str(root / 'local_service'))
    result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
    report = output.getvalue()
    print(report, end='')
    if os.environ.get('GITHUB_ACTIONS'):
        for test, trace in result.failures + result.errors:
            diagnostic = (str(test) + '\n' + trace).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
            print('::error title=Local service test::' + diagnostic)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with Path(summary).open('a', encoding='utf-8') as target:
            target.write('## Local service tests\n\n')
            target.write(f'Executed: {result.testsRun}; failures: {len(result.failures)}; '
                         f'errors: {len(result.errors)}; skipped: {len(result.skipped)}.\n\n')
            target.write('<details><summary>Test diagnostics (synthetic documents only)</summary>\n\n```text\n')
            target.write(report)
            target.write('\n```\n</details>\n')
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(main())
