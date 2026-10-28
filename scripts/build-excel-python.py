"""Package the Python-source option for PCs where python.exe is already allowlisted."""
import argparse
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
FILES = ['启动Excel同步Python.bat', '安装Excel同步依赖.bat', 'requirements-excel-sync.txt',
         'Excel自动同步使用说明.md', '启动工程师工作台.html', 'THIRD-PARTY-NOTICES.txt',
         *['local_service/' + name for name in ['launcher.py', 'document_index.py', 'office_reader.py',
                                               'excel_reader.py', 'excel_bridge.html']],
         *[str(p.relative_to(ROOT)) for p in sorted((ROOT / 'licenses').rglob('*')) if p.is_file()]]


def build(output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / 'Workbench-Excel-Python.zip'
    with ZipFile(archive, 'w', ZIP_DEFLATED) as target:
        for name in FILES:
            target.write(ROOT / name, 'WorkbenchExcelPython/' + name)
    with ZipFile(archive) as target:
        if target.testzip() is not None:
            raise RuntimeError('Python脚本包校验失败。')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_name(archive.name + '.sha256').write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(ROOT / 'Windows-Build'))
    args = parser.parse_args()
    print(build(args.output))
