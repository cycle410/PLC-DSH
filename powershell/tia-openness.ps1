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
  $messages = New-Object System.Collections.ArrayList
  function Collect-CompilerMessages([object]$node, [string]$block) {
    if ($null -eq $node) { return }
    try {
      foreach ($message in $node.Messages) {
        $path = "$($message.Path)"
        # A purely numeric path is a line inside the enclosing block, not the block itself.
        $isLine = $path -match '^\d+$'
        $blockPath = if (-not $isLine -and $path -ne '') { $path } else { $block }
        [void]$messages.Add([pscustomobject]@{
          state = "$($message.State)"
          path  = $path
          block = $blockPath
          text  = "$($message.Description)"
          date  = "$($message.DateTime)"
        })
        Collect-CompilerMessages $message $blockPath
      }
    } catch { }
  }
  Collect-CompilerMessages $CompilerResult ''
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
      kind   = "$($block.GetType().Name)"
    }
  }
  foreach ($child in $Group.Groups) {
    $blocks += Get-Blocks -Group $child
  }
  return $blocks
}

function Get-BlockObjects([object]$Group) {
  $blocks = @()
  foreach ($block in $Group.Blocks) { $blocks += $block }
  foreach ($child in $Group.Groups) { $blocks += Get-BlockObjects -Group $child }
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
    state        = (Get-CompilerState $result)
    errorCount   = $result.ErrorCount
    warningCount = $result.WarningCount
    messages     = @(Get-CompilerMessages $result)
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
    'readBlocks' {
      $wanted = @()
      if ($command.blockPaths) { $wanted = @($command.blockPaths | ForEach-Object { "$_" }) }
      $limit = 30
      if ($command.limit) { try { $limit = [int]$command.limit } catch { } }
      if ($limit -lt 1) { $limit = 1 }
      if ($limit -gt 100) { $limit = 100 }
      $targets = @()
      if ($wanted.Count -gt 0) {
        foreach ($path in $wanted) {
          $block = $null
          try { $block = Find-Block -Group $software.BlockGroup -Path $path } catch { $block = $null }
          if ($null -eq $block) {
            $leaf = ($path -split '/')[-1]
            $block = Find-BlockAnywhere -Group $software.BlockGroup -Name $leaf
          }
          if ($null -eq $block) { throw "Block not found: $path" }
          $targets += $block
        }
      } else {
        $targets = @(Get-BlockObjects -Group $software.BlockGroup)
      }
      $total = $targets.Count
      # The block interface is not exposed by the Openness object model, so export the
      # selected blocks and let the Host parse the Simatic ML interface out of the XML.
      $directory = Join-Path $env:TEMP ("agentplc-readblocks-" + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $directory -Force | Out-Null
      $entries = @()
      $index = 0
      foreach ($block in ($targets | Select-Object -First $limit)) {
        $index++
        $safeName = ("$($block.Name)" -replace '[\\/:*?"<>|]', '_')
        $file = Join-Path $directory ("{0}_{1}.xml" -f $index, $safeName)
        $entry = [pscustomobject]@{
          name   = "$($block.Name)"
          number = "$($block.Number)"
          type   = "$($block.TypeIdentifier)"
          kind   = "$($block.GetType().Name)"
          file   = $file
        }
        try {
          $block.Export((New-Object System.IO.FileInfo($file)), [Siemens.Engineering.ExportOptions]::None)
        } catch {
          $entry | Add-Member -NotePropertyName exportError -NotePropertyValue "$($_.Exception.Message)"
        }
        $entries += $entry
      }
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'readBlocks'
          data   = [pscustomobject]@{
            project   = "$($project.Name)"
            plc       = "$($software.Name)"
            total     = $total
            returned  = $entries.Count
            truncated = ($total -gt $entries.Count)
            directory = $directory
            blocks    = $entries
          }
        })
    }
    'deleteBlocks' {
      $deleted = @()
      foreach ($blockPath in $command.blockPaths) {
        $block = $null
        try { $block = Find-Block -Group $software.BlockGroup -Path $blockPath } catch { $block = $null }
        if ($null -eq $block) {
          $leaf = ($blockPath -split '/')[-1]
          $block = Find-BlockAnywhere -Group $software.BlockGroup -Name $leaf
        }
        if ($null -eq $block) { throw "Block not found: $blockPath" }
        $name = "$($block.Name)"
        $block.Delete()
        $deleted += $name
      }
      $compiled = Compile-PlcSoftware -Software $software
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'deleteBlocks'
          data   = [pscustomobject]@{
            project      = "$($project.Name)"
            plc          = "$($software.Name)"
            deleted      = $deleted
            state        = $compiled.state
            errorCount   = $compiled.errorCount
            warningCount = $compiled.warningCount
            messages     = $compiled.messages
          }
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
            errorCount   = $compiled.errorCount
            warningCount = $compiled.warningCount
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
    'importBlocks' {
      $imported = @()
      foreach ($blockPath in $command.blockPaths) {
        $file = New-Object System.IO.FileInfo($blockPath)
        if (-not $file.Exists) { throw "Block XML not found: $blockPath" }
        $software.BlockGroup.Blocks.Import($file, [Siemens.Engineering.ImportOptions]::None) | Out-Null
        $imported += $file.Name
      }
      $compiled = Compile-PlcSoftware -Software $software
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'importBlocks'
          data   = [pscustomobject]@{
            project  = "$($project.Name)"
            plc      = "$($software.Name)"
            imported = $imported
            state    = $compiled.state
            messages = $compiled.messages
          }
        })
    }
    'createInstanceDb' {
      $db = $software.BlockGroup.Blocks.CreateInstanceDB("FB_StarDelta_DB", $true, 124, "FB_StarDelta")
      $compiled = Compile-PlcSoftware -Software $software
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'createInstanceDb'
          data   = [pscustomobject]@{
            project  = "$($project.Name)"
            plc      = "$($software.Name)"
            name     = "$($db.Name)"
            state    = $compiled.state
            messages = $compiled.messages
          }
        })
    }
    'compileBlock' {
      $leaf = ($command.blockPaths[0] -split '/')[-1]
      $block = Find-BlockAnywhere -Group $software.BlockGroup -Name $leaf
      if ($null -eq $block) { throw "Block not found: $leaf" }
      $compileService = Get-EngineeringService -Item $block -ServiceType ([Siemens.Engineering.Compiler.ICompilable])
      if ($null -eq $compileService) { throw 'The block exposes no ICompilable compile service.' }
      $compiled = $compileService.Compile()
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'compileBlock'
          data   = [pscustomobject]@{
            project      = "$($project.Name)"
            plc          = "$($software.Name)"
            block        = "$($block.Name)"
            state        = (Get-CompilerState $compiled)
            errorCount   = $compiled.ErrorCount
            warningCount = $compiled.WarningCount
            messages     = @(Get-CompilerMessages $compiled)
          }
        })
    }
    'compileUi' {
      $clickScript = Join-Path $PSScriptRoot 'tia-click-text.ps1'
      $clickResults = @()
      foreach ($label in @('项目视图', 'Project view')) {
        try {
          & $clickScript -TitleFragment "$($project.Name)" -Text $label -Click | Out-Null
          $clickResults += $label
          Start-Sleep -Seconds 2
        } catch { }
      }
      $compiled = Compile-PlcSoftware -Software $software
      Start-Sleep -Seconds 2
      foreach ($label in @('编译结果', 'Compile results')) {
        try {
          & $clickScript -TitleFragment "$($project.Name)" -Text $label | Out-Null
          $clickResults += $label
          Start-Sleep -Seconds 2
        } catch { }
      }
      $ocrScript = Join-Path $PSScriptRoot 'tia-error-ocr.ps1'
      $ocrFile = Join-Path $env:TEMP ('agentplc-tia-ocr-' + [guid]::NewGuid().ToString('N') + '.json')
      $ocr = $null
      try {
        & $ocrScript -TitleFragment "$($project.Name)" -ResultPath $ocrFile -CropBottomFraction 0.5 | Out-Null
        if (Test-Path -LiteralPath $ocrFile) { $ocr = Get-Content -LiteralPath $ocrFile -Raw -Encoding UTF8 | ConvertFrom-Json }
      } catch { }
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'compileUi'
          data   = [pscustomobject]@{
            project      = "$($project.Name)"
            plc          = "$($software.Name)"
            state        = $compiled.state
            errorCount   = $compiled.errorCount
            warningCount = $compiled.warningCount
            messages     = $compiled.messages
            ocrWindow    = if ($ocr) { $ocr.window } else { $null }
            ocrErrors    = if ($ocr) { @($ocr.errorLines) } else { @() }
            screenshot   = if ($ocr) { $ocr.screenshot } else { $null }
            ocrError     = if ($ocr) { $ocr.error } else { 'OCR script produced no result.' }
          }
        })
    }
    'listTags' {
      $tables = @()
      foreach ($table in $software.TagTableGroup.TagTables) {
        $tags = @()
        foreach ($tag in $table.Tags) {
          # Comment is a MultilingualText: "$($tag.Comment)" would print the CLR type name.
          $comment = ''
          try {
            if ($null -ne $tag.Comment) {
              foreach ($item in @($tag.Comment.Items)) {
                if (-not [string]::IsNullOrWhiteSpace($item.Text)) { $comment = "$($item.Text)"; break }
              }
            }
          } catch { $comment = '' }
          $tags += [pscustomobject]@{
            name    = "$($tag.Name)"
            dataType = "$($tag.DataTypeName)"
            address = "$($tag.LogicalAddress)"
            comment = $comment
          }
        }
        $tables += [pscustomobject]@{ name = "$($table.Name)"; tags = $tags }
      }
      Write-Reply ([pscustomobject]@{
          ok     = $true
          action = 'listTags'
          data   = [pscustomobject]@{ project = "$($project.Name)"; plc = "$($software.Name)"; tables = $tables }
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
