param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Assert-Command node
    Invoke-DefinitionsValidator -Paths $paths
    Invoke-DeviceManagerValidator -Paths $paths
    Invoke-JobManagerValidator -Paths $paths
    Invoke-ValidationContractsValidator -Paths $paths
    Invoke-ValidationReportsValidator -Paths $paths
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
