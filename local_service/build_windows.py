"""Run on Windows to produce a portable Office companion, including Python."""
import importlib.util
import importlib.metadata
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
from zipfile import ZipFile


def copy_runtime_licenses(destination):
    destination.mkdir(parents=True, exist_ok=True)
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if not python_license.is_file():
        raise RuntimeError('未找到当前 Python 的 LICENSE.txt，请使用完整的 Windows Python 安装环境打包。')
    shutil.copy2(python_license, destination / 'Python-LICENSE.txt')
    packages = []
    for metadata in importlib.metadata.distributions():
        package = metadata.metadata['Name']
        packages.append({'name': package, 'version': metadata.version})
        for file in metadata.files or []:
            if 'license' in file.name.lower() or file.name.lower().startswith('copying'):
                source = Path(metadata.locate_file(file))
                if source.is_file():
                    name = package + '-' + str(file).replace('\\', '-').replace('/', '-')
                    shutil.copy2(source, destination / name)
    tcl = Path(sys.base_prefix) / 'tcl'
    if tcl.is_dir():
        for source in tcl.rglob('license*'):
            if source.is_file():
                name = 'TclTk-' + str(source.relative_to(tcl)).replace('\\', '-').replace('/', '-')
                shutil.copy2(source, destination / name)
    return sorted(packages, key=lambda item: item['name'].lower())


def verify_archive(archive):
    required = {'ProcessEngineerWorkbench/ProcessEngineerWorkbench.exe',
                f'ProcessEngineerWorkbench/_internal/python{sys.version_info.major}{sys.version_info.minor}.dll',
                'ProcessEngineerWorkbench/启动本地检索.bat',
                'ProcessEngineerWorkbench/启动工程师工作台.html',
                'ProcessEngineerWorkbench/便携版使用说明.txt',
                'ProcessEngineerWorkbench/build-info.json'}
    with ZipFile(archive) as package:
        if package.testzip() is not None or not required.issubset(package.namelist()):
            raise RuntimeError('便携包校验失败，未得到完整的 EXE 及运行组件。')


def main():
    if sys.platform != 'win32':
        print('请在 Windows 电脑运行打包。不能在 Linux 上生成 Windows 启动器。')
        return 1
    missing = [name for name in ('PyInstaller', 'pythoncom', 'win32com', 'tkinter')
               if importlib.util.find_spec(name) is None]
    if missing:
        print('打包环境缺少：' + ', '.join(missing))
        print('请使用当前 Python 安装："' + sys.executable + '" -m pip install pyinstaller pywin32')
        print('若缺 tkinter，请修改 Python 安装并启用 Tcl/Tk。安装依赖后重新运行。')
        return 1
    root = Path(__file__).resolve().parent.parent
    build = root / 'Windows-Build'
    build.mkdir(exist_ok=True)
    archive_path = build / 'Workbench-Windows-Portable.zip'
    archive_path.unlink(missing_ok=True)
    command = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir',
               '--console', '--name', 'ProcessEngineerWorkbench',
               '--distpath', str(build / 'dist'), '--workpath', str(build / 'work'),
               '--specpath', str(build), '--paths', str(root / 'local_service'),
               '--add-data', str(root / '启动工程师工作台.html') + ';.',
               '--collect-submodules', 'win32com', '--hidden-import', 'pythoncom',
               '--hidden-import', 'pywintypes', '--hidden-import', 'win32timezone',
               '--hidden-import', 'tkinter', '--hidden-import', 'tkinter.filedialog',
               str(root / 'local_service' / 'launcher.py')]
    build_result = subprocess.run(command, check=True, capture_output=True,
                                  text=True, encoding='utf-8', errors='replace')
    print(build_result.stdout)
    print(build_result.stderr)
    distribution = build / 'dist' / 'ProcessEngineerWorkbench'
    for name in ('便携版使用说明.txt', '启动本地检索.bat', '启动工程师工作台.html',
                 '本地检索网站接入说明.md', 'THIRD-PARTY-NOTICES.txt'):
        shutil.copy2(root / name, distribution / name)
    shutil.copytree(root / 'licenses', distribution / 'licenses', dirs_exist_ok=True)
    packages = copy_runtime_licenses(distribution / 'licenses' / 'windows-runtime')
    result = subprocess.run([str(distribution / 'ProcessEngineerWorkbench.exe'), '--self-test'],
                            check=True, capture_output=True, text=True, encoding='utf-8')
    runtime = json.loads(result.stdout)
    if not runtime.get('ok') or not runtime.get('frozen'):
        raise RuntimeError('EXE 未通过内置运行时自检。')
    info = {'architecture': platform.machine(), 'python': platform.python_version(),
            'build_environment_packages': packages, 'runtime_verification': runtime}
    (distribution / 'build-info.json').write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    archive = shutil.make_archive(str(build / 'Workbench-Windows-Portable'), 'zip',
                                  root_dir=distribution.parent, base_dir=distribution.name)
    verify_archive(archive)
    with Path(archive).open('rb') as source:
        checksum = hashlib.file_digest(source, 'sha256').hexdigest()
    Path(archive + '.sha256').write_text(checksum + '  ' + Path(archive).name + '\n', encoding='ascii')
    print('\n打包完成：' + archive)
    print('本包包含 Python 及 pywin32，使用者无需安装 Python。必须完整解压并保留 _internal 目录。')
    print('Microsoft Office 及文档访问权限仍需在目标电脑验证。')
    print('确认公司授权读取正常后，再发送整个 ZIP 给同事；不能只发送 exe。')
    return 0


def report_failure(message):
    print(message)
    if os.environ.get('GITHUB_ACTIONS'):
        escaped = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print('::error title=Portable build::' + escaped)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        output = '\n'.join(str(value) for value in (error.stdout, error.stderr) if value)
        report_failure('打包失败，未生成可分发的新版本。\n' + output[-16000:])
        raise SystemExit(1)
    except Exception as error:
        report_failure('打包未完成：' + str(error))
        raise SystemExit(1)
