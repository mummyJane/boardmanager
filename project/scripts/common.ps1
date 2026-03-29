function Save-BoardManagerEnv {
    $snapshot = @{}
    foreach ($name in @(
        'IDF_PATH',
        'IDF_TOOLS_PATH',
        'BOARDMANAGER_ROOT',
        'BOARDMANAGER_PROJECT_ROOT',
        'BOARDMANAGER_TOOL_ROOT',
        'BOARDMANAGER_BUILD_ROOT',
        'BOARDMANAGER_STM32_SDK_ROOT',
        'BOARDMANAGER_STM32_F0_SDK_ROOT',
        'BOARDMANAGER_ARM_GNU_TOOLCHAIN_ROOT',
        'PATH'
    )) {
        $snapshot[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    return $snapshot
}

function Restore-BoardManagerEnv {
    param([hashtable]$Snapshot)

    foreach ($entry in $Snapshot.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
}

function Get-BoardManagerPaths {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $projectRoot = Join-Path $repoRoot 'project'
    $toolRoot = Join-Path $projectRoot 'tools'
    $toolchainRoot = Join-Path $projectRoot 'toolchains'
    $espIdfRoot = Join-Path $toolchainRoot 'esp-idf'
    $stm32CubeRoot = Join-Path $toolchainRoot 'stm32cube'
    $stm32CubeSdkRoot = Join-Path $stm32CubeRoot 'STM32CubeF4'
    $stm32CubeF0SdkRoot = Join-Path $stm32CubeRoot 'STM32CubeF0'
    $dedicatedArmGnuToolchainRoot = Join-Path $toolchainRoot 'arm-gnu-toolchain'
    if (Test-Path (Join-Path $dedicatedArmGnuToolchainRoot 'bin\arm-none-eabi-gcc.exe')) {
        $armGnuToolchainRoot = $dedicatedArmGnuToolchainRoot
    }
    elseif (Test-Path (Join-Path $toolchainRoot 'bin\arm-none-eabi-gcc.exe')) {
        $armGnuToolchainRoot = $toolchainRoot
    }
    else {
        $armGnuToolchainRoot = $dedicatedArmGnuToolchainRoot
    }
    $downloadsRoot = Join-Path $projectRoot 'downloads'
    $buildRoot = Join-Path $projectRoot 'build'

    return @{
        RepoRoot = $repoRoot
        ProjectRoot = $projectRoot
        ToolRoot = $toolRoot
        ToolchainRoot = $toolchainRoot
        EspIdfRoot = $espIdfRoot
        Stm32CubeRoot = $stm32CubeRoot
        Stm32CubeSdkRoot = $stm32CubeSdkRoot
        Stm32CubeF0SdkRoot = $stm32CubeF0SdkRoot
        ArmGnuToolchainRoot = $armGnuToolchainRoot
        DownloadsRoot = $downloadsRoot
        BuildRoot = $buildRoot
    }
}

function Initialize-BoardManagerDirectories {
    param([hashtable]$Paths)

    foreach ($path in $Paths.Values) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Force -Path $path | Out-Null
        }
    }
}

function Initialize-BoardManagerProcessEnv {
    param([hashtable]$Paths)

    [Environment]::SetEnvironmentVariable('BOARDMANAGER_ROOT', $Paths.RepoRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_PROJECT_ROOT', $Paths.ProjectRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_TOOL_ROOT', $Paths.ToolRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_BUILD_ROOT', $Paths.BuildRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_STM32_SDK_ROOT', $Paths.Stm32CubeSdkRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_STM32_F0_SDK_ROOT', $Paths.Stm32CubeF0SdkRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_ARM_GNU_TOOLCHAIN_ROOT', $Paths.ArmGnuToolchainRoot, 'Process')
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Invoke-DefinitionsValidator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/validate-definitions.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Definition validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-BoardGenerator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/generate-board-artifacts.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Board artifact generation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-DeviceManagerValidator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/validate-device-manager-data.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Device-manager validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
function Initialize-EspIdfEnv {
    param([hashtable]$Paths)

    $idfPath = Join-Path $Paths.EspIdfRoot 'esp-idf'
    $exportScript = Join-Path $idfPath 'export.ps1'

    if (-not (Test-Path $idfPath)) {
        throw "ESP-IDF is not installed at $idfPath. Run .\install-tools.ps1 first."
    }

    if (-not (Test-Path $exportScript)) {
        throw "ESP-IDF export script not found at $exportScript."
    }

    [Environment]::SetEnvironmentVariable('IDF_PATH', $idfPath, 'Process')
    [Environment]::SetEnvironmentVariable('IDF_TOOLS_PATH', (Join-Path $Paths.ToolRoot 'espressif'), 'Process')
    . $exportScript
}

function Initialize-Stm32Env {
    param([hashtable]$Paths)

    $sdkRoot = $Paths.Stm32CubeSdkRoot
    $sdkF0Root = $Paths.Stm32CubeF0SdkRoot
    $toolchainRoot = $Paths.ArmGnuToolchainRoot
    $toolchainBin = Join-Path $toolchainRoot 'bin'

    if (-not (Test-Path $sdkRoot)) {
        throw "STM32Cube SDK is not installed at $sdkRoot. Run .\install-tools.ps1 -Platform stm32 first."
    }

    if (-not (Test-Path $toolchainBin)) {
        throw "Arm GNU toolchain is not installed at $toolchainRoot. Run .\install-tools.ps1 -Platform stm32 first."
    }

    $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'Process')
    if ([string]::IsNullOrWhiteSpace($currentPath)) {
        $newPath = $toolchainBin
    }
    else {
        $newPath = "$toolchainBin;$currentPath"
    }

    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'Process')
    [Environment]::SetEnvironmentVariable('STM32CUBE_F4_ROOT', $sdkRoot, 'Process')
    [Environment]::SetEnvironmentVariable('STM32CUBE_F0_ROOT', $sdkF0Root, 'Process')
}


function Invoke-JobManagerValidator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/validate-job-manager-data.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Job-manager validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-ValidationContractsValidator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/validate-validation-contracts.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Validation-contract validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-ValidationReportsValidator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        & node project/scripts/validate-validation-reports.mjs
        if ($LASTEXITCODE -ne 0) {
            throw "Validation-report validation failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
