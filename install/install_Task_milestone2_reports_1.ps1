param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone2_diff_view_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
