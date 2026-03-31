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
        & node project/tests/run-device-manager-tests.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Board Manager Node tests failed with exit code $LASTEXITCODE"
        }

        & python project/tests/stage4-read-api.test.py
        if ($LASTEXITCODE -ne 0) {
            throw "Board Manager Python tests failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
