param(
    [string]$OutputRoot = (Join-Path $PSScriptRoot 'project\device-manager\reports')
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command node
    Push-Location $paths.RepoRoot
    try {
        & node project/scripts/export-device-manager-reports.mjs --output-root $OutputRoot
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager report export failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
