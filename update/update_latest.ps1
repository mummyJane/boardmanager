param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_platform_impl_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
