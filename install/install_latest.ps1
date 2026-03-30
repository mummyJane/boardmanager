param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_milestone3_build_jobs_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot

