param(
    [Parameter(Mandatory = $true)][string]$Unit,
    [string]$Board,
    [string]$Family,
    [string]$Note,
    [switch]$Clear
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
        $arguments = @('project/scripts/set-unit-override.mjs', '--unit', $Unit)
        if ($PSBoundParameters.ContainsKey('Board')) { $arguments += @('--board', $Board) }
        if ($PSBoundParameters.ContainsKey('Family')) { $arguments += @('--family', $Family) }
        if ($PSBoundParameters.ContainsKey('Note')) { $arguments += @('--note', $Note) }
        if ($Clear.IsPresent) { $arguments += '--clear' }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Unit override update failed with exit code $LASTEXITCODE"
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
