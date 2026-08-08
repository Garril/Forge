$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$captionerRoot = Join-Path $root 'video-captioner'
$pythonVersion = '3.12'

function Test-CommandAvailable([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
}

function Add-ToPath([string]$path) {
  if (-not (Test-Path $path -PathType Container)) { return }

  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $currentPath = "$machinePath;$userPath"
  if ($currentPath -like "*$path*") { return }

  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
      [Environment]::SetEnvironmentVariable('Path', "$machinePath;$path", 'Machine')
      Write-Host "Added to system PATH: $path" -ForegroundColor Green
    } else {
      $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $path } else { "$userPath;$path" }
      [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
      Write-Host "Added to user PATH: $path" -ForegroundColor Green
      Write-Host 'Close and reopen terminals to refresh PATH in other windows.' -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Could not update PATH: $path" -ForegroundColor Yellow
    Write-Host 'Run this script as Administrator if system PATH changes are required.' -ForegroundColor Yellow
  }
}

function Find-Python {
  foreach ($commandName in @('python', 'py')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command) {
      try {
        $version = & $commandName --version 2>&1 | Out-String
        if ($version -match 'Python\s+3\.(10|11|12|13)') { return $commandName }
      } catch {
      }
    }
  }
  return $null
}

Write-Host 'Forge Python dependency setup' -ForegroundColor Green
Write-Host "Project directory: $root"

Refresh-Path
$pythonCommand = Find-Python

if (-not $pythonCommand) {
  Write-Host "`nPython 3.10-3.13 was not found. Installing Python $pythonVersion ..." -ForegroundColor Yellow
  if (-not (Test-CommandAvailable 'winget')) {
    throw 'Python was not found and winget is unavailable. Install Python 3.12 x64 manually.'
  }

  winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { throw 'Python installation failed.' }
  Refresh-Path
  $pythonCommand = Find-Python
}

if (-not $pythonCommand) {
  throw 'Python was installed but is not available in this terminal. Reopen the terminal and run setup-python.cmd again.'
}

$pythonVersionText = & $pythonCommand --version 2>&1
Write-Host "Python: $pythonVersionText" -ForegroundColor Green

$pythonExe = (& $pythonCommand -c "import sys; print(sys.executable)" 2>$null | Out-String).Trim()
if (-not $pythonExe -or -not (Test-Path $pythonExe)) { throw 'Could not determine the Python executable path.' }
$pythonDir = Split-Path $pythonExe -Parent
$pythonScriptsDir = Join-Path $pythonDir 'Scripts'
Add-ToPath $pythonDir
Add-ToPath $pythonScriptsDir
Refresh-Path

Write-Host "`nUpgrading pip..." -ForegroundColor Cyan
& $pythonCommand -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }

$pyprojectPath = Join-Path $captionerRoot 'pyproject.toml'
if (-not (Test-Path $pyprojectPath)) {
  throw "Python project configuration was not found: $pyprojectPath"
}

Write-Host "`nInstalling Forge video-captioner dependencies..." -ForegroundColor Cyan
& $pythonCommand -m pip install -e $captionerRoot
if ($LASTEXITCODE -ne 0) { throw 'video-captioner dependency installation failed.' }

& $pythonCommand -c 'import videocaptioner, yt_dlp'
if ($LASTEXITCODE -ne 0) { throw 'Python dependency verification failed.' }
Write-Host 'Python packages OK' -ForegroundColor Green

& $pythonCommand -c 'import MetaTrader5'
if ($LASTEXITCODE -eq 0) {
  Write-Host 'MetaTrader5 Python package: detected' -ForegroundColor Green
} else {
  Write-Host 'Warning: MetaTrader5 Python package was not detected.' -ForegroundColor Yellow
}

Refresh-Path
if (Test-CommandAvailable 'ffmpeg') {
  Write-Host 'ffmpeg: detected' -ForegroundColor Green
} else {
  Write-Host 'Warning: ffmpeg was not detected. Video functions may not work.' -ForegroundColor Yellow
  Write-Host 'Install ffmpeg manually and add its bin directory to PATH.' -ForegroundColor Yellow
}

Write-Host 'Note: MetaTrader 5 desktop terminal must be installed, running, and logged in for market analysis.' -ForegroundColor Yellow
Write-Host "`nPython setup completed. Start Forge with: npm start" -ForegroundColor Green
