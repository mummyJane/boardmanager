param()

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
        & node project/scripts/generate-validation-contracts.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Validation-contract generation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
