param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Push-Location $ProjectRoot
try {
    & .\install-tools.ps1 -Platform all
}
finally {
    Pop-Location
}
