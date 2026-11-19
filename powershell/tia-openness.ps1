<#
TIA Portal Openness driver for the DSH AgentPLC plugin.

Reads one JSON command file, performs exactly one engineering action against a
TIA Portal project through the official Openness API, and prints one JSON
document on stdout. Every failure is reported as JSON, never as a PowerShell
error record.

Requirements: TIA Portal with Openness installed, the current Windows user in
the "Siemens TIA Openness" group, and an assemblyPath that matches the project
version (V16 for *.ap16, V18 for *.ap18).
#>
param(
  [Parameter(Mandatory = $true)][string]$CommandFile
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Reply([object]$Payload) {
  $Payload | ConvertTo-Json -Depth 12 -Compress
}

function Get-CompilerState([object]$CompilerResult) {
  if ($null -eq $CompilerResult) { return 'Unknown' }
  try { return "$($CompilerResult.State)" } catch { return 'Unknown' }
}

function Get-CompilerMessages([object]$CompilerResult) {
  $messages = @()
  if ($null -eq $CompilerResult) { return $messages }
  try {
    foreach ($message in $CompilerResult.Messages) {
      $messages += [pscustomobject]@{
        state = "$($message.State)"
        path  = "$($message.Path)"
        text  = "$($message.Text)"
      }
    }
  } catch { }
  return $messages
}

# Openness exposes services through a generic GetService<T>(), which PowerShell
# cannot bind by name; invoke the closed generic method through reflection.
function Get-EngineeringService([object]$Item, [type]$ServiceType) {
  if ($null -eq $Item) { return $null }
  $methods = $Item.GetType().GetMethods([System.Reflection.BindingFlags]'Public, Instance')
  $generic = $methods | Where-Object { $_.Name -eq 'GetService' -and $_.IsGenericMethodDefinition } | Select-Object -First 1
  if ($null -eq $generic) { return $null }
  return $generic.MakeGenericMethod($ServiceType).Invoke($Item, @())
}

function Get-PlcSoftware([object]$Node) {
  $items = $null
  try { $items = $Node.DeviceItems } catch { return $null }
  foreach ($item in $items) {
    $container = Get-EngineeringService -Item $item -ServiceType ([Siemens.Engineering.HW.Features.SoftwareContainer])
    if ($null -ne $container -and $null -ne $container.Software) { return $container.Software }
    $nested = Get-PlcSoftware -Node $item
    if ($null -ne $nested) { return $nested }
  }
  return $null
}

function Get-DevicePlcSoftware([object]$Project, [string]$DeviceName) {
  $fallback = $null
  foreach ($device in $Project.Devices) {
    $software = Get-PlcSoftware -Node $device
    if ($null -eq $software) { continue }
    if (-not $DeviceName) { return $software }
    if ("$($device.Name)" -eq $DeviceName) { return $software }
    if ($null -eq $fallback) { $fallback = $software }
  }
  return $fallback
}

function Get-Blocks([object]$Group) {
  $blocks = @()
  foreach ($block in $Group.Blocks) {
    $blocks += [pscustomobject]@{
      name   = "$($block.Name)"
      number = "$($block.Number)"
      type   = "$($block.TypeIdentifier)"
    }
  }
  foreach ($child in $Group.Groups) {
    $blocks += Get-Blocks -Group $child
  }
  return $blocks
}

function Find-Block([object]$Group, [string]$Path) {
  $segments = $Path -split '/'
  $current = $Group
  for ($index = 0; $index -lt $segments.Length - 1; $index++) {
    $next = $null
    foreach ($child in $current.Groups) {
      if ("$($child.Name)" -eq $segments[$index]) { $next = $child; break }
    }
    if ($null -eq $next) { throw "Block group not found: $($segments[$index])" }
    $current = $next
  }
  $leaf = $segments[$segments.Length - 1]
  foreach ($block in $current.Blocks) {
    if ("$($block.Name)" -eq $leaf) { return $block }
  }
  throw "Block not found: $Path"
}

function Find-BlockAnywhere([object]$Group, [string]$Name) {
  foreach ($block in $Group.Blocks) {
    if ("$($block.Name)" -eq $Name) { return $block }
  }
  foreach ($child in $Group.Groups) {
    $found = Find-BlockAnywhere -Group $child -Name $Name
    if ($null -ne $found) { return $found }
  }
  return $null
}

function Import-SourceFiles([object]$Software, [string[]]$Files) {
  $generated = @()
  $sources = $Software.ExternalSourceGroup.ExternalSources
  foreach ($file in $Files) {
    $info = New-Object System.IO.FileInfo($file)
    if (-not $info.Exists) { throw "Source file not found: $file" }
    $name = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $existing = $sources.Find($name)
    if ($null -ne $existing) { $existing.Delete() }
    $source = $sources.CreateFromFile($name, $info.FullName)
    $objects = $source.GenerateBlocksFromSource([Siemens.Engineering.SW.ExternalSources.GenerateBlockOption]::KeepOnError)
    foreach ($object in $objects) {
      $generated += [pscustomobject]@{ name = "$($object.Name)"; file = "$file"; type = "$($object.GetType().Name)" }
    }
  }
  return $generated
}

function Compile-PlcSoftware([object]$Software) {
  $compileService = Get-EngineeringService -Item $Software -ServiceType ([Siemens.Engineering.Compiler.ICompilable])
  if ($null -eq $compileService) { throw 'The PLC software exposes no ICompilable compile service.' }
  $result = $compileService.Compile()
  return [pscustomobject]@{
    state    = (Get-CompilerState $result)
    messages = @(Get-CompilerMessages $result)
  }
}

$tiaPortal = $null
$project = $null
$action = 'unknown'
try {
  $command = Get-Content -LiteralPath $CommandFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $action = "$($command.action)"
  if (-not $command.assemblyPath) { throw 'No assemblyPath in the command: no TIA Openness API was selected.' }

  [System.Reflection.Assembly]::LoadFrom($command.assemblyPath) | Out-Null
  $mode = [Siemens.Engineering.TiaPortalMode]::WithoutUserInterface
  if ("$($command.mode)" -eq 'withUi') { $mode = [Siemens.Engineering.TiaPortalMode]::WithUserInterface }
  $tiaPortal = New-Object -TypeName Siemens.Engineering.TiaPortal -ArgumentList $mode

  if ($action -eq 'create') {
    $parent = Split-Path -Parent $command.projectPath
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $projectName = "$($command.projectName)"
    if (-not $projectName) { $projectName = [System.IO.Path]::GetFileNameWithoutExtension($command.projectPath) }
    $project = $tiaPortal.Projects.Create((New-Object System.IO.DirectoryInfo($parent)), $projectName)
    $device = $null
    if ($command.deviceOrderNumber) {
      $deviceName = "$($command.deviceName)"
      if (-not $deviceName) { $deviceName = 'PLC_1' }
      $device = $project.Devices.CreateWithItem("$($command.deviceOrderNumber)", $deviceName, $deviceName)
    }
    $generated = @()
    $compiled = $null
    $software = Get-DevicePlcSoftware -Project $project -DeviceName "$($command.deviceName)"
    if ($command.sourceFiles -and $command.sourceFiles.Count -gt 0) {
      if ($null -eq $software) { throw 'The created device has no PLC software to import into.' }
      $generated = @(Import-SourceFiles -Software $software -Files @($command.sourceFiles))
    }
    if ($null -ne $software) {
      try { $compiled = Compile-PlcSoftware -Software $software } catch { }
    }
    if ($command.saveProject) { $project.Save() }
    $devices = @()
    foreach ($item in $project.Devices) {
      $devices += [pscustomobject]@{ name = "$($item.Name)"; type = "$($item.TypeIdentifier)" }
    }
    Write-Reply ([pscustomobject]@{
        ok     = $true
        action = 'create'
        data   = [pscustomobject]@{
          project   = "$($project.Name)"
          path      = "$($project.Path)"
          device    = if ($device) { "$($device.Name)" } else { $null }
          devices   = $devices
          generated = $generated
          state     = if ($compiled) { $compiled.state } else { $null }
          messages  = if ($compiled) { $compiled.messages } else { @() }
        }
      })
    $project.Close()
    $tiaPortal.Dispose()
    exit 0
  }

  $projectFile = "$($command.projectFile)"
  if (-not $projectFile) { $projectFile = "$($command.projectPath)" }
  $project = $tiaPortal.Projects.Open((New-Object System.IO.FileInfo($projectFile)))
  $software = Get-DevicePlcSoftware -Project $project -DeviceName "$($command.deviceName)"
  if ($null -eq $software -and $action -ne 'list') { throw 'No PLC software was found in this project.' }

  switch ($action) {
    'list' {
      $devices = @()
      foreach ($device in $project.Devices) {
        $plc = Get-PlcSoftware -Node $device
        $entry = [pscustomobject]@{
          name = "$($device.Name)"
          type = "$($device.TypeIdentifier)"
          plc  = $null
        }
        if ($null -ne $plc) {
          $entry.plc = [pscustomobject]@{
            name   = "$($plc.Name)"
            blocks = @(Get-Blocks -Group $plc.BlockGroup)
            types  = @($plc.TypeGroup.Types | ForEach-Object { "$($_.Name)" })
          }
        }
        $devices += $entry
      }
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'list'
          data   = [pscustomobject]@{ project = "$($project.Name)"; path = "$($project.Path)"; devices = $devices }
        })
    }
    'compile' {
      $compiled = Compile-PlcSoftware -Software $software
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'compile'
          data   = [pscustomobject]@{
            project  = "$($project.Name)"
            plc      = "$($software.Name)"
            state    = $compiled.state
            messages = $compiled.messages
          }
        })
    }
    'importScl' {
      $generated = @(Import-SourceFiles -Software $software -Files @($command.sourceFiles))
      $compiled = Compile-PlcSoftware -Software $software
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'importScl'
          data   = [pscustomobject]@{
            project  = "$($project.Name)"
            plc      = "$($software.Name)"
            generated = $generated
            state    = $compiled.state
            messages = $compiled.messages
          }
        })
    }
    'exportBlocks' {
      $outputDirectory = "$($command.outputDir)"
      if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
      }
      $exported = @()
      foreach ($blockPath in $command.blockPaths) {
        $block = $null
        try { $block = Find-Block -Group $software.BlockGroup -Path $blockPath } catch { $block = $null }
        if ($null -eq $block) {
          # Paths arrive as English group names; also accept a bare block name found anywhere.
          $leaf = ($blockPath -split '/')[-1]
          $block = Find-BlockAnywhere -Group $software.BlockGroup -Name $leaf
        }
        if ($null -eq $block) { throw "Block not found: $blockPath" }
        $safeName = ($blockPath -replace '[\\/:*?"<>|]', '_')
        $target = Join-Path $outputDirectory ("{0}.xml" -f $safeName)
        $block.Export((New-Object System.IO.FileInfo($target)), [Siemens.Engineering.ExportOptions]::None)
        $exported += [pscustomobject]@{ name = "$($block.Name)"; file = $target }
      }
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'exportBlocks'
          data   = [pscustomobject]@{ project = "$($project.Name)"; plc = "$($software.Name)"; exported = $exported }
        })
    }
    default { throw "Unsupported action: $action" }
  }

  if ($null -ne $project -and $command.saveProject -and $action -ne 'list') { $project.Save() }
  if ($null -ne $project) { $project.Close() }
  if ($null -ne $tiaPortal) { $tiaPortal.Dispose() }
  exit 0
} catch {
  Write-Reply ([pscustomobject]@{
      ok     = $false
      action = $action
      error  = "$($_.Exception.Message)"
      detail = "$($_.ScriptStackTrace)"
    })
  try { if ($null -ne $project) { $project.Close() } } catch { }
  try { if ($null -ne $tiaPortal) { $tiaPortal.Dispose() } } catch { }
  exit 1
}
