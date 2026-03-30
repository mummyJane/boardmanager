param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone4_board_catalog_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
