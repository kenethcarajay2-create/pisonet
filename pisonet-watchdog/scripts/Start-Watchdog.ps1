param([string]$ExePath = 'C:\Program Files\PisoNet Cloud\PisoNet Cloud.exe')
$scriptPath = Join-Path $env:LOCALAPPDATA 'PisoNetCloud\PisoNet-Watchdog.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) { throw 'Install the watchdog first using Install-Watchdog.ps1.' }
Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+$scriptPath+'"'),'-ExePath',('"'+$ExePath+'"'))
Write-Host 'Watchdog start requested. Check %APPDATA%\pisonet-cloud\watchdog.log for confirmation.'
