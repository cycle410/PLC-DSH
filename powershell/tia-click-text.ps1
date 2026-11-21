param(
  [string]$TitleFragment = 'TIA Portal',
  [string]$Text = '项目视图',
  [string]$ResultPath = "$env:TEMP\agentplc-tia-click.json",
  [switch]$Click
)
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime]
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class ClickWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extra);
  public static List<IntPtr> Visible() { var list = new List<IntPtr>(); EnumWindows((h,l)=>{ if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero); return list; }
  public static string Title(IntPtr h) { var sb = new StringBuilder(1024); GetWindowText(h, sb, 1024); return sb.ToString(); }
  public static void Click(int x, int y) { SetCursorPos(x, y); mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); }
}
"@
[void][ClickWin]::SetProcessDPIAware()

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  return $task.Result
}
function Ocr-Image([string]$imagePath) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($null -eq $engine) {
    $language = New-Object Windows.Globalization.Language('zh-Hans-CN')
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
  }
  if ($null -eq $engine) { throw 'No OCR engine available.' }
  return (Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]))
}

$result = [ordered]@{ ok = $false; window = $null; found = $false; text = $Text; x = 0; y = 0; screenshot = $null; error = $null }
try {
  $handle = [IntPtr]::Zero
  foreach ($h in [ClickWin]::Visible()) {
    if ([ClickWin]::Title($h) -like "*$TitleFragment*") { $handle = $h; break }
  }
  if ($handle -eq [IntPtr]::Zero) { throw "Window not found: $TitleFragment" }
  $result.window = [ClickWin]::Title($handle)
  [void][ClickWin]::ShowWindow($handle, 9)
  [void][ClickWin]::SetForegroundWindow($handle)
  Start-Sleep -Seconds 2
  $rect = New-Object 'ClickWin+RECT'
  [void][ClickWin]::GetWindowRect($handle, [ref]$rect)
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  $graphics.Dispose()
  $shot = "$env:TEMP\agentplc-tia-click.png"
  $bitmap.Save($shot, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  $result.screenshot = $shot
  $ocr = Ocr-Image $shot
  foreach ($line in $ocr.Lines) {
    $joined = ($line.Text -replace '\s+', '')
    if ($joined -like "*$($Text -replace '\s+','')*") {
      $minX = [double]::MaxValue; $minY = [double]::MaxValue; $maxX = 0.0; $maxY = 0.0
      foreach ($word in $line.Words) {
        $r = $word.BoundingRect
        if ($r.X -lt $minX) { $minX = $r.X }
        if ($r.Y -lt $minY) { $minY = $r.Y }
        if ($r.X + $r.Width -gt $maxX) { $maxX = $r.X + $r.Width }
        if ($r.Y + $r.Height -gt $maxY) { $maxY = $r.Y + $r.Height }
      }
      $result.found = $true
      $result.x = [int]($rect.Left + ($minX + $maxX) / 2)
      $result.y = [int]($rect.Top + ($minY + $maxY) / 2)
      break
    }
  }
  if ($result.found -and $Click) {
    [ClickWin]::Click($result.x, $result.y)
    Start-Sleep -Seconds 3
  }
  $result.ok = $true
} catch {
  $result.error = $_.Exception.Message
} finally {
  [System.IO.File]::WriteAllText($ResultPath, ($result | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
  Write-Output ("found=" + $result.found + " x=" + $result.x + " y=" + $result.y + " error=" + $result.error)
}
