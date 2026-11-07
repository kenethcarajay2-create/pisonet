param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('hide','show')]
  [string]$Action
)

# Reversible visual taskbar control for the current interactive desktop.
# Not a security boundary; Explorer can show the taskbar again.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PisoNetTaskbarNative {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr FindWindow(string className, string windowName);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder className, int maxCount);
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int command);
}
'@

$command = if ($Action -eq 'hide') { 0 } else { 5 }
$handles = New-Object 'System.Collections.Generic.List[System.IntPtr]'
$primary = [PisoNetTaskbarNative]::FindWindow('Shell_TrayWnd', $null)
if ($primary -ne [IntPtr]::Zero) { $handles.Add($primary) }
$callback = [PisoNetTaskbarNative+EnumWindowsProc] {
  param([IntPtr]$hwnd, [IntPtr]$unused)
  $name = New-Object System.Text.StringBuilder 256
  [void][PisoNetTaskbarNative]::GetClassName($hwnd, $name, $name.Capacity)
  if ($name.ToString() -eq 'Shell_SecondaryTrayWnd') { $handles.Add($hwnd) }
  return $true
}
[void][PisoNetTaskbarNative]::EnumWindows($callback, [IntPtr]::Zero)
foreach ($hwnd in $handles) { [void][PisoNetTaskbarNative]::ShowWindow($hwnd, $command) }
