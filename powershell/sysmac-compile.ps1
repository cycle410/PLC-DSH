param(
  [Parameter(Mandatory = $true)][string]$ProjectPath,
  [Parameter(Mandatory = $true)][string]$ResultPath,
  [string]$ScreenshotPath = '',
  [string]$Exe = 'D:\OMRON\Sysmac Studio\SysmacStudio.exe',
  [int]$TimeoutSeconds = 150,
  [int]$WaitSeconds = 75
)
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class CompileWin2 {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extra);
  public static List<IntPtr> Visible() { var list = new List<IntPtr>(); EnumWindows((h,l)=>{ if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero); return list; }
  public static string Title(IntPtr h) { var sb = new StringBuilder(1024); GetWindowText(h, sb, 1024); return sb.ToString(); }
  public static string Class(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
  public static void Click(int x, int y) { SetCursorPos(x, y); mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); }
}
"@
[void][CompileWin2]::SetProcessDPIAware()

$stamp = Get-Date -Format 'HHmmss'
$workDir = Join-Path $env:TEMP ('agentplc-compile-' + $stamp)
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
$copy = Join-Path $workDir (([System.IO.Path]::GetFileNameWithoutExtension($ProjectPath)) + '.smc2')
Copy-Item -LiteralPath $ProjectPath -Destination $copy -Force
if (-not $ScreenshotPath) { $ScreenshotPath = Join-Path $env:TEMP ('agentplc-compile-' + $stamp + '.png') }
$probeName = [System.IO.Path]::GetFileNameWithoutExtension($copy)

