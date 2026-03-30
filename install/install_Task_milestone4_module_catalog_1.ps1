param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone4_inventory_dashboard_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
