param(
    [string]$ExePath = 'C:\Program Files\PisoNet Cloud\PisoNet Cloud.exe',
    [int]$PollSeconds = 2
)

$ErrorActionPreference = 'Stop'
$PollSeconds = [Math]::Max(1, [Math]::Min(30, $PollSeconds))
$stateDir = Join-Path $env:APPDATA 'pisonet-cloud'
$maintenanceLock = Join-Path $stateDir 'maintenance.lock'
$logFile = Join-Path $stateDir 'watchdog.log'
$mutexName = 'Local\PisoNetCloudWatchdog_' + $env:USERNAME
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

function Write-Log([string]$message) {
    try {
        if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 2097152) {
            Move-Item -LiteralPath $logFile -Destination ($logFile + '.old') -Force
        }
        Add-Content -LiteralPath $logFile -Value ('{0} {1}' -f (Get-Date -Format o), $message) -Encoding UTF8
    } catch { }
}

# Only one watchdog per signed-in user. Do not use elevated permissions.
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) { Write-Log 'Another watchdog is already running; exiting duplicate.'; $mutex.Dispose(); exit 0 }

try {
    $ExePath = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($ExePath))
    Write-Log "Watchdog started. Executable: $ExePath"
    $lastState = ''
    $nextAttempt = [DateTime]::MinValue
    $failureCount = 0

    while ($true) {
        try {
            if (Test-Path -LiteralPath $maintenanceLock) {
                if ($lastState -ne 'maintenance') { Write-Log 'Maintenance lock detected; relaunch suspended.'; $lastState = 'maintenance' }
                Start-Sleep -Seconds $PollSeconds
                continue
            }

            # Get-Process does not depend on WMI/CIM service availability.
            # Compare the executable path so an unrelated process cannot satisfy the check.
            $running = $false
            foreach ($process in @(Get-Process -Name 'PisoNet Cloud' -ErrorAction SilentlyContinue)) {
                try {
                    if ($process.Path -and [string]::Equals(
                        [IO.Path]::GetFullPath($process.Path), $ExePath,
                        [StringComparison]::OrdinalIgnoreCase)) {
                        $running = $true
                        break
                    }
                } catch { }
            }

            if ($running) {
                if ($lastState -ne 'running') { Write-Log 'PisoNet Cloud is running.'; $lastState = 'running' }
                $failureCount = 0
                $nextAttempt = [DateTime]::MinValue
                Start-Sleep -Seconds $PollSeconds
                continue
            }

            if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
                if ($lastState -ne 'missing') { Write-Log "Executable missing: $ExePath"; $lastState = 'missing' }
                Start-Sleep -Seconds 10
                continue
            }

            if ((Get-Date) -lt $nextAttempt) { Start-Sleep -Seconds $PollSeconds; continue }

            # Re-check maintenance immediately before launching to reduce exit/relaunch races.
            if (Test-Path -LiteralPath $maintenanceLock) { continue }
            Write-Log 'Application not running; launching.'
            Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path -Parent $ExePath) -ErrorAction Stop | Out-Null
            $failureCount++
            $delay = [Math]::Min(30, [Math]::Max(3, $failureCount * 3))
            $nextAttempt = (Get-Date).AddSeconds($delay)
            $lastState = 'launched'
            Write-Log "Launch attempted; next retry no sooner than $delay seconds."
        } catch {
            Write-Log "Watchdog error: $($_.Exception.Message)"
            $nextAttempt = (Get-Date).AddSeconds(10)
        }
        Start-Sleep -Seconds $PollSeconds
    }
} finally {
    try { $mutex.ReleaseMutex() } catch { }
    $mutex.Dispose()
}
