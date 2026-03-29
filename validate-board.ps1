param(
    [Parameter(Mandatory = $true)][string]$Board,
    [Parameter(Mandatory = $true)][string]$Unit,
    [string]$Port,
    [int]$Seconds = 4
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
        $arguments = @('project/scripts/run-stage3-validation.mjs', '--board', $Board, '--unit', $Unit, '--seconds', $Seconds)
        if ($PSBoundParameters.ContainsKey('Port')) { $arguments += @('--port', $Port) }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Stage 3 validation run failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
