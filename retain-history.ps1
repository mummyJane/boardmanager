param(
    [int]$MaxRuns = 50,
    [int]$MaxObservedValues = 12,
    [int]$MaxRawSignatures = 20,
    [int]$MaxMetadataEntries = 50,
    [int]$MaxConflicts = 100,
    [switch]$DryRun
)

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
        $arguments = @(
            'project/scripts/prune-device-manager-history.mjs',
            '--max-runs', $MaxRuns,
            '--max-observed-values', $MaxObservedValues,
            '--max-raw-signatures', $MaxRawSignatures,
            '--max-metadata-entries', $MaxMetadataEntries,
            '--max-conflicts', $MaxConflicts
        )
        if ($DryRun.IsPresent) { $arguments += '--dry-run' }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager retention failed with exit code $LASTEXITCODE"
        }

        if (-not $DryRun.IsPresent) {
            & python project/scripts/sync-device-manager-sqlite.py
            if ($LASTEXITCODE -ne 0) {
                throw "Device-manager SQLite sync failed with exit code $LASTEXITCODE"
            }
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
