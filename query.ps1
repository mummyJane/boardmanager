param(
    [ValidateSet('units', 'families', 'changes')][string]$View = 'units',
    [ValidateSet('text', 'json')][string]$Format = 'text',
    [int]$Limit = 20,
    [switch]$PresentOnly,
    [string]$Family,
    [string]$Unit
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
        $arguments = @('project/scripts/query-device-manager.mjs', '--view', $View, '--format', $Format, '--limit', $Limit)
        if ($PresentOnly.IsPresent) { $arguments += '--present-only' }
        if ($PSBoundParameters.ContainsKey('Family')) { $arguments += @('--family', $Family) }
        if ($PSBoundParameters.ContainsKey('Unit')) { $arguments += @('--unit', $Unit) }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager query failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
