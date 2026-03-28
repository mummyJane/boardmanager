param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing Board Manager bootstrap milestone from $ProjectRoot"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required to generate board artifacts."
}

Push-Location $ProjectRoot
try {
    node project/scripts/generate-board-artifacts.mjs
    Write-Host "Bootstrap artifacts generated."
}
finally {
    Pop-Location
}
