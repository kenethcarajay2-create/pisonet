param(
  [Parameter(Mandatory=$true)][ValidateSet('display-off','close-apps')][string]$Action,
  [string]$NamesJson = '[]'
)
$ErrorActionPreference = 'Stop'
if ($Action -eq 'display-off') {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PisoNetDisplay {
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  public static void Off() { SendMessage(new IntPtr(0xffff), 0x0112, new IntPtr(0xF170), new IntPtr(2)); }
}
'@
  [PisoNetDisplay]::Off()
  exit 0
}
$names = @($NamesJson | ConvertFrom-Json)
$protected = @('explorer','winlogon','csrss','services','lsass','svchost','dwm','sihost','taskhostw','powershell','pwsh','cmd','conhost','PisoNet Cloud')
foreach ($name in $names) {
  if ($name -isnot [string] -or $name -notmatch '^[a-zA-Z0-9_. -]{1,80}$') { continue }
  $base = $name -replace '\.exe$',''
  if ($protected -contains $base) { continue }
  foreach ($proc in @(Get-Process -Name $base -ErrorAction SilentlyContinue)) {
    if ($proc.MainWindowHandle -eq [IntPtr]::Zero) { continue }
    try { $null = $proc.CloseMainWindow(); Write-Output "Requested graceful close: $($proc.ProcessName) ($($proc.Id))" }
    catch { Write-Warning "Could not close $($proc.ProcessName): $_" }
  }
}
