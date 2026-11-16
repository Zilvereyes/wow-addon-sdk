#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [string]$AddOnsPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $Root
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ er ikke installeret.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm blev ikke fundet.' }
    $NodeMajor = & node -p 'process.versions.node.split(".")[0]'
    if ($LASTEXITCODE -ne 0 -or [int]$NodeMajor -lt 22) { throw 'Node.js 22+ er påkrævet.' }
    if (-not $SkipInstall) {
        & npm ci --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci fejlede (exit $LASTEXITCODE)" }
    }
    & npm run check:all
    if ($LASTEXITCODE -ne 0) { throw "SDK-verifikation fejlede (exit $LASTEXITCODE)" }
    & npm run api:extractor
    if ($LASTEXITCODE -ne 0) { throw "API Extractor fejlede (exit $LASTEXITCODE)" }
    & npm run check:packages
    if ($LASTEXITCODE -ne 0) { throw "Pakkekontrol fejlede (exit $LASTEXITCODE)" }
    if ($AddOnsPath) {
        & node (Join-Path $PSScriptRoot 'inspect-addon-corpus.mjs') $AddOnsPath
        if ($LASTEXITCODE -ne 0) { throw "Lokal TOC-corpus-test fejlede eller er ufuldstændig (exit $LASTEXITCODE)" }
    }
    Write-Host 'WoW AddOn SDK: alle anmodede kontroller bestod.' -ForegroundColor Green
}
finally { Pop-Location }
