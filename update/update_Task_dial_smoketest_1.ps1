param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Push-Location $ProjectRoot
try {
    & .\install-tools.ps1 -Platform all
    & .\validate.ps1
    & .\build.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1
    & .\build.ps1 -Platform stm32 -App stm32_nucleo_io_demo -Board stm32_nucleo_io_v1
}
finally {
    Pop-Location
}
