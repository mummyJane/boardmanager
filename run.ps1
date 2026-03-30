param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [Parameter(Mandatory = $true)]
    [string]$Unit,
    [ValidateRange(1, 3600)]
    [int]$RunTimeoutSeconds = 10,
    [ValidateRange(1200, 3000000)]
    [int]$BaudRate = 115200,
    [switch]$NoLiveOutput
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

function Write-RunLogLine {
    param(
        [string]$LogPath,
        [string]$Message
    )

    $timestamp = (Get-Date).ToString('o')
    Add-Content -Path $LogPath -Value "[$timestamp] $Message"
}

function Capture-SerialConsole {
    param(
        [string]$PortName,
        [int]$BaudRate,
        [int]$DurationSeconds,
        [string]$LogPath,
        [bool]$LiveOutput
    )

    $capturedLines = New-Object System.Collections.Generic.List[string]
    $serialPort = $null

    try {
        $serialPort = New-Object System.IO.Ports.SerialPort $PortName, $BaudRate, ([System.IO.Ports.Parity]::None), 8, ([System.IO.Ports.StopBits]::One)
        $serialPort.ReadTimeout = 200
        $serialPort.NewLine = "`n"
        $serialPort.DtrEnable = $false
        $serialPort.RtsEnable = $false
        $serialPort.Open()

        $deadline = (Get-Date).AddSeconds($DurationSeconds)
        while ((Get-Date) -lt $deadline) {
            try {
                $line = $serialPort.ReadLine()
                if ($null -eq $line) {
                    continue
                }

                $normalized = $line.TrimEnd("`r", "`n")
                $capturedLines.Add($normalized) | Out-Null
                Write-RunLogLine -LogPath $LogPath -Message $normalized
                if ($LiveOutput) {
                    Write-Host $normalized
                }
            }
            catch [System.TimeoutException] {
            }
        }
    }
    finally {
        if ($serialPort) {
            if ($serialPort.IsOpen) {
                $serialPort.Close()
            }
            $serialPort.Dispose()
        }
    }

    return $capturedLines
}

function Write-RunReport {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$LogPath,
        [string]$PortName,
        [int]$BaudRate,
        [int]$DurationSeconds,
        [System.Collections.Generic.List[string]]$CapturedLines,
        [int]$ExitCode,
        [bool]$Pass,
        [string]$Summary
    )

    $reportsRoot = Join-Path $Paths.ProjectRoot 'job-manager\reports'
    if (-not (Test-Path $reportsRoot)) {
        New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null
    }

    $reportPath = Join-Path $reportsRoot ("run-{0}.json" -f $Job.jobId)
    [object[]]$logs = ,([ordered]@{ kind = 'run-log'; path = $LogPath })
    [object[]]$artifacts = @()

    $report = [ordered]@{
        reportKind = 'run'
        generatedAt = (Get-Date).ToString('o')
        reportPath = $reportPath
        jobId = $Job.jobId
        request = $Job.request
        resolution = $Job.resolution
        run = [ordered]@{
            platform = $Job.request.platform
            boardId = $Job.resolution.matchedBoardId
            projectId = $Job.resolution.matchedProjectId
            stableUnitId = $Job.resolution.matchedUnitId
            transportKind = $Job.resolution.resolvedTransportKind
            transportPort = $PortName
            baudRate = $BaudRate
            durationSeconds = $DurationSeconds
        }
        logs = $logs
        artifacts = $artifacts
        output = [ordered]@{
            lineCount = $CapturedLines.Count
            lines = @($CapturedLines)
        }
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
$exitCode = 0
$capturedLines = New-Object System.Collections.Generic.List[string]

try {
    Assert-Command node
    Invoke-DefinitionsValidator -Paths $paths

    $createResult = Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'create', '--action', 'run', '--app', $App, '--board', $Board, '--platform', $Platform, '--unit', $Unit, '--reason', 'run.ps1') | ConvertFrom-Json
    $job = $createResult.job
    $jobId = $job.jobId

    $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
    if (-not (Test-Path $logsRoot)) {
        New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
    }
    $logPath = Join-Path $logsRoot ("run-{0}.log" -f $jobId)
    Set-Content $logPath ''

    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'running') | Out-Null

    $resolvedBoard = if ($job.resolution.matchedBoardId) { $job.resolution.matchedBoardId } else { $Board }
    $resolvedProjectId = if ($job.resolution.matchedProjectId) { $job.resolution.matchedProjectId } else { $App }
    $resolvedPort = if ($job.resolution.resolvedTransportPort) { $job.resolution.resolvedTransportPort } else { $Unit }
    $resolvedTransportKind = if ($job.resolution.resolvedTransportKind) { $job.resolution.resolvedTransportKind } else { 'serial' }

    Write-RunLogLine -LogPath $logPath -Message "Starting run job $jobId for project $resolvedProjectId on board $resolvedBoard"
    Write-RunLogLine -LogPath $logPath -Message "Resolved unit: $($job.resolution.matchedUnitId)"
    Write-RunLogLine -LogPath $logPath -Message "Resolved transport: $resolvedTransportKind"
    Write-RunLogLine -LogPath $logPath -Message "Resolved port: $resolvedPort"
    Write-RunLogLine -LogPath $logPath -Message "Run timeout: $RunTimeoutSeconds seconds"
    Write-RunLogLine -LogPath $logPath -Message "Baud rate: $BaudRate"

    if ([string]::IsNullOrWhiteSpace($resolvedPort)) {
        throw "No transport port is available for the selected unit."
    }

    $capturedLines = Capture-SerialConsole -PortName $resolvedPort -BaudRate $BaudRate -DurationSeconds $RunTimeoutSeconds -LogPath $logPath -LiveOutput (-not $NoLiveOutput)

    if ($capturedLines.Count -eq 0) {
        $summary = "Run complete for $resolvedBoard on $resolvedPort with no console lines captured in $RunTimeoutSeconds seconds"
    }
    else {
        $summary = "Run complete for $resolvedBoard on $resolvedPort with $($capturedLines.Count) console lines captured"
    }

    Write-RunLogLine -LogPath $logPath -Message $summary
    Write-Host $summary

    $reportPath = Write-RunReport -Paths $paths -Job $job -LogPath $logPath -PortName $resolvedPort -BaudRate $BaudRate -DurationSeconds $RunTimeoutSeconds -CapturedLines $capturedLines -ExitCode $exitCode -Pass $true -Summary $summary
    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'succeeded', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'true', '--result-json', $reportPath) | Out-Null
}
catch {
    $failure = $_.Exception.Message
    $exitCode = 1
    if (-not $summary) {
        $summary = $failure
    }

    if ($job -and $jobId) {
        if (-not $logPath) {
            $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
            if (-not (Test-Path $logsRoot)) {
                New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
            }
            $logPath = Join-Path $logsRoot ("run-{0}.log" -f $jobId)
            Set-Content $logPath ''
        }

        Write-RunLogLine -LogPath $logPath -Message "Run failed: $failure"

        if (-not $reportPath) {
            $resolvedPort = if ($job.resolution.resolvedTransportPort) { $job.resolution.resolvedTransportPort } else { $Unit }
            $reportPath = Write-RunReport -Paths $paths -Job $job -LogPath $logPath -PortName $resolvedPort -BaudRate $BaudRate -DurationSeconds $RunTimeoutSeconds -CapturedLines $capturedLines -ExitCode $exitCode -Pass $false -Summary $summary
        }

        Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'failed', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'false', '--result-json', $reportPath) | Out-Null
    }
    throw
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
