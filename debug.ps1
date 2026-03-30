param(
    [ValidateSet('esp32', 'stm32')]
    [string]$Platform = 'esp32',
    [string]$App = 'm5stack_dial_demo',
    [string]$Board = 'm5stack_dial_v1_1',
    [Parameter(Mandatory = $true)]
    [string]$Unit,
    [ValidateRange(1024, 65535)]
    [int]$GdbServerPort = 3333,
    [ValidateRange(1024, 65535)]
    [int]$TelnetPort = 4444,
    [ValidateRange(1024, 65535)]
    [int]$TclPort = 6666
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

function Write-DebugLogLine {
    param(
        [string]$LogPath,
        [string]$Message
    )

    $timestamp = (Get-Date).ToString('o')
    Add-Content -Path $LogPath -Value "[$timestamp] $Message"
}

function Find-SingleFile {
    param(
        [string]$Root,
        [string]$Filter
    )

    $matches = Get-ChildItem -Path $Root -Recurse -Filter $Filter -File -ErrorAction SilentlyContinue | Sort-Object FullName
    if ($matches.Count -eq 0) {
        return $null
    }
    return $matches[0].FullName
}

function Get-DebugProjectMetadata {
    param(
        [string]$BuildDir,
        [string]$Platform,
        [string]$AppId
    )

    $metadata = [ordered]@{
        BuildDir = $BuildDir
        ElfPath = Join-Path $BuildDir ("{0}.elf" -f $AppId)
        MapPath = Join-Path $BuildDir ("{0}.map" -f $AppId)
        GdbInitPath = $null
        OpenOcdArgs = @()
        MonitorBaud = 115200
        Target = $null
        ToolPrefix = $null
    }

    if ($Platform -eq 'esp32') {
        $descriptionPath = Join-Path $BuildDir 'project_description.json'
        if (Test-Path $descriptionPath) {
            $description = Get-Content -Raw -Path $descriptionPath | ConvertFrom-Json
            $metadata.Target = $description.target
            $metadata.ToolPrefix = $description.monitor_toolprefix
            if ($description.monitor_baud) {
                $metadata.MonitorBaud = [int]$description.monitor_baud
            }
            if ($description.app_elf) {
                $metadata.ElfPath = Join-Path $BuildDir $description.app_elf
            }
            if ($description.debug_arguments_openocd) {
                $metadata.OpenOcdArgs = [string]$description.debug_arguments_openocd -split '\s+'
            }
            if ($description.gdbinit_files.'04_connect') {
                $metadata.GdbInitPath = Join-Path $BuildDir 'gdbinit\gdbinit'
            }
        }
    }

    return $metadata
}

function Get-EspDebugTools {
    param(
        [hashtable]$Paths,
        [string]$BuildTarget
    )

    $openOcd = Find-SingleFile -Root (Join-Path $Paths.ToolRoot 'espressif') -Filter 'openocd.exe'
    if (-not $openOcd) {
        throw "ESP32 debug tool 'openocd.exe' was not found under '$($Paths.ToolRoot)\espressif'."
    }

    $targetName = switch (($BuildTarget ?? '').ToLowerInvariant()) {
        'esp32s3' { 'xtensa-esp32s3-elf-gdb.exe' }
        'esp32' { 'xtensa-esp32-elf-gdb.exe' }
        default { 'xtensa-esp32s3-elf-gdb.exe' }
    }

    $gdbPath = Find-SingleFile -Root (Join-Path $Paths.ToolRoot 'espressif') -Filter $targetName
    if (-not $gdbPath) {
        throw "ESP32 GDB tool '$targetName' was not found under '$($Paths.ToolRoot)\espressif'."
    }

    return [ordered]@{
        OpenOcdPath = $openOcd
        GdbPath = $gdbPath
    }
}

function Get-Stm32DebugTools {
    param(
        [hashtable]$Paths
    )

    $openOcd = Find-SingleFile -Root (Join-Path $Paths.ToolRoot 'espressif') -Filter 'openocd.exe'
    if (-not $openOcd) {
        throw "OpenOCD was not found under '$($Paths.ToolRoot)\espressif'."
    }

    $gdbPath = Join-Path $Paths.ArmGnuToolchainRoot 'bin\arm-none-eabi-gdb.exe'
    if (-not (Test-Path $gdbPath)) {
        throw "STM32 GDB tool was not found at '$gdbPath'."
    }

    return [ordered]@{
        OpenOcdPath = $openOcd
        GdbPath = $gdbPath
    }
}

function Get-DebugLaunchMetadata {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$BuildDir,
        [int]$GdbServerPort,
        [int]$TelnetPort,
        [int]$TclPort
    )

    $projectId = if ($Job.resolution.matchedProjectId) { $Job.resolution.matchedProjectId } else { $Job.request.appId }
    $appId = if ($Job.resolution.resolvedAppId) { $Job.resolution.resolvedAppId } else { $Job.request.appId }
    $platform = $Job.request.platform
    $metadata = Get-DebugProjectMetadata -BuildDir $BuildDir -Platform $platform -AppId $appId

    if (-not (Test-Path $metadata.ElfPath)) {
        throw "Debug symbol file '$($metadata.ElfPath)' was not found. Run build.ps1 for project '$projectId' first."
    }

    if ($platform -eq 'esp32') {
        $tools = Get-EspDebugTools -Paths $Paths -BuildTarget $metadata.Target
        $openOcdArgs = @('-f', 'interface/esp_usb_jtag.cfg', '-c', "gdb_port $GdbServerPort", '-c', "tcl_port $TclPort", '-c', "telnet_port $TelnetPort")
        if ($metadata.OpenOcdArgs.Count -gt 0) {
            $openOcdArgs += $metadata.OpenOcdArgs
        }
        elseif ($metadata.Target) {
            $openOcdArgs += @('-f', "target/$($metadata.Target).cfg")
        }

        $gdbArgs = @($metadata.ElfPath, '-ex', "target extended-remote localhost:$GdbServerPort")
        if ($metadata.GdbInitPath) {
            $gdbArgs += @('-x', $metadata.GdbInitPath)
        }

        return [ordered]@{
            Platform = 'esp32'
            OpenOcdPath = $tools.OpenOcdPath
            OpenOcdArgs = $openOcdArgs
            GdbPath = $tools.GdbPath
            GdbArgs = $gdbArgs
            SymbolFile = $metadata.ElfPath
            MapFile = if (Test-Path $metadata.MapPath) { $metadata.MapPath } else { $null }
            GdbInitPath = $metadata.GdbInitPath
            WorkingDirectory = $BuildDir
            Ide = [ordered]@{
                vscode = [ordered]@{
                    name = "Board Manager Debug ($appId)"
                    type = 'cppdbg'
                    request = 'launch'
                    cwd = $BuildDir
                    program = $metadata.ElfPath
                    MIMode = 'gdb'
                    miDebuggerPath = $tools.GdbPath
                    miDebuggerServerAddress = "localhost:$GdbServerPort"
                    setupCommands = @(
                        [ordered]@{ text = 'set remote hardware-watchpoint-limit 2' },
                        [ordered]@{ text = 'monitor reset halt' }
                    )
                    externalConsole = $false
                }
            }
            Notes = @(
                "Start OpenOCD first, then connect with GDB.",
                "Resolved transport port is '$($Job.resolution.resolvedTransportPort)'; ESP32 debug uses the USB JTAG interface rather than the serial monitor port."
            )
        }
    }

    $stmTools = Get-Stm32DebugTools -Paths $Paths
    $stmOpenOcdArgs = @(
        '-f', 'interface/stlink.cfg',
        '-f', 'target/stm32f0x.cfg',
        '-c', "gdb_port $GdbServerPort",
        '-c', "tcl_port $TclPort",
        '-c', "telnet_port $TelnetPort"
    )
    $stmGdbArgs = @(
        $metadata.ElfPath,
        '-ex', "target extended-remote localhost:$GdbServerPort",
        '-ex', 'monitor reset halt'
    )

    return [ordered]@{
        Platform = 'stm32'
        OpenOcdPath = $stmTools.OpenOcdPath
        OpenOcdArgs = $stmOpenOcdArgs
        GdbPath = $stmTools.GdbPath
        GdbArgs = $stmGdbArgs
        SymbolFile = $metadata.ElfPath
        MapFile = if (Test-Path $metadata.MapPath) { $metadata.MapPath } else { $null }
        GdbInitPath = $null
        WorkingDirectory = $BuildDir
        Ide = [ordered]@{
            vscode = [ordered]@{
                name = "Board Manager Debug ($appId)"
                type = 'cppdbg'
                request = 'launch'
                cwd = $BuildDir
                program = $metadata.ElfPath
                MIMode = 'gdb'
                miDebuggerPath = $stmTools.GdbPath
                miDebuggerServerAddress = "localhost:$GdbServerPort"
                setupCommands = @(
                    [ordered]@{ text = 'monitor reset halt' }
                )
                externalConsole = $false
            }
        }
        Notes = @(
            "Start OpenOCD with the ST-LINK interface first, then connect with GDB.",
            "Resolved transport port is '$($Job.resolution.resolvedTransportPort)'; STM32 debug uses ST-LINK through OpenOCD rather than the UART console port."
        )
    }
}

function Resolve-DebugBuildDir {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$Platform,
        [string]$FallbackApp
    )

    $projectId = if ($Job.resolution.matchedProjectId) { $Job.resolution.matchedProjectId } else { $FallbackApp }
    $appId = if ($Job.resolution.resolvedAppId) { $Job.resolution.resolvedAppId } else { $FallbackApp }

    $candidates = @(
        Join-Path $Paths.BuildRoot ("{0}-{1}" -f $Platform, $projectId)
    )
    if ($appId -and $appId -ne $projectId) {
        $candidates += Join-Path $Paths.BuildRoot ("{0}-{1}" -f $Platform, $appId)
    }

    foreach ($candidate in $candidates) {
        $candidateElfNames = @()
        if ($appId) {
            $candidateElfNames += ("{0}.elf" -f $appId)
        }
        if ($projectId -and $projectId -ne $appId) {
            $candidateElfNames += ("{0}.elf" -f $projectId)
        }

        foreach ($elfName in $candidateElfNames) {
            if (Test-Path (Join-Path $candidate $elfName)) {
                return $candidate
            }
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $candidates[0]
}

function Write-DebugReport {
    param(
        [hashtable]$Paths,
        [pscustomobject]$Job,
        [string]$LogPath,
        [string]$BuildDir,
        [object]$LaunchMetadata,
        [int]$ExitCode,
        [bool]$Pass,
        [string]$Summary
    )

    $reportsRoot = Join-Path $Paths.ProjectRoot 'job-manager\reports'
    if (-not (Test-Path $reportsRoot)) {
        New-Item -ItemType Directory -Force -Path $reportsRoot | Out-Null
    }

    $reportPath = Join-Path $reportsRoot ("debug-{0}.json" -f $Job.jobId)
    [object[]]$logs = ,([ordered]@{ kind = 'debug-log'; path = $LogPath })
    [object[]]$artifacts = @(
        [ordered]@{ kind = 'symbol-file'; path = $LaunchMetadata.SymbolFile }
    )
    if ($LaunchMetadata.MapFile) {
        $artifacts += [ordered]@{ kind = 'linker-map'; path = $LaunchMetadata.MapFile }
    }
    if ($LaunchMetadata.GdbInitPath) {
        $artifacts += [ordered]@{ kind = 'gdbinit'; path = $LaunchMetadata.GdbInitPath }
    }

    $report = [ordered]@{
        reportKind = 'debug'
        generatedAt = (Get-Date).ToString('o')
        reportPath = $reportPath
        jobId = $Job.jobId
        request = $Job.request
        resolution = $Job.resolution
        debug = [ordered]@{
            platform = $Job.request.platform
            boardId = $Job.resolution.matchedBoardId
            projectId = $Job.resolution.matchedProjectId
            stableUnitId = $Job.resolution.matchedUnitId
            transportKind = $Job.resolution.resolvedTransportKind
            transportPort = $Job.resolution.resolvedTransportPort
            buildDir = $BuildDir
            symbolFile = $LaunchMetadata.SymbolFile
            mapFile = $LaunchMetadata.MapFile
            gdbInitPath = $LaunchMetadata.GdbInitPath
            gdb = [ordered]@{
                executable = $LaunchMetadata.GdbPath
                arguments = $LaunchMetadata.GdbArgs
            }
            server = [ordered]@{
                executable = $LaunchMetadata.OpenOcdPath
                arguments = $LaunchMetadata.OpenOcdArgs
            }
            ide = $LaunchMetadata.Ide
            notes = $LaunchMetadata.Notes
        }
        logs = $logs
        artifacts = $artifacts
        result = [ordered]@{
            summary = $Summary
            exitCode = $ExitCode
            pass = $Pass
        }
    }

    $report | ConvertTo-Json -Depth 12 | Set-Content $reportPath
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

    $createResult = Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'create', '--action', 'debug', '--app', $App, '--board', $Board, '--platform', $Platform, '--unit', $Unit, '--reason', 'debug.ps1') | ConvertFrom-Json
    $job = $createResult.job
    $jobId = $job.jobId

    $logsRoot = Join-Path $paths.ProjectRoot 'job-manager\logs'
    if (-not (Test-Path $logsRoot)) {
        New-Item -ItemType Directory -Force -Path $logsRoot | Out-Null
    }
    $logPath = Join-Path $logsRoot ("debug-{0}.log" -f $jobId)
    Set-Content $logPath ''

    Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'running') | Out-Null

    $resolvedProjectId = if ($job.resolution.matchedProjectId) { $job.resolution.matchedProjectId } else { $App }
    $buildDir = Resolve-DebugBuildDir -Paths $paths -Job $job -Platform $Platform -FallbackApp $App
    $launchMetadata = Get-DebugLaunchMetadata -Paths $paths -Job $job -BuildDir $buildDir -GdbServerPort $GdbServerPort -TelnetPort $TelnetPort -TclPort $TclPort

    Write-DebugLogLine -LogPath $logPath -Message "Prepared debug job $jobId for project $resolvedProjectId on board $($job.resolution.matchedBoardId)"
    Write-DebugLogLine -LogPath $logPath -Message "Resolved unit: $($job.resolution.matchedUnitId)"
    Write-DebugLogLine -LogPath $logPath -Message "Resolved transport: $($job.resolution.resolvedTransportKind)"
    Write-DebugLogLine -LogPath $logPath -Message "Resolved port: $($job.resolution.resolvedTransportPort)"
    Write-DebugLogLine -LogPath $logPath -Message "OpenOCD: $($launchMetadata.OpenOcdPath) $($launchMetadata.OpenOcdArgs -join ' ')"
    Write-DebugLogLine -LogPath $logPath -Message "GDB: $($launchMetadata.GdbPath) $($launchMetadata.GdbArgs -join ' ')"

    $summary = "Debug launch metadata prepared for $($job.resolution.matchedBoardId) on $($job.resolution.matchedUnitId)"
    $exitCode = 0
    Write-DebugLogLine -LogPath $logPath -Message $summary
    Write-Host $summary

    $reportPath = Write-DebugReport -Paths $paths -Job $job -LogPath $logPath -BuildDir $buildDir -LaunchMetadata $launchMetadata -ExitCode $exitCode -Pass $true -Summary $summary
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
            $logPath = Join-Path $logsRoot ("debug-{0}.log" -f $jobId)
            Set-Content $logPath ''
        }

        Write-DebugLogLine -LogPath $logPath -Message "Debug preparation failed: $failure"

        if (-not $reportPath) {
            $buildDir = Resolve-DebugBuildDir -Paths $paths -Job $job -Platform $Platform -FallbackApp $App
            $reportPath = Join-Path $paths.ProjectRoot 'job-manager\reports' ("debug-{0}.json" -f $jobId)
            $failureReport = [ordered]@{
                reportKind = 'debug'
                generatedAt = (Get-Date).ToString('o')
                reportPath = $reportPath
                jobId = $jobId
                request = $job.request
                resolution = $job.resolution
                debug = [ordered]@{
                    platform = $Platform
                    buildDir = $buildDir
                }
                logs = @(
                    [ordered]@{ kind = 'debug-log'; path = $logPath }
                )
                artifacts = @()
                result = [ordered]@{
                    summary = $summary
                    exitCode = $exitCode
                    pass = $false
                }
            }
            $failureReport | ConvertTo-Json -Depth 12 | Set-Content $reportPath
        }

        Invoke-Stage3JobCommand -Paths $paths -Arguments @('project/scripts/manage-stage3-jobs.mjs', 'update', '--job', $jobId, '--status', 'failed', '--summary', $summary, '--report-path', $reportPath, '--exit-code', [string]$exitCode, '--pass', 'false', '--result-json', $reportPath) | Out-Null
    }
    throw
}
finally {
    Restore-BoardManagerEnv -Snapshot $snapshot
}

