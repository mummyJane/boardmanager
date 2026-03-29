param(
    [Parameter(Mandatory = $true)][string]$Unit,
    [string]$Label,
    [string]$Note,
    [string]$Owner,
    [string]$Location,
    [string]$Purpose,
    [switch]$ClearNotes
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
        $arguments = @('project/scripts/set-unit-annotation.mjs', '--unit', $Unit)
        if ($PSBoundParameters.ContainsKey('Label')) { $arguments += @('--label', $Label) }
        if ($PSBoundParameters.ContainsKey('Note')) { $arguments += @('--note', $Note) }
        if ($PSBoundParameters.ContainsKey('Owner')) { $arguments += @('--owner', $Owner) }
        if ($PSBoundParameters.ContainsKey('Location')) { $arguments += @('--location', $Location) }
        if ($PSBoundParameters.ContainsKey('Purpose')) { $arguments += @('--purpose', $Purpose) }
        if ($ClearNotes.IsPresent) { $arguments += '--clear-notes' }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Unit annotation update failed with exit code $LASTEXITCODE"
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
