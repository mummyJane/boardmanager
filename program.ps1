param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [Parameter(Mandatory = $true)]
    [string]$Unit,
    [ValidateRange(30, 3600)]
    [int]$ProgramTimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\project\scripts\common.ps1"

function Invoke-Stage3JobCommand {
    param(
        [hashtable]$Paths,
        [string[]]$Arguments
    )

    Push-Location $Paths.RepoRoot
    try {
        $output = & node @Arguments | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw "Stage 3 job command failed with exit code $LASTEXITCODE"
        }
        return $output
    }
    finally {
        Pop-Location
    }
}

function Write-ProgramLogLine {
    param(
        [string]$LogPath,
        [string]$Message
    )

    $timestamp = (Get-Date).ToString('o')
    Add-Content -Path $LogPath -Value "[$timestamp] $Message"
}

function Invoke-LoggedProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$LogPath,
        [int]$TimeoutSeconds,
        [string]$StepName
    )

    $stdoutPath = Join-Path ([System.IO.Path]::GetDirectoryName($LogPath)) ([System.IO.Path]::GetFileNameWithoutExtension($LogPath) + '.stdout.tmp')
    $stderrPath = Join-Path ([System.IO.Path]::GetDirectoryName($LogPath)) ([System.IO.Path]::GetFileNameWithoutExtension($LogPath) + '.stderr.tmp')

    if (Test-Path $stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force }
    if (Test-Path $stderrPath) { Remove-Item -LiteralPath $stderrPath -Force }

    try {
        $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $finished = $process.WaitForExit($TimeoutSeconds * 1000)

        if (-not $finished) {
            Write-ProgramLogLine -LogPath $LogPath -Message "$StepName timed out after $TimeoutSeconds seconds"
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
            catch {
            }
            throw "$StepName timed out after $TimeoutSeconds seconds"
        }

        if (Test-Path $stdoutPath) {
            foreach ($line in (Get-Content $stdoutPath)) {
                Write-ProgramLogLine -LogPath $LogPath -Message $line
            }
        }

        if (Test-Path $stderrPath) {
            foreach ($line in (Get-Content $stderrPath)) {
                Write-ProgramLogLine -LogPath $LogPath -Message "[stderr] $line"
            }
        }

        return $process.ExitCode
    }
    finally {
        if (Test-Path $stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force }
        if (Test-Path $stderrPath) { Remove-Item -LiteralPath $stderrPath -Force }
    }
}

function Get-ProgramArtifacts {
    param(
        [string]$Platform,
        [string]$BuildDir
    )

    $artifacts = @()
    if (Test-Path $BuildDir) {
        $artifacts += [ordered]@{ kind = 'build-dir'; path = $BuildDir }
    }

    if ($Platform -eq 'esp32') {
        $flashArgsPath = Join-Path $BuildDir 'flasher_args.json'
        if (Test-Path $flashArgsPath) {
            $artifacts += [ordered]@{ kind = 'flash-args'; path = $flashArgsPath }
        }
    }

    return @($artifacts)
}

function Write-ProgramReport {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$LogPath,
        [string]$BuildDir,
        [string]$ProgramPort,
        [int]$ExitCode,
        [bool]$Pass,
        [string]$Summary,
        [bool]$IncludeArtifacts = $true
    )

    $reportsRoot = Join-Path $Paths.ProjectRoot 'job-manager\reports'
    if (-not (Test-Path $reportsRoot)) {
        New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null
    }

    [object[]]$artifacts = if ($IncludeArtifacts) { Get-ProgramArtifacts -Platform $Job.request.platform -BuildDir $BuildDir } else { ,([ordered]@{ kind = 'build-dir'; path = $BuildDir }) }
    [object[]]$logs = ,([ordered]@{ kind = 'program-log'; path = $LogPath })
    $reportPath = Join-Path $reportsRoot ("program-{0}.json" -f $Job.jobId)

    $report = [ordered]@{
        reportKind = 'program'
        generatedAt = (Get-Date).ToString('o')
        reportPath = $reportPath
        jobId = $Job.jobId
        request = $Job.request
        resolution = $Job.resolution
        program = [ordered]@{
            platform = $Job.request.platform
            boardId = $Job.resolution.matchedBoardId
            projectId = $Job.resolution.matchedProjectId
            stableUnitId = $Job.resolution.matchedUnitId
            transportKind = $Job.resolution.resolvedTransportKind
            transportPort = $ProgramPort
            buildDir = $BuildDir
        }
        logs = $logs
        artifacts = $artifacts
        result = [ordered]@{
            summary = $Summary
            exitCode = $ExitCode
            pass = $Pass
        }
    }

    $report | ConvertTo-Json -Depth 10 | Set-Content $reportPath
    return $reportPath
}

$snapshot = Save-BoardManagerEnv
$paths = Get-BoardManagerPaths
Initialize-BoardManagerDirectories -Paths $paths
Initialize-BoardManagerProcessEnv -Paths $paths

