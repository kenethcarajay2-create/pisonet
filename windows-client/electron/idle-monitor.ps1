# Reports seconds since the last keyboard or mouse input, once per second.
# Intended to run as a hidden child process of PisoNet Cloud.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PisoNetIdle {
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
    [DllImport("kernel32.dll")] private static extern uint GetTickCount();
    public static uint Seconds() {
        LASTINPUTINFO info = new LASTINPUTINFO();
        info.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
        if (!GetLastInputInfo(ref info)) return 0;
        return unchecked(GetTickCount() - info.dwTime) / 1000;
    }
}
'@
while ($true) {
    [Console]::Out.WriteLine([PisoNetIdle]::Seconds())
    [Console]::Out.Flush()
    Start-Sleep -Seconds 1
}
