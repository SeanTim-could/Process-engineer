@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo 将通过 pip 为当前 Python 安装 pywin32，此步骤需要联网或公司配置的软件源。
echo 如果之前的 Office 测试正常，可关闭本窗口，直接运行“启动工作台.bat”。
pause
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m pip install pywin32
) else (
  python -m pip install pywin32
)
echo 安装完成后请运行“启动工作台.bat”；如有错误请查看上方信息。
pause
