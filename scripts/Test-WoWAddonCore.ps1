#requires -Version 7.0
[CmdletBinding()]
param([switch]$SkipInstall)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $Root
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ er ikke installeret.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm blev ikke fundet.' }
    if (-not $SkipInstall) {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm install fejlede (exit $LASTEXITCODE)" }
    }
    & npm run check:all
    if ($LASTEXITCODE -ne 0) { throw "SDK-verifikation fejlede (exit $LASTEXITCODE)" }
    Write-Host 'WoW AddOn SDK v0.2.0: alle kontroller bestod.' -ForegroundColor Green
}
finally { Pop-Location }
