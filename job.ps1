param(
    [Parameter(Mandatory = $true)][ValidateSet('create', 'list', 'update')][string]$Command,
    [ValidateSet('validate', 'build', 'program', 'run', 'debug')][string]$Action,
    [ValidateSet('queued', 'running', 'succeeded', 'failed', 'canceled')][string]$Status,
    [ValidateSet('text', 'json')][string]$Format = 'text',
    [string]$Job,
    [string]$Board,
    [string]$Unit,
    [string]$Target,
    [string]$FirmwareTarget,
    [string]$App,
    [string]$Platform,
    [string]$Transport,
    [string]$Reason,
    [string]$Summary
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
        $arguments = @('project/scripts/manage-stage3-jobs.mjs', $Command)
        if ($PSBoundParameters.ContainsKey('Action')) { $arguments += @('--action', $Action) }
        if ($PSBoundParameters.ContainsKey('Status')) { $arguments += @('--status', $Status) }
        if ($PSBoundParameters.ContainsKey('Job')) { $arguments += @('--job', $Job) }
        if ($PSBoundParameters.ContainsKey('Board')) { $arguments += @('--board', $Board) }
        if ($PSBoundParameters.ContainsKey('Unit')) { $arguments += @('--unit', $Unit) }
        if ($PSBoundParameters.ContainsKey('Target')) { $arguments += @('--target', $Target) }
        if ($PSBoundParameters.ContainsKey('FirmwareTarget')) { $arguments += @('--firmware-target', $FirmwareTarget) }
        if ($PSBoundParameters.ContainsKey('App')) { $arguments += @('--app', $App) }
        if ($PSBoundParameters.ContainsKey('Platform')) { $arguments += @('--platform', $Platform) }
        if ($PSBoundParameters.ContainsKey('Transport')) { $arguments += @('--transport', $Transport) }
        if ($PSBoundParameters.ContainsKey('Reason')) { $arguments += @('--reason', $Reason) }
        if ($PSBoundParameters.ContainsKey('Summary')) { $arguments += @('--summary', $Summary) }
        if ($PSBoundParameters.ContainsKey('Format')) { $arguments += @('--format', $Format) }

        & node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Stage 3 job command failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
