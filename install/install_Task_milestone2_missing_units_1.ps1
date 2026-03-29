param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone2_metadata_history_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
