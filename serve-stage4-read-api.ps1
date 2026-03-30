param(
    [string]$BindHost = '127.0.0.1',
    [int]$Port = 8791
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command python
    Push-Location $paths.RepoRoot
    try {
        & python 'project/scripts/stage4-read-api.py' '--host' $BindHost '--port' $Port
        if ($LASTEXITCODE -ne 0) {
            throw "Stage 4 read API failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}