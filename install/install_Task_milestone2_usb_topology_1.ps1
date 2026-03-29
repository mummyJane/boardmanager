param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone2_stm32_fingerprint_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
