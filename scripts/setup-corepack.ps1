param(
  [string]$CorepackHome,
  [switch]$Persist
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$packageJsonPath = Join-Path $repoRoot "package.json"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22 must be installed before running this script."
}

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw "corepack must be available from the active Node.js installation."
}

$packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
$packageManager = [string]$packageJson.packageManager

if ($packageManager -notmatch '^pnpm@\S+$') {
  throw "package.json must declare packageManager as pnpm@<version>; got '$packageManager'."
}

if ([string]::IsNullOrWhiteSpace($CorepackHome)) {
  if (-not [string]::IsNullOrWhiteSpace($env:COREPACK_HOME)) {
    $CorepackHome = $env:COREPACK_HOME
  } elseif (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $CorepackHome = Join-Path $env:LOCALAPPDATA "Corepack"
  } else {
    $CorepackHome = Join-Path $HOME "AppData\Local\Corepack"
  }
}

$env:COREPACK_HOME = $CorepackHome
New-Item -ItemType Directory -Force -Path $env:COREPACK_HOME | Out-Null

& corepack enable
& corepack prepare $packageManager --activate
& pnpm --version

if ($Persist) {
  [Environment]::SetEnvironmentVariable("COREPACK_HOME", $env:COREPACK_HOME, "User")
  Write-Host "Persisted COREPACK_HOME for the Windows user environment: $env:COREPACK_HOME"
  Write-Host "Open a new PowerShell window for the persisted value to be inherited."
} else {
  Write-Host "COREPACK_HOME was set for this process only: $env:COREPACK_HOME"
  Write-Host "To persist it for future PowerShell windows, rerun with -Persist."
}
