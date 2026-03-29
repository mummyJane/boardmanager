param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'update_Task_milestone2_firmware_identity_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot
