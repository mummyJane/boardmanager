param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command node
    Assert-Command python
    Push-Location $paths.RepoRoot
    try {
        & node project/scripts/discover-units.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Device discovery failed with exit code $LASTEXITCODE"
        }

        & node project/scripts/prune-device-manager-history.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager retention failed with exit code $LASTEXITCODE"
        }

        & python project/scripts/sync-device-manager-sqlite.py
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager SQLite sync failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
