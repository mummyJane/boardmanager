function Save-BoardManagerEnv {
    $snapshot = @{}
    foreach ($name in @(
        'IDF_PATH',
        'IDF_TOOLS_PATH',
        'BOARDMANAGER_ROOT',
        'BOARDMANAGER_PROJECT_ROOT',
        'BOARDMANAGER_TOOL_ROOT',
        'BOARDMANAGER_BUILD_ROOT',
        'PATH'
    )) {
        $snapshot[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    return $snapshot
}

function Restore-BoardManagerEnv {
    param([hashtable]$Snapshot)

    foreach ($entry in $Snapshot.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
}

function Get-BoardManagerPaths {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $projectRoot = Join-Path $repoRoot 'project'
    $toolRoot = Join-Path $projectRoot 'tools'
    $toolchainRoot = Join-Path $projectRoot 'toolchains'
    $espIdfRoot = Join-Path $toolchainRoot 'esp-idf'
    $stm32CubeRoot = Join-Path $toolchainRoot 'stm32cube'
    $downloadsRoot = Join-Path $projectRoot 'downloads'
    $buildRoot = Join-Path $projectRoot 'build'

    return @{
        RepoRoot = $repoRoot
        ProjectRoot = $projectRoot
        ToolRoot = $toolRoot
        ToolchainRoot = $toolchainRoot
        EspIdfRoot = $espIdfRoot
        Stm32CubeRoot = $stm32CubeRoot
        DownloadsRoot = $downloadsRoot
        BuildRoot = $buildRoot
    }
}

function Initialize-BoardManagerDirectories {
    param([hashtable]$Paths)

    foreach ($path in $Paths.Values) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Force -Path $path | Out-Null
        }
    }
}

function Initialize-BoardManagerProcessEnv {
    param([hashtable]$Paths)

    [Environment]::SetEnvironmentVariable('BOARDMANAGER_ROOT', $Paths.RepoRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_PROJECT_ROOT', $Paths.ProjectRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_TOOL_ROOT', $Paths.ToolRoot, 'Process')
    [Environment]::SetEnvironmentVariable('BOARDMANAGER_BUILD_ROOT', $Paths.BuildRoot, 'Process')
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

function Invoke-BoardGenerator {
    param([hashtable]$Paths)

    Push-Location $Paths.RepoRoot
    try {
        node project/scripts/generate-board-artifacts.mjs
    }
    finally {
        Pop-Location
    }
}

function Initialize-EspIdfEnv {
    param([hashtable]$Paths)

    $idfPath = Join-Path $Paths.EspIdfRoot 'esp-idf'
    $exportScript = Join-Path $idfPath 'export.ps1'

    if (-not (Test-Path $idfPath)) {
        throw "ESP-IDF is not installed at $idfPath. Run .\\install-tools.ps1 first."
    }

    if (-not (Test-Path $exportScript)) {
        throw "ESP-IDF export script not found at $exportScript."
    }

    [Environment]::SetEnvironmentVariable('IDF_PATH', $idfPath, 'Process')
    [Environment]::SetEnvironmentVariable('IDF_TOOLS_PATH', (Join-Path $Paths.ToolRoot 'espressif'), 'Process')
    . $exportScript
}