$job = $null
$jobId = $null
$logPath = $null
$reportPath = $null
$summary = $null
$exitCode = 1

try {
    Assert-Command node
    Invoke-DefinitionsValidator -Paths $paths

    $createResult = Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'create', '--action', 'program', '--app', $App, '--board', $Board, '--platform', $Platform, '--unit', $Unit, '--reason', 'program.ps1') | ConvertFrom-Json
    $job = $createResult.job
    $jobId = $job.jobId

    $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
    if (-not (Test-Path $logsRoot)) {
        New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
    }
    $logPath = Join-Path $logsRoot ("program-{0}.log" -f $jobId)
    Set-Content $logPath ''

    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'running') | Out-Null

    $resolvedBoard = if ($job.resolution.matchedBoardId) { $job.resolution.matchedBoardId } else { $Board }
    $resolvedProjectId = if ($job.resolution.matchedProjectId) { $job.resolution.matchedProjectId } else { $App }
    $resolvedPort = if ($job.resolution.resolvedTransportPort) { $job.resolution.resolvedTransportPort } else { $Unit }
    $resolvedAppRoot = if ($job.resolution.resolvedAppRoot) { Join-Path $paths.ProjectRoot $job.resolution.resolvedAppRoot } else { Join-Path $paths.ProjectRoot "apps\$App" }
    $buildDir = Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $resolvedProjectId)

    Write-ProgramLogLine -LogPath $logPath -Message "Starting program job $jobId for project $resolvedProjectId on board $resolvedBoard"
    Write-ProgramLogLine -LogPath $logPath -Message "Resolved unit: $($job.resolution.matchedUnitId)"
    Write-ProgramLogLine -LogPath $logPath -Message "Resolved transport: $($job.resolution.resolvedTransportKind)"
    Write-ProgramLogLine -LogPath $logPath -Message "Resolved port: $resolvedPort"
    Write-ProgramLogLine -LogPath $logPath -Message "Resolved build directory: $buildDir"
    Write-ProgramLogLine -LogPath $logPath -Message "Program timeout: $ProgramTimeoutSeconds seconds"

    if ($Platform -eq 'esp32') {
        Initialize-EspIdfEnv -Paths $paths

        if (-not (Test-Path $resolvedAppRoot)) {
            throw "Program app root '$resolvedAppRoot' was not found"
        }

        if (-not (Test-Path $buildDir)) {
            throw "Build directory '$buildDir' was not found. Run build.ps1 for project '$resolvedProjectId' first."
        }

        Write-ProgramLogLine -LogPath $logPath -Message "Running idf.py flash for ESP-IDF target"
        $exitCode = Invoke-LoggedProcess -FilePath 'idf.py' -ArgumentList @('-B', $buildDir, '-D', "BOARD_MANAGER_BOARD=$resolvedBoard", '-p', $resolvedPort, 'flash') -WorkingDirectory $resolvedAppRoot -LogPath $logPath -TimeoutSeconds $ProgramTimeoutSeconds -StepName 'idf.py flash'
        Write-ProgramLogLine -LogPath $logPath -Message "idf.py flash exit code: $exitCode"

        if ($exitCode -ne 0) {
            throw "idf.py flash failed with exit code $exitCode"
        }

        $summary = "ESP32 program complete for $resolvedBoard on $resolvedPort"
        Write-ProgramLogLine -LogPath $logPath -Message $summary
        Write-Host $summary
    }
    else {
        throw "STM32 program flow is scaffolded but not implemented yet. Target unit was '$resolvedPort'."
    }

    $reportPath = Write-ProgramReport -Paths $paths -Job $job -LogPath $logPath -BuildDir $buildDir -ProgramPort $resolvedPort -ExitCode $exitCode -Pass $true -Summary $summary -IncludeArtifacts $true
    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'succeeded', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'true', '--result-json', $reportPath) | Out-Null
}
catch {
    $failure = $_.Exception.Message
    if (-not $summary) {
        $summary = $failure
    }

    if ($job -and $jobId) {
        if (-not $logPath) {
            $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
            if (-not (Test-Path $logsRoot)) {
                New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
            }
            $logPath = Join-Path $logsRoot ("program-{0}.log" -f $jobId)
            Set-Content $logPath ''
        }

        Write-ProgramLogLine -LogPath $logPath -Message "Program failed: $failure"

        if (-not $reportPath) {
            $resolvedPort = if ($job.resolution.resolvedTransportPort) { $job.resolution.resolvedTransportPort } else { $Unit }
            $buildDir = if ($job.resolution.matchedProjectId) { Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $job.resolution.matchedProjectId) } else { Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $App) }
            $reportPath = Write-ProgramReport -Paths $paths -Job $job -LogPath $logPath -BuildDir $buildDir -ProgramPort $resolvedPort -ExitCode $exitCode -Pass $false -Summary $summary -IncludeArtifacts $false
        }

        Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'failed', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'false', '--result-json', $reportPath) | Out-Null
    }
    throw
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
