"""Run on Windows to produce a portable Office companion, including Python."""
import importlib.util
import importlib.metadata
from pathlib import Path
import shutil
import subprocess
import sys


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
    command = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir',
               '--console', '--name', 'ProcessEngineerWorkbench',
               '--distpath', str(build / 'dist'), '--workpath', str(build / 'work'),
               '--specpath', str(build), '--paths', str(root / 'local_service'),
               '--add-data', str(root / '启动工程师工作台.html') + ';.',
               '--collect-submodules', 'win32com', '--hidden-import', 'pythoncom',
               '--hidden-import', 'pywintypes', '--hidden-import', 'win32timezone',
               '--hidden-import', 'tkinter', '--hidden-import', 'tkinter.filedialog',
               str(root / 'local_service' / 'launcher.py')]
    subprocess.run(command, check=True)
    distribution = build / 'dist' / 'ProcessEngineerWorkbench'
    for name in ('本地文档检索说明.txt', 'THIRD-PARTY-NOTICES.txt'):
        shutil.copy2(root / name, distribution / name)
    shutil.copytree(root / 'licenses', distribution / 'licenses', dirs_exist_ok=True)
    licenses = distribution / 'licenses' / 'windows-runtime'
    licenses.mkdir(parents=True, exist_ok=True)
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if not python_license.is_file():
        raise RuntimeError('未找到当前 Python 的 LICENSE.txt，请使用完整的 Windows Python 安装环境打包。')
    shutil.copy2(python_license, licenses / 'Python-LICENSE.txt')
    for package in ('pywin32', 'pyinstaller'):
        metadata = importlib.metadata.distribution(package)
        for file in metadata.files or []:
            if 'license' in file.name.lower() or file.name.lower().startswith('copying'):
                source = Path(metadata.locate_file(file))
                if source.is_file():
                    name = package + '-' + str(file).replace('\\', '-').replace('/', '-')
                    shutil.copy2(source, licenses / name)
    tcl = Path(sys.base_prefix) / 'tcl'
    if tcl.is_dir():
        for source in tcl.rglob('license*'):
            if source.is_file():
                name = 'TclTk-' + str(source.relative_to(tcl)).replace('\\', '-').replace('/', '-')
                shutil.copy2(source, licenses / name)
    archive = shutil.make_archive(str(build / 'Workbench-Windows-Portable'), 'zip',
                                  root_dir=distribution.parent, base_dir=distribution.name)
    print('\n打包完成：' + archive)
    print('先解压，在当前电脑以及另一台未安装 Python 的 Windows 电脑上测试 exe、索引、搜索与打开原文件。')
    print('确认公司授权读取正常后，再发送整个 ZIP 给同事；不能只发送 exe。')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError:
        print('打包失败，请查看上方日志。未生成可分发的新版本。')
        raise SystemExit(1)
    except Exception as error:
        print('打包未完成：' + str(error))
        raise SystemExit(1)
