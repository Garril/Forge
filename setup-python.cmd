@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%PS_EXE%" (
  where pwsh.exe >nul 2>nul
  if errorlevel 1 (
    echo PowerShell was not found. Please install PowerShell and run this file again.
    pause
    exit /b 1
  )
  set "PS_EXE=pwsh.exe"
)

"%PS_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-python.ps1"
if errorlevel 1 (
  echo.
  echo Forge Python setup failed. Follow the message above and try again.
  pause
  exit /b 1
)

echo.
echo Forge Python setup completed.
pause
