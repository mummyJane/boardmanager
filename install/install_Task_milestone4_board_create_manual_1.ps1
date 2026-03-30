param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone4_board_create_from_unit_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
