@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if exist "%~dp0Windows-Build\dist\ProcessEngineerWorkbench\ProcessEngineerWorkbench.exe" (
  "%~dp0Windows-Build\dist\ProcessEngineerWorkbench\ProcessEngineerWorkbench.exe"
  goto end
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0local_service\launcher.py"
) else (
  python "%~dp0local_service\launcher.py"
)
:end
echo.
echo 启动窗口已结束。若有错误，请查看上方提示和“本地文档检索说明.txt”。
pause
