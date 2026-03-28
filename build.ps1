param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [string]$BuildType = 'Debug'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command node
    Invoke-DefinitionsValidator -Paths $paths
    Invoke-BoardGenerator -Paths $paths

    if ($Platform -eq 'esp32') {
        Initialize-EspIdfEnv -Paths $paths

        $appRoot = Join-Path $paths.ProjectRoot "apps\$App"
        $buildDir = Join-Path $paths.BuildRoot "$Platform-$App"
        if (-not (Test-Path $appRoot)) {
            throw "ESP32 app '$App' was not found at $appRoot"
        }

        Push-Location $appRoot
        try {
            & idf.py -B $buildDir -D CMAKE_BUILD_TYPE=$BuildType build
            if ($LASTEXITCODE -ne 0) {
                throw "idf.py build failed with exit code $LASTEXITCODE"
            }
        }
        finally {
            Pop-Location
        }

        Write-Host "ESP32 build completed for $Board at $buildDir"
        return
    }

    $buildDir = Join-Path $paths.BuildRoot "$Platform-$Board"
    throw "STM32 build flow is scaffolded but not implemented yet. Local tool root: $($paths.Stm32CubeRoot). Planned build dir: $buildDir"
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
