param(
    [Parameter(Mandatory = $true)]
    [string]$Port,
    [ValidateRange(5, 300)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\..\..\..\scripts\common.ps1"

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

try {
    Initialize-EspIdfEnv -Paths $paths

    $pythonExe = Join-Path $paths.ToolRoot 'espressif\python_env\idf5.5_py3.13_env\Scripts\python.exe'
    $espefuse = Join-Path $paths.EspIdfRoot 'esp-idf\components\esptool_py\esptool\espefuse.py'
    $logRoot = Join-Path $paths.BuildRoot 'module-tests\esp32_s3\read_fuse_data'
    $stdoutPath = Join-Path $logRoot 'stdout.log'
    $stderrPath = Join-Path $logRoot 'stderr.log'

    if (-not (Test-Path $logRoot)) {
        New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
    }

    if (-not (Test-Path $pythonExe)) {
        throw "Python executable not found at $pythonExe"
    }
    if (-not (Test-Path $espefuse)) {
        throw "espefuse.py not found at $espefuse"
    }

    if (Test-Path $stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force }
    if (Test-Path $stderrPath) { Remove-Item -LiteralPath $stderrPath -Force }

    $process = $null
    try {
        $process = Start-Process -FilePath $pythonExe `
            -ArgumentList @($espefuse, '--port', $Port, 'summary') `
            -NoNewWindow `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            throw "eFuse read timed out after $TimeoutSeconds seconds"
        }

        if ($process.ExitCode -ne 0) {
            $stderr = if (Test-Path $stderrPath) { (Get-Content -Path $stderrPath -Raw) } else { '' }
            throw "eFuse read failed with exit code $($process.ExitCode): $stderr"
        }

        if (Test-Path $stdoutPath) {
            Get-Content -Path $stdoutPath
        }
    }
    finally {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
