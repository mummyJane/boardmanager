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

    Assert-Command cmake
    Assert-Command ninja
    Initialize-Stm32Env -Paths $paths

    $appRoot = Join-Path $paths.ProjectRoot "apps\$App"
    $buildDir = Join-Path $paths.BuildRoot "$Platform-$App"
    $toolchainFile = Join-Path $paths.ProjectRoot 'cmake\toolchains\arm-none-eabi.cmake'

    if (-not (Test-Path $appRoot)) {
        throw "STM32 app '$App' was not found at $appRoot"
    }

    & cmake -S $appRoot -B $buildDir -G Ninja -D CMAKE_BUILD_TYPE=$BuildType -D CMAKE_TOOLCHAIN_FILE=$toolchainFile -D BOARD_MANAGER_PROJECT_ROOT=$($paths.ProjectRoot) -D BOARD_MANAGER_BOARD=$Board -D STM32CUBE_F4_ROOT=$($paths.Stm32CubeSdkRoot) -D ARM_GNU_TOOLCHAIN_ROOT=$($paths.ArmGnuToolchainRoot)
    if ($LASTEXITCODE -ne 0) {
        throw "STM32 CMake configure failed with exit code $LASTEXITCODE"
    }

    & cmake --build $buildDir
    if ($LASTEXITCODE -ne 0) {
        throw "STM32 build failed with exit code $LASTEXITCODE"
    }

    Write-Host "STM32 build completed for $Board at $buildDir"
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
