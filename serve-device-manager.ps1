param(
    [string]$BindHost = '127.0.0.1',
    [int]$Port = 8787
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
        & node 'project/scripts/device-manager-service.mjs' '--host' $BindHost '--port' $Port
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager service failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
