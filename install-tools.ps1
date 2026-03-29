param(
    [ValidateSet('esp32', 'stm32', 'all')]
    [string]$Platform = 'all',
    [string]$EspIdfVersion = 'v5.5.2',
    [string]$Stm32CubeF4Version = 'v1.28.3',
    [string]$Stm32CubeF0Version = 'v1.11.4',
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
        $sdkDefinitions = @(
            @{ Name = 'STM32CubeF4'; Root = $paths.Stm32CubeSdkRoot; Version = $Stm32CubeF4Version; HalPath = 'Drivers\STM32F4xx_HAL_Driver'; CmsisPath = 'Drivers\CMSIS\Device\ST\STM32F4xx'; Submodules = @('Drivers/STM32F4xx_HAL_Driver', 'Drivers/CMSIS/Device/ST/STM32F4xx') },
            @{ Name = 'STM32CubeF0'; Root = $paths.Stm32CubeF0SdkRoot; Version = $Stm32CubeF0Version; HalPath = 'Drivers\STM32F0xx_HAL_Driver'; CmsisPath = 'Drivers\CMSIS\Device\ST\STM32F0xx'; Submodules = @('Drivers/STM32F0xx_HAL_Driver', 'Drivers/CMSIS/Device/ST/STM32F0xx') }
        )

        foreach ($sdk in $sdkDefinitions) {
            if (-not (Test-Path $sdk.Root)) {
                Push-Location $paths.Stm32CubeRoot
                try {
                    git clone --depth 1 --branch $sdk.Version "https://github.com/STMicroelectronics/$($sdk.Name).git" $sdk.Name
                }
                finally {
                    Pop-Location
                }
            }

            $halDriverRoot = Join-Path $sdk.Root $sdk.HalPath
            $cmsisDeviceRoot = Join-Path $sdk.Root $sdk.CmsisPath
            if (-not (Test-Path $halDriverRoot) -or -not (Test-Path $cmsisDeviceRoot)) {
                & git -C $sdk.Root submodule update --init --depth 1 @($sdk.Submodules)
                if ($LASTEXITCODE -ne 0) {
                    throw "STM32Cube submodule update failed for $($sdk.Name)"
                }
            }

            Write-Host "$($sdk.Name) SDK installed locally at $($sdk.Root)"
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

        Write-Host "Arm GNU toolchain available locally at $($paths.ArmGnuToolchainRoot)"
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
