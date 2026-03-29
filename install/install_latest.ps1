param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone3_i2c_validation_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
