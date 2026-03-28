param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [Parameter(Mandatory = $true)]
    [string]$Unit
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    if ($Platform -eq 'esp32') {
        Initialize-EspIdfEnv -Paths $paths

        $appRoot = Join-Path $paths.ProjectRoot "apps\$App"
        $buildDir = Join-Path $paths.BuildRoot "$Platform-$App"

        Push-Location $appRoot
        try {
            idf.py -B $buildDir -p $Unit flash
        }
        finally {
            Pop-Location
        }

        Write-Host "ESP32 program complete for $Board on unit $Unit"
        return
    }

    throw "STM32 program flow is scaffolded but not implemented yet. Target unit was '$Unit'."
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
