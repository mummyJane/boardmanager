param()

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
