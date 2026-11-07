param(
  [Parameter(Mandatory=$true)][ValidateSet('lock','unlock')][string]$Action,
  [Parameter(Mandatory=$true)][string]$StatePath
)
$ErrorActionPreference = 'Stop'
# Windows default playback device mute control (Core Audio COM; no third-party package).
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumerator { }
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
  int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
  int RegisterEndpointNotificationCallback(IntPtr client);
  int UnregisterEndpointNotificationCallback(IntPtr client);
}
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("D666063F-1587-4E43-81F1-B948E807363F")]
interface IMMDevice {
  int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  int OpenPropertyStore(int access, out IntPtr store);
  int GetId(out IntPtr id);
  int GetState(out int state);
}
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr notify);
  int UnregisterControlChangeNotify(IntPtr notify);
  int GetChannelCount(out uint count);
  int SetMasterVolumeLevel(float level, ref Guid eventContext);
  int SetMasterVolumeLevelScalar(float level, ref Guid eventContext);
  int GetMasterVolumeLevel(out float level);
  int GetMasterVolumeLevelScalar(out float level);
  int SetChannelVolumeLevel(uint channel, float level, ref Guid context);
  int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
  int GetChannelVolumeLevel(uint channel, out float level);
  int GetChannelVolumeLevelScalar(uint channel, out float level);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
  int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  int GetVolumeStepInfo(out uint step, out uint count);
  int VolumeStepUp(ref Guid context);
  int VolumeStepDown(ref Guid context);
  int QueryHardwareSupport(out uint mask);
  int GetVolumeRange(out float min, out float max, out float increment);
}
public static class PisoNetAudio {
  private static IAudioEndpointVolume Endpoint() {
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    IMMDevice device;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
    var id = typeof(IAudioEndpointVolume).GUID;
    object obj;
    Marshal.ThrowExceptionForHR(device.Activate(ref id, 23, IntPtr.Zero, out obj));
    return (IAudioEndpointVolume)obj;
  }
  public static bool GetMute() { bool mute; Marshal.ThrowExceptionForHR(Endpoint().GetMute(out mute)); return mute; }
  public static void SetMute(bool mute) { var ctx = Guid.Empty; Marshal.ThrowExceptionForHR(Endpoint().SetMute(mute, ref ctx)); }
}
'@
if ($Action -eq 'lock') {
  if (-not (Test-Path -LiteralPath $StatePath)) {
    $wasMuted = [PisoNetAudio]::GetMute()
    $dir = Split-Path -Parent $StatePath
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    @{ wasMuted = $wasMuted } | ConvertTo-Json -Compress | Set-Content -LiteralPath $StatePath -Encoding UTF8
  }
  [PisoNetAudio]::SetMute($true)
} else {
  if (Test-Path -LiteralPath $StatePath) {
    $previous = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    [PisoNetAudio]::SetMute([bool]$previous.wasMuted)
    Remove-Item -LiteralPath $StatePath -Force
  }
}
