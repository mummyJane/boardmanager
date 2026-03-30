param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_milestone4_tree_model_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot