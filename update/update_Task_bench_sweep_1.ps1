param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_milestone3_validation_orchestration_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot