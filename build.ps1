param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [string]$Unit,
    [string]$BuildType = 'Debug',
    [ValidateRange(30, 3600)]
    [int]$ConfigureTimeoutSeconds = 180,
    [ValidateRange(30, 3600)]
    [int]$BuildTimeoutSeconds = 300
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

function Write-BuildLogLine {
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
            Write-BuildLogLine -LogPath $LogPath -Message "$StepName timed out after $TimeoutSeconds seconds"
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
            catch {
            }
            throw "$StepName timed out after $TimeoutSeconds seconds"
        }

        if (Test-Path $stdoutPath) {
            $stdoutLines = Get-Content $stdoutPath
            foreach ($line in $stdoutLines) {
                Write-BuildLogLine -LogPath $LogPath -Message $line
            }
        }

        if (Test-Path $stderrPath) {
            $stderrLines = Get-Content $stderrPath
            foreach ($line in $stderrLines) {
                Write-BuildLogLine -LogPath $LogPath -Message "[stderr] $line"
            }
        }

        return $process.ExitCode
    }
    finally {
        if (Test-Path $stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force }
        if (Test-Path $stderrPath) { Remove-Item -LiteralPath $stderrPath -Force }
    }
}

function Get-BuildArtifacts {
    param(
        [string]$Platform,
        [string]$BuildDir
    )

    $artifacts = @()
    if (Test-Path $BuildDir) {
        $artifacts += [ordered]@{ kind = 'build-dir'; path = $BuildDir }
    }

    if ($Platform -eq 'esp32') {
        $specialArtifacts = @(
            @{ Kind = 'bootloader-bin'; Path = (Join-Path $BuildDir 'bootloader\bootloader.bin') },
            @{ Kind = 'partition-table'; Path = (Join-Path $BuildDir 'partition_table\partition-table.bin') },
            @{ Kind = 'flash-args'; Path = (Join-Path $BuildDir 'flasher_args.json') }
        )
        foreach ($item in $specialArtifacts) {
            if (Test-Path $item.Path) {
                $artifacts += [ordered]@{ kind = $item.Kind; path = $item.Path }
            }
        }
    }

    if (Test-Path $BuildDir) {
        $topLevelArtifacts = Get-ChildItem $BuildDir -File | Where-Object { $_.Extension -in @('.bin', '.elf', '.map') }
        foreach ($file in $topLevelArtifacts) {
            $kind = switch ($file.Extension) {
                '.bin' { 'firmware-bin' }
                '.elf' { 'firmware-elf' }
                '.map' { 'linker-map' }
                default { 'artifact' }
            }
            $artifacts += [ordered]@{ kind = $kind; path = $file.FullName }
        }
    }

    return @($artifacts)
}

function Write-BuildReport {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$LogPath,
        [string]$BuildDir,
        [string]$AppRoot,
        [string]$BuildType,
        [int]$ExitCode,
        [bool]$Pass,
        [string]$Summary,
        [bool]$IncludeArtifacts = $true
    )

    $reportsRoot = Join-Path $Paths.ProjectRoot 'job-manager\reports'
    if (-not (Test-Path $reportsRoot)) {
        New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null
    }

    [object[]]$artifacts = if ($IncludeArtifacts) { Get-BuildArtifacts -Platform $Job.request.platform -BuildDir $BuildDir } else { ,([ordered]@{ kind = 'build-dir'; path = $BuildDir }) }
    [object[]]$logs = ,([ordered]@{ kind = 'build-log'; path = $LogPath })
    $reportPath = Join-Path $reportsRoot ("build-{0}.json" -f $Job.jobId)

    $report = [ordered]@{
        reportKind = 'build'
        generatedAt = (Get-Date).ToString('o')
        reportPath = $reportPath
        jobId = $Job.jobId
        request = $Job.request
        resolution = $Job.resolution
        build = [ordered]@{
            platform = $Job.request.platform
            buildType = $BuildType
            buildDir = $BuildDir
            appRoot = $AppRoot
            boardId = $Job.resolution.matchedBoardId
            projectId = $Job.resolution.matchedProjectId
            firmwareFamily = $Job.resolution.resolvedFirmwareFamily
            entryPoint = $Job.resolution.resolvedEntryPoint
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
    Invoke-BoardGenerator -Paths $paths

    $createArguments = @('project/scripts/manage-stage3-jobs.mjs', 'create', '--action', 'build', '--app', $App, '--board', $Board, '--platform', $Platform, '--reason', 'build.ps1')
    if ($PSBoundParameters.ContainsKey('Unit') -and -not [string]::IsNullOrWhiteSpace($Unit)) {
        $createArguments += @('--unit', $Unit)
    }

    $createResult = Invoke-Stage3JobCommand -Paths $paths -Arguments $createArguments | ConvertFrom-Json
    $job = $createResult.job
    $jobId = $job.jobId

    $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
    if (-not (Test-Path $logsRoot)) {
        New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
    }
    $logPath = Join-Path $logsRoot ("build-{0}.log" -f $jobId)
    Set-Content $logPath ''

    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'running') | Out-Null

    $resolvedBoard = if ($job.resolution.matchedBoardId) { $job.resolution.matchedBoardId } else { $Board }
    $resolvedProjectId = if ($job.resolution.matchedProjectId) { $job.resolution.matchedProjectId } else { $App }
    $resolvedAppRoot = if ($job.resolution.resolvedAppRoot) { Join-Path $paths.ProjectRoot $job.resolution.resolvedAppRoot } else { Join-Path $paths.ProjectRoot "apps\$App" }
    $buildDir = Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $resolvedProjectId)

    if (-not (Test-Path $resolvedAppRoot)) {
        throw "Build app root '$resolvedAppRoot' was not found"
    }

    Write-BuildLogLine -LogPath $logPath -Message "Starting build job $jobId for project $resolvedProjectId on board $resolvedBoard"
    Write-BuildLogLine -LogPath $logPath -Message "Resolved app root: $resolvedAppRoot"
    Write-BuildLogLine -LogPath $logPath -Message "Resolved build directory: $buildDir"
    Write-BuildLogLine -LogPath $logPath -Message "Requested build type: $BuildType"
    Write-BuildLogLine -LogPath $logPath -Message "Configure timeout: $ConfigureTimeoutSeconds seconds"
    Write-BuildLogLine -LogPath $logPath -Message "Build timeout: $BuildTimeoutSeconds seconds"

    if ($Platform -eq 'esp32') {
        Initialize-EspIdfEnv -Paths $paths
        Write-BuildLogLine -LogPath $logPath -Message "Running idf.py build for ESP-IDF target"

        $exitCode = Invoke-LoggedProcess -FilePath 'idf.py' -ArgumentList @('-B', $buildDir, '-D', "CMAKE_BUILD_TYPE=$BuildType", '-D', "BOARD_MANAGER_BOARD=$resolvedBoard", 'build') -WorkingDirectory $resolvedAppRoot -LogPath $logPath -TimeoutSeconds $BuildTimeoutSeconds -StepName 'idf.py build'

        Write-BuildLogLine -LogPath $logPath -Message "idf.py exit code: $exitCode"
        if ($exitCode -ne 0) {
            throw "idf.py build failed with exit code $exitCode"
        }

        $summary = "ESP32 build completed for $resolvedBoard at $buildDir"
        Write-BuildLogLine -LogPath $logPath -Message $summary
        Write-Host $summary
    }
    else {
        Assert-Command cmake
        Assert-Command ninja
        Initialize-Stm32Env -Paths $paths

        $toolchainFile = Join-Path $paths.ProjectRoot 'cmake\toolchains\arm-none-eabi.cmake'
        Write-BuildLogLine -LogPath $logPath -Message "Running CMake configure for STM32 target"
        $exitCode = Invoke-LoggedProcess -FilePath 'cmake' -ArgumentList @('-S', $resolvedAppRoot, '-B', $buildDir, '-G', 'Ninja', '-D', "CMAKE_BUILD_TYPE=$BuildType", '-D', "CMAKE_TOOLCHAIN_FILE=$toolchainFile", '-D', "BOARD_MANAGER_PROJECT_ROOT=$($paths.ProjectRoot)", '-D', "BOARD_MANAGER_BOARD=$resolvedBoard", '-D', "STM32CUBE_F4_ROOT=$($paths.Stm32CubeSdkRoot)", '-D', "STM32CUBE_F0_ROOT=$($paths.Stm32CubeF0SdkRoot)", '-D', "ARM_GNU_TOOLCHAIN_ROOT=$($paths.ArmGnuToolchainRoot)") -WorkingDirectory $paths.RepoRoot -LogPath $logPath -TimeoutSeconds $ConfigureTimeoutSeconds -StepName 'cmake configure'
        Write-BuildLogLine -LogPath $logPath -Message "cmake configure exit code: $exitCode"
        if ($exitCode -ne 0) {
            throw "STM32 CMake configure failed with exit code $exitCode"
        }

        Write-BuildLogLine -LogPath $logPath -Message "Running CMake build for STM32 target"
        $exitCode = Invoke-LoggedProcess -FilePath 'cmake' -ArgumentList @('--build', $buildDir) -WorkingDirectory $paths.RepoRoot -LogPath $logPath -TimeoutSeconds $BuildTimeoutSeconds -StepName 'cmake build'
        Write-BuildLogLine -LogPath $logPath -Message "cmake build exit code: $exitCode"
        if ($exitCode -ne 0) {
            throw "STM32 build failed with exit code $exitCode"
        }

        $summary = "STM32 build completed for $resolvedBoard at $buildDir"
        Write-BuildLogLine -LogPath $logPath -Message $summary
        Write-Host $summary
    }

    $reportPath = Write-BuildReport -Paths $paths -Job $job -LogPath $logPath -BuildDir $buildDir -AppRoot $resolvedAppRoot -BuildType $BuildType -ExitCode $exitCode -Pass $true -Summary $summary -IncludeArtifacts $true
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
            $logPath = Join-Path $logsRoot ("build-{0}.log" -f $jobId)
            Set-Content $logPath ''
        }

        Write-BuildLogLine -LogPath $logPath -Message "Build failed: $failure"

        if (-not $reportPath) {
            $buildDir = if ($job.resolution.matchedProjectId) { Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $job.resolution.matchedProjectId) } else { Join-Path $paths.BuildRoot ("{0}-{1}" -f $Platform, $App) }
            $appRoot = if ($job.resolution.resolvedAppRoot) { Join-Path $paths.ProjectRoot $job.resolution.resolvedAppRoot } else { Join-Path $paths.ProjectRoot "apps\$App" }
            $reportPath = Write-BuildReport -Paths $paths -Job $job -LogPath $logPath -BuildDir $buildDir -AppRoot $appRoot -BuildType $BuildType -ExitCode $exitCode -Pass $false -Summary $summary -IncludeArtifacts $false
        }

        Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'failed', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'false', '--result-json', $reportPath) | Out-Null
    }
    throw
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}
