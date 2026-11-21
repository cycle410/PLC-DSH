param(
  [string]$TitleFragment = 'TIA Portal',
  [string]$ResultPath = "$env:TEMP\agentplc-tia-ocr.json",
  [string]$ScreenshotPath = "$env:TEMP\agentplc-tia-ocr.png",
  [double]$CropBottomFraction = 0
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
public class TiaWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static List<IntPtr> Visible() { var list = new List<IntPtr>(); EnumWindows((h,l)=>{ if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero); return list; }
  public static string Title(IntPtr h) { var sb = new StringBuilder(1024); GetWindowText(h, sb, 1024); return sb.ToString(); }
}
"@
[void][TiaWin]::SetProcessDPIAware()

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  return $task.Result
}
function Invoke-Ocr([string]$imagePath) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($null -eq $engine) {
    $language = New-Object Windows.Globalization.Language('zh-Hans-CN')
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
  }
  if ($null -eq $engine) { return @() }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($line in $result.Lines) { $lines += $line.Text }
  return $lines
}

$result = [ordered]@{ ok = $false; window = $null; screenshot = $null; lines = @(); errorLines = @(); error = $null }
try {
  $handle = [IntPtr]::Zero
  foreach ($h in [TiaWin]::Visible()) {
    $title = [TiaWin]::Title($h)
    if ($title -like "*$TitleFragment*") { $handle = $h; break }
  }
  if ($handle -eq [IntPtr]::Zero) { throw "TIA window not found (fragment: $TitleFragment)" }
  $result.window = [TiaWin]::Title($handle)
  [void][TiaWin]::ShowWindow($handle, 9)
  [void][TiaWin]::SetForegroundWindow($handle)
  Start-Sleep -Seconds 2
  $rect = New-Object 'TiaWin+RECT'
  [void][TiaWin]::GetWindowRect($handle, [ref]$rect)
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  $graphics.Dispose()
  if ($CropBottomFraction -gt 0 -and $CropBottomFraction -lt 1) {
    $cropHeight = [int]($height * $CropBottomFraction)
    $cropRect = New-Object System.Drawing.Rectangle(0, ($height - $cropHeight), $width, $cropHeight)
    $crop = $bitmap.Clone($cropRect, $bitmap.PixelFormat)
    $scaled = New-Object System.Drawing.Bitmap($crop, [int]($width * 2), [int]($cropHeight * 2))
    $bitmap.Dispose()
    $scaled.Save($ScreenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $scaled.Dispose()
    $crop.Dispose()
  } else {
    $bitmap.Save($ScreenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
  }
  $result.screenshot = $ScreenshotPath
  $lines = @()
  foreach ($line in (Invoke-Ocr $ScreenshotPath)) {
    $text = ($line -replace '(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '').Trim()
    if ($text.Length -gt 1) { $lines += $text }
  }
  $result.lines = @($lines | Select-Object -First 300)
  $result.errorLines = @($lines | Where-Object { $_ -match '错误|警告|Error|Warn|E\d{3,}|W\d{3,}|行|line' } | Select-Object -First 120)
  $result.ok = $true
} catch {
  $result.error = $_.Exception.Message
} finally {
  [System.IO.File]::WriteAllText($ResultPath, ($result | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
  if ($result.screenshot) { Write-Output ("screenshot: " + $result.screenshot) }
  Write-Output ("result: " + $ResultPath)
}
