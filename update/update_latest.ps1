param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_attached_board_coverage_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
