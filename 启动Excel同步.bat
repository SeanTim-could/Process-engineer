@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if exist "%~dp0ProcessEngineerWorkbench.exe" (
  "%~dp0ProcessEngineerWorkbench.exe" --excel-sync
) else (
  call "%~dp0启动Excel同步Python.bat"
)
pause
