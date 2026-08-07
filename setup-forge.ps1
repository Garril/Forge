$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-CommandAvailable([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Invoke-NpmInstall([string]$directory, [string]$label) {
  Write-Host "`n[$label] 正在安装 Node.js 依赖..." -ForegroundColor Cyan
  Push-Location $directory
  try {
    if (Test-Path 'package-lock.json') { npm ci } else { npm install }
    if ($LASTEXITCODE -ne 0) { throw "$label 依赖安装失败" }
  } finally { Pop-Location }
}

Write-Host 'Forge 初始化程序' -ForegroundColor Green
Write-Host "项目目录：$root"

if (-not (Test-CommandAvailable 'node') -or -not (Test-CommandAvailable 'npm')) {
  Write-Host "`n未检测到 Node.js/npm。请先安装 Node.js LTS：" -ForegroundColor Yellow
  Write-Host 'https://nodejs.org/en/download'
  if (Test-CommandAvailable 'winget') {
    $answer = Read-Host '检测到 winget，是否尝试自动安装 Node.js LTS？(Y/N)'
    if ($answer -match '^[Yy]$') {
      winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    }
  }
  if (-not (Test-CommandAvailable 'node') -or -not (Test-CommandAvailable 'npm')) {
    throw '请安装 Node.js LTS 后重新运行 setup-forge.ps1'
  }
}
Write-Host "Node.js: $(node --version)"
Write-Host "npm: $(npm --version)"

Invoke-NpmInstall $root '根项目'
Invoke-NpmInstall (Join-Path $root 'forge-client') '前端'
Invoke-NpmInstall (Join-Path $root 'forge-server') '后端'

$mysqlFound = Test-CommandAvailable 'mysql'
$mysqlService = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'mysql|mariadb' -or $_.DisplayName -match 'mysql|mariadb' } | Select-Object -First 1
if ($mysqlFound -or $mysqlService) {
  Write-Host "`n已检测到 MySQL/MariaDB。" -ForegroundColor Green
  if ($mysqlService) { Write-Host "服务：$($mysqlService.DisplayName) [$($mysqlService.Status)]" }
} else {
  Write-Host "`n未检测到 MySQL/MariaDB。Forge 后端需要本地 MySQL 数据库。" -ForegroundColor Yellow
  Write-Host '请安装 MySQL Community Server：https://dev.mysql.com/downloads/mysql/'
  if (Test-CommandAvailable 'winget') {
    $answer = Read-Host '是否尝试通过 winget 安装 MySQL Server？(Y/N)'
    if ($answer -match '^[Yy]$') {
      winget install MySQL.MySQL.Server --accept-source-agreements --accept-package-agreements
    }
  }
  Write-Host '安装完成后，请配置 forge-server/.env 中的 DB_HOST、DB_USER、DB_PASSWORD、DB_NAME。' -ForegroundColor Yellow
  if (-not (Test-CommandAvailable 'mysql')) { Write-Host 'MySQL 安装后请重新运行本脚本，以确认命令行工具已加入 PATH。' -ForegroundColor Yellow }
}

$envFile = Join-Path $root 'forge-server/.env'
$envExample = Join-Path $root 'forge-server/.env.example'
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Host "已根据 .env.example 创建 forge-server/.env，请检查数据库配置。" -ForegroundColor Yellow
}

Write-Host "`n初始化完成。启动命令：npm start" -ForegroundColor Green
