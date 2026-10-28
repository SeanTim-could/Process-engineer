@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo 将为当前Python安装Excel读取依赖，需要网络或公司配置的软件源。
if defined WORKBENCH_PYTHON (
  "%WORKBENCH_PYTHON%" -m pip install -r "%~dp0requirements-excel-sync.txt"
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -m pip install -r "%~dp0requirements-excel-sync.txt"
  ) else (
    python -m pip install -r "%~dp0requirements-excel-sync.txt"
  )
)
pause
