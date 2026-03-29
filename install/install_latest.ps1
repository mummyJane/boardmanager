param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$scriptPath = Join-Path $PSScriptRoot 'install_Task_bench_sweep_1.ps1'
& $scriptPath -ProjectRoot $ProjectRoot