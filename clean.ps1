param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    $targets = @(
        (Join-Path $paths.BuildRoot "$Platform-$App"),
        (Join-Path $paths.BuildRoot "$Platform-$Board")
    ) | Select-Object -Unique

    foreach ($target in $targets) {
        if (Test-Path $target) {
            Remove-Item -Recurse -Force $target
            Write-Host "Removed $target"
        }
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
