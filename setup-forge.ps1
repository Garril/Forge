$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Test-CommandAvailable([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Find-MySqlExecutable {
  $command = Get-Command mysql.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe',
    'C:\Program Files\MariaDB 11.0\bin\mysql.exe',
    'C:\Program Files\MariaDB 11.4\bin\mysql.exe',
    'C:\Program Files\MariaDB 11.8\bin\mysql.exe'
  )

  $installRoots = @(
    'C:\Program Files\MySQL',
    'C:\Program Files\MariaDB',
    'C:\ProgramData\MySQL'
  )
  foreach ($rootPath in $installRoots) {
    if (Test-Path $rootPath) {
      $candidates += Get-ChildItem -Path $rootPath -Filter mysql.exe -File -Recurse -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    }
  }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (Test-Path $candidate -PathType Leaf) { return $candidate }
  }
  return $null
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
  $commonPaths = @(
    'C:\Program Files\nodejs'
  )
  foreach ($commonPath in $commonPaths) {
    if ((Test-Path $commonPath) -and ($env:Path -notlike "*$commonPath*")) {
      $env:Path = "$commonPath;$env:Path"
    }
  }
}

function Invoke-NpmInstall([string]$directory, [string]$label) {
  Write-Host "`n[$label] Installing Node.js dependencies..." -ForegroundColor Cyan
  Push-Location $directory
  try {
    if (Test-Path 'package-lock.json') {
      npm ci
    } else {
      npm install
    }
    if ($LASTEXITCODE -ne 0) {
      throw "$label dependency installation failed"
    }
  } finally {
    Pop-Location
  }
}

Write-Host 'Forge setup program' -ForegroundColor Green
Write-Host "Project directory: $root"

if (-not (Test-CommandAvailable 'node') -or -not (Test-CommandAvailable 'npm')) {
  Write-Host "`nNode.js or npm was not found." -ForegroundColor Yellow
  Write-Host 'Please install Node.js LTS from: https://nodejs.org/en/download'

  if (Test-CommandAvailable 'winget') {
    $answer = Read-Host 'Try to install Node.js LTS automatically with winget? (Y/N)'
    if ($answer -match '^[Yy]$') {
      winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
      Refresh-Path
    }
  }

  if (-not (Test-CommandAvailable 'node') -or -not (Test-CommandAvailable 'npm')) {
    Refresh-Path
  }
  if (-not (Test-CommandAvailable 'node') -or -not (Test-CommandAvailable 'npm')) {
    throw 'Node.js LTS is required. Close this window, open a new terminal, and run setup-forge.cmd again.'
  }
}

Write-Host "Node.js: $(node --version)"
Write-Host "npm: $(npm --version)"

Invoke-NpmInstall $root 'Root project'
Invoke-NpmInstall (Join-Path $root 'forge-client') 'Frontend'
Invoke-NpmInstall (Join-Path $root 'forge-server') 'Backend'

$envFile = Join-Path $root 'forge-server/.env'
$envExample = Join-Path $root 'forge-server/.env.example'
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Host 'Created forge-server/.env from .env.example.' -ForegroundColor Yellow
}

function Get-EnvFileValue([string]$key, [string]$fallback) {
  if (-not (Test-Path $envFile)) { return $fallback }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if ($line) { return ($line -replace "^$key=", '').Trim() }
  return $fallback
}

function Set-EnvFileValue([string]$key, [string]$value) {
  $lines = @()
  if (Test-Path $envFile) { $lines = @(Get-Content $envFile) }
  $found = $false
  $lines = @($lines | ForEach-Object {
    if ($_ -match "^$key=") {
      $found = $true
      "$key=$value"
    } else {
      $_
    }
  })
  if (-not $found) { $lines += "$key=$value" }
  Set-Content -Path $envFile -Value $lines -Encoding UTF8
}

Refresh-Path
$mysqlExe = Find-MySqlExecutable
$mysqlService = Get-Service -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'mysql|mariadb' -or $_.DisplayName -match 'mysql|mariadb' } |
  Select-Object -First 1

if ($mysqlExe -and $mysqlService) {
  Write-Host "`nMySQL or MariaDB installation detected." -ForegroundColor Green
  Write-Host "Service: $($mysqlService.DisplayName) [$($mysqlService.Status)]"
} else {
  Write-Host "`nMySQL or MariaDB installation was not detected." -ForegroundColor Yellow
  Write-Host 'Please install MySQL Community Server manually before using the Forge backend.' -ForegroundColor Yellow
  Write-Host 'Download: https://dev.mysql.com/downloads/mysql/' -ForegroundColor Cyan
}

Write-Host "`nSetup completed. Start Forge with: npm start" -ForegroundColor Green
