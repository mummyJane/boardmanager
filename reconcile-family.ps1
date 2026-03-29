param(
    [string]$Profile,
    [string]$Family,
    [Parameter(Mandatory = $true)][string]$Board,
    [string]$Note,
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
        $arguments = @('project/scripts/reconcile-family-profile.mjs', '--board', $Board)
        if ($PSBoundParameters.ContainsKey('Profile')) { $arguments += @('--profile', $Profile) }
        if ($PSBoundParameters.ContainsKey('Family')) { $arguments += @('--family', $Family) }
        if ($PSBoundParameters.ContainsKey('Note')) { $arguments += @('--note', $Note) }
        if ($DryRun.IsPresent) { $arguments += '--dry-run' }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Family profile reconciliation failed with exit code $LASTEXITCODE"
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
