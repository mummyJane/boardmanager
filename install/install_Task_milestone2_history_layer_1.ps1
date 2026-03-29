param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Push-Location $ProjectRoot
try {
    & .\install-tools.ps1 -Platform all
    & .\validate.ps1
    & .\discover.ps1
    & .\discover.ps1
}
finally {
    Pop-Location
}