$result = [ordered]@{
  ok = $false
  project = $ProjectPath
  windowTitle = $null
  triggers = @()
  dialogsApproved = @()
  errorCount = $null
  warningCount = $null
  messages = @()
  paneTexts = @()
  screenshot = $null
  error = $null
}
$windowPid = 0
$launcherPid = 0
try {
  $launcher = Start-Process -FilePath $Exe -ArgumentList ('"' + $copy + '"') -PassThru
  $launcherPid = $launcher.Id
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $handle = [IntPtr]::Zero
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    foreach ($h in [CompileWin2]::Visible()) {
      if ([CompileWin2]::Title($h) -like "*$probeName*") { $handle = $h; break }
    }
    if ($handle -ne [IntPtr]::Zero) { break }
  }
  if ($handle -eq [IntPtr]::Zero) { throw 'Sysmac window not found' }
  [void][CompileWin2]::GetWindowThreadProcessId($handle, [ref]$windowPid)
  $result.windowTitle = [CompileWin2]::Title($handle)
  [void][CompileWin2]::ShowWindow($handle, 9)
  [void][CompileWin2]::SetForegroundWindow($handle)
  $rect = New-Object 'CompileWin2+RECT'
  [void][CompileWin2]::GetWindowRect($handle, [ref]$rect)
  [CompileWin2]::Click(($rect.Left + 200), ($rect.Top + 12))
  Start-Sleep -Seconds 3
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)

  function Find-MenuItem([string]$pattern) {
    foreach ($item in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::MenuItem))) {
      try { if ($item.Current.Name -match $pattern) { return $item } } catch { }
    }
    return $null
  }
  function Invoke-ProjectCommand([string]$pattern) {
    $projectMenu = Find-MenuItem '^工程'
    if ($null -eq $projectMenu) { return $null }
    try { $projectMenu.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand() } catch { }
    Start-Sleep -Seconds 2
    $item = Find-MenuItem $pattern
    if ($null -eq $item) { return $null }
    try {
      $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      return ($pattern + ' (' + $item.Current.Name + ')')
    } catch { return $null }
  }

  # A rebuild asks "all programs will be compiled again ... continue?" and blocks until
  # Yes is pressed; answer it, otherwise the rebuild never actually starts.
  function Approve-CompileDialog([int]$TimeoutSeconds = 15) {
    $approved = @()
    $dialogDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $dialogDeadline) {
      Start-Sleep -Milliseconds 800
      foreach ($h in [CompileWin2]::Visible()) {
        $class = [CompileWin2]::Class($h)
        if ($class -notmatch '32770|HwndWrapper') { continue }
        try {
          $dialog = [System.Windows.Automation.AutomationElement]::FromHandle($h)
          $texts = @()
          foreach ($element in $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
            try { if ($element.Current.Name) { $texts += $element.Current.Name } } catch { }
          }
          if (($texts -join ' ') -notmatch '编译') { continue }
          $buttons = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))
          foreach ($button in $buttons) {
            try {
              $name = $button.Current.Name
              if ($name -match '^(是|是\(Y\)|Yes)') {
                $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
                $approved += $name
                break
              }
            } catch { }
          }
        } catch { }
      }
      if ($approved.Count -gt 0) { break }
    }
    return $approved
  }

  # F7 first: "check all programs" surfaces issues a cached build can skip.
  $check = Invoke-ProjectCommand '检查所有程序'
  if ($check) { $result.triggers += $check; Start-Sleep -Seconds 10; $result.dialogsApproved += @(Approve-CompileDialog 6) }
  # Then a full rebuild so every program is compiled again.
  $rebuild = Invoke-ProjectCommand '重编译控制器'
  if (-not $rebuild) { $rebuild = Invoke-ProjectCommand '编译控制器' }
  if ($rebuild) {
    $result.triggers += $rebuild
    $result.dialogsApproved += @(Approve-CompileDialog 20)
  } else {
    [System.Windows.Forms.SendKeys]::SendWait('{F8}')
    $result.triggers += 'F8'
    $result.dialogsApproved += @(Approve-CompileDialog 15)
  }

  $paneTexts = @()
  $errorCount = $null
  $warningCount = $null
  $messages = @()
  $paneRect = $null
  $buildDeadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $buildDeadline) {
    Start-Sleep -Seconds 3
    $paneRect = $null
    $paneTexts = @()
    try {
      foreach ($element in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
        try {
          $name = $element.Current.Name
          $type = $element.Current.ControlType
        } catch { continue }
        if ($type -eq [System.Windows.Automation.ControlType]::Pane -and $name -eq '编译') {
          $paneRect = $element.Current.BoundingRectangle
          continue
        }
        if ($null -ne $paneRect -and $name -and $name.Length -gt 0) { $paneTexts += $name }
      }
    } catch { }
    $messages = @()
    for ($index = 0; $index -lt $paneTexts.Count; $index++) {
      $text = $paneTexts[$index]
      if ($text -eq '错误' -and $index -gt 0 -and $paneTexts[$index - 1] -match '^\d+$') { $errorCount = [int]$paneTexts[$index - 1] }
      if ($text -eq '警告' -and $index -gt 0 -and $paneTexts[$index - 1] -match '^\d+$') { $warningCount = [int]$paneTexts[$index - 1] }
      if ($text -match '^line\s+(\d+),\s*column\s+(\d+)$') {
        # Row order in the pane: index number, message, program, "line N, column M".
        $program = if ($index -ge 1) { $paneTexts[$index - 1] } else { '' }
        $message = if ($index -ge 2) { $paneTexts[$index - 2] } else { '' }
        $messages += [pscustomobject]@{ text = $message; program = $program; location = $text; line = [int]$matches[1]; column = [int]$matches[2] }
      }
    }
    if ($messages.Count -gt 0) { break }
    if (((Get-Date) -lt $buildDeadline) -and ((Get-Date) -gt ($buildDeadline.AddSeconds(-40)))) { break }
  }
  # Final re-read: the pane often shows 0/0 before the rebuild populates it.
  Start-Sleep -Seconds 6
  $paneTexts = @()
  $errorCount = $null
  $warningCount = $null
  $messages = @()
  try {
    foreach ($element in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
      try { $name = $element.Current.Name; $type = $element.Current.ControlType } catch { continue }
      if ($type -eq [System.Windows.Automation.ControlType]::Pane -and $name -eq '编译') { $paneRect = $element.Current.BoundingRectangle; continue }
      if ($null -ne $paneRect -and $name -and $name.Length -gt 0) { $paneTexts += $name }
    }
  } catch { }
  for ($index = 0; $index -lt $paneTexts.Count; $index++) {
    $text = $paneTexts[$index]
    if ($text -eq '错误' -and $index -gt 0 -and $paneTexts[$index - 1] -match '^\d+$') { $errorCount = [int]$paneTexts[$index - 1] }
    if ($text -eq '警告' -and $index -gt 0 -and $paneTexts[$index - 1] -match '^\d+$') { $warningCount = [int]$paneTexts[$index - 1] }
    if ($text -match '^line\s+(\d+),\s*column\s+(\d+)$') {
      $program = if ($index -ge 1) { $paneTexts[$index - 1] } else { '' }
      $message = if ($index -ge 2) { $paneTexts[$index - 2] } else { '' }
      $messages += [pscustomobject]@{ text = $message; program = $program; location = $text; line = [int]$matches[1]; column = [int]$matches[2] }
    }
  }
  $result.errorCount = $errorCount
  $result.warningCount = $warningCount
  $result.messages = @($messages)
  $result.paneTexts = @($paneTexts | Select-Object -Unique -First 200)
  $result.errorCount = $errorCount
  $result.warningCount = $warningCount
  $result.messages = @($messages)

  [void][CompileWin2]::GetWindowRect($handle, [ref]$rect)
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  $graphics.Dispose()
  $bitmap.Save($ScreenshotPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  $result.screenshot = $ScreenshotPath
  $result.ok = $true
} catch {
  $result.error = $_.Exception.Message
} finally {
  foreach ($h in [CompileWin2]::Visible()) {
    if ([CompileWin2]::Title($h) -notlike "*$probeName*") { continue }
    $pidForWindow = 0
    [void][CompileWin2]::GetWindowThreadProcessId($h, [ref]$pidForWindow)
    if ($pidForWindow -gt 0) {
      try {
        $target = Get-Process -Id $pidForWindow -ErrorAction SilentlyContinue
        if ($target -and $target.MainWindowTitle -like "*$probeName*") { Stop-Process -Id $pidForWindow -Force -ErrorAction SilentlyContinue }
      } catch { }
    }
  }
  if ($launcherPid -gt 0) { try { Stop-Process -Id $launcherPid -Force -ErrorAction SilentlyContinue } catch { } }
  [System.IO.File]::WriteAllText($ResultPath, ($result | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
  Start-Sleep -Seconds 2
  try { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue } catch { }
}
