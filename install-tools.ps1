param(
    [ValidateSet('esp32', 'stm32', 'all')]
    [string]$Platform = 'all',
    [string]$EspIdfVersion = 'v5.5.2'
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
        $stm32Readme = Join-Path $paths.Stm32CubeRoot 'README.md'
        $readmeLines = @(
            '# STM32Cube Local Tooling',
            '',
            'Place the STM32CubeCLT installer or extracted toolchain in this folder.',
            '',
            'Planned local layout:',
            '- `project/toolchains/stm32cube/STM32CubeCLT/`',
            '- `project/toolchains/stm32cube/STLink/`',
            '',
            'Current status:',
            '- scaffolded only',
            '- no automated STM32 download performed yet',
            '- build/program wrappers will target this local folder when the tools are added'
        )
        Set-Content -Path $stm32Readme -Value $readmeLines
        Write-Host "STM32 local toolchain scaffold ready at $($paths.Stm32CubeRoot)"
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
