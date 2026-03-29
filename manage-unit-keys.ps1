param(
    [string]$Unit,
    [switch]$AllUnits,
    [switch]$Rotate,
    [switch]$RotateRoot,
    [switch]$EnsureRootOnly
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command python
    Assert-Command openssl
    Push-Location $paths.RepoRoot
    try {
        $arguments = @('project/scripts/manage-unit-keys.py')
        if ($PSBoundParameters.ContainsKey('Unit')) { $arguments += @('--unit', $Unit) }
        if ($AllUnits.IsPresent) { $arguments += '--all-units' }
        if ($Rotate.IsPresent) { $arguments += '--rotate' }
        if ($RotateRoot.IsPresent) { $arguments += '--rotate-root' }
        if ($EnsureRootOnly.IsPresent) { $arguments += '--ensure-root-only' }

        & python @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Unit-key management failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
