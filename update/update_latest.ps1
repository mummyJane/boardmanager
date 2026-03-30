param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_milestone4_module_validation_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
