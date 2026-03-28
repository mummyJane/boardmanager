param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Write-Host "Updating Board Manager workspace to bootstrap milestone from $ProjectRoot"

Push-Location $ProjectRoot
try {
    node project/scripts/generate-board-artifacts.mjs
    Write-Host "Artifacts refreshed."
}
finally {
    Pop-Location
}
