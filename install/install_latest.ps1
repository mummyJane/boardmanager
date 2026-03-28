param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_stm32_tooling_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
