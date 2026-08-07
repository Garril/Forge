@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-forge.ps1"
if errorlevel 1 (
  echo.
  echo Forge 初始化失败，请根据上面的提示处理后重试。
  pause
  exit /b 1
)
echo.
pause
