@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if exist "%~dp0ProcessEngineerWorkbench.exe" (
  "%~dp0ProcessEngineerWorkbench.exe" --documents
  goto end
)
if not exist "%~dp0local_service\launcher.py" (
  echo 找不到本机检索程序，请完整解压更新包，保留文件夹结构。
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0local_service\launcher.py" --documents
) else (
  python "%~dp0local_service\launcher.py" --documents
)
:end
echo.
echo 检索服务已结束。如有错误，请查看上方提示和“本地检索网站接入说明.md”。
pause
