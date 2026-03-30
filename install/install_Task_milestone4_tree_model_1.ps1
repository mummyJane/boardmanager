param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone4_catalog_seed_inputs_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot