param(
    [string]$ExePath = 'C:\Program Files\PisoNet Cloud\PisoNet Cloud.exe'
)
$ErrorActionPreference = 'Stop'
$ExePath = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($ExePath))
if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    throw "PisoNet executable not found: $ExePath. Install the app or pass -ExePath with the correct path."
}
$installDir = Join-Path $env:LOCALAPPDATA 'PisoNetCloud'
$destination = Join-Path $installDir 'PisoNet-Watchdog.ps1'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'PisoNet-Watchdog.ps1') -Destination $destination -Force
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'PisoNet Watchdog.lnk'
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
# Quote arguments using double quotes. Reject quote in path to avoid command-line injection.
if ($ExePath.Contains('"')) { throw 'Executable path contains an invalid quote.' }
$shortcut.Arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $destination + '" -ExePath "' + $ExePath + '"'
$shortcut.WorkingDirectory = $installDir
$shortcut.WindowStyle = 7
$shortcut.Description = 'PisoNet Cloud watchdog (runs when this user signs in)'
$shortcut.Save()
Write-Host "Installed watchdog: $destination"
Write-Host "Startup shortcut: $shortcutPath"
Write-Host "Watching: $ExePath"
Write-Host 'To start it now, run Start-Watchdog.ps1 (or sign out and back in).'
