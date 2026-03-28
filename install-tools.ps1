param(
    [ValidateSet('esp32', 'stm32', 'all')]
    [string]$Platform = 'all',
    [string]$EspIdfVersion = 'v5.5.2',
    [string]$Stm32CubeF4Version = 'v1.28.3',
    [string]$ArmGnuVersion = '14.2.rel1'
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command git
    Assert-Command python

    if ($Platform -in @('esp32', 'all')) {
        $espIdfRepo = Join-Path $paths.EspIdfRoot 'esp-idf'
        if (-not (Test-Path $espIdfRepo)) {
            Push-Location $paths.EspIdfRoot
            try {
                git clone --branch $EspIdfVersion --recursive https://github.com/espressif/esp-idf.git esp-idf
            }
            finally {
                Pop-Location
            }
        }

        [Environment]::SetEnvironmentVariable('IDF_TOOLS_PATH', (Join-Path $paths.ToolRoot 'espressif'), 'Process')
        Push-Location $espIdfRepo
        try {
            & .\install.bat esp32s3
        }
        finally {
            Pop-Location
        }

        Write-Host "ESP-IDF installed locally at $espIdfRepo"
    }

    if ($Platform -in @('stm32', 'all')) {
        $sdkRoot = $paths.Stm32CubeSdkRoot
        if (-not (Test-Path $sdkRoot)) {
            Push-Location $paths.Stm32CubeRoot
            try {
                git clone --depth 1 --branch $Stm32CubeF4Version https://github.com/STMicroelectronics/STM32CubeF4.git STM32CubeF4
            }
            finally {
                Pop-Location
            }
        }

        $halDriverRoot = Join-Path $sdkRoot ''Drivers\STM32F4xx_HAL_Driver''
        $cmsisDeviceRoot = Join-Path $sdkRoot ''Drivers\CMSIS\Device\ST\STM32F4xx''
        if (-not (Test-Path $halDriverRoot) -or -not (Test-Path $cmsisDeviceRoot)) {
            git -C $sdkRoot submodule update --init --depth 1 Drivers/STM32F4xx_HAL_Driver Drivers/CMSIS/Device/ST/STM32F4xx
        }

        $toolchainRoot = $paths.ArmGnuToolchainRoot
        $fallbackToolchainRoot = $paths.ToolchainRoot
        if (-not (Test-Path (Join-Path $toolchainRoot 'bin\arm-none-eabi-gcc.exe')) -and -not (Test-Path (Join-Path $fallbackToolchainRoot 'bin\arm-none-eabi-gcc.exe'))) {
            $archiveName = "arm-gnu-toolchain-$ArmGnuVersion-mingw-w64-x86_64-arm-none-eabi.zip"
            $archivePath = Join-Path $paths.DownloadsRoot $archiveName
            $downloadUrl = "https://developer.arm.com/-/media/Files/downloads/gnu/$ArmGnuVersion/binrel/$archiveName"

            if (-not (Test-Path $archivePath)) {
                Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
            }

            if (-not (Test-Path $toolchainRoot)) {
                New-Item -ItemType Directory -Force -Path $toolchainRoot | Out-Null
            }

            Expand-Archive -LiteralPath $archivePath -DestinationPath $toolchainRoot -Force
        }

        Write-Host "STM32CubeF4 SDK installed locally at $sdkRoot"
        Write-Host "Arm GNU toolchain available locally at $($paths.ArmGnuToolchainRoot)"
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}


