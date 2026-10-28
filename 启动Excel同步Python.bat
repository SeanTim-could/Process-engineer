@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if defined WORKBENCH_PYTHON (
  "%WORKBENCH_PYTHON%" -u "%~dp0local_service\launcher.py" --excel-sync
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -u "%~dp0local_service\launcher.py" --excel-sync
  ) else (
    python -u "%~dp0local_service\launcher.py" --excel-sync
  )
)
echo.
echo 服务已结束。若缺少依赖，请先运行“安装Excel同步依赖.bat”。
echo 可设置 WORKBENCH_PYTHON 为公司已授权 python.exe 的完整路径。
pause
