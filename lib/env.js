import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { belongsToWindowsGroup, regQuery, run } from './win.js'

const PROGRAM_FILES = [
  process.env.ProgramFiles ?? 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
]

const DOTNET_BY_RELEASE = [
  [533320, '4.8.1'],
  [528040, '4.8'],
  [461808, '4.7.2'],
  [460798, '4.7'],
  [394802, '4.6.2'],
  [393295, '4.6.1'],
  [379893, '4.6'],
  [378675, '4.5.1'],
  [378389, '4.5'],
]

function safeReaddir(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
  } catch {
    return []
  }
}

function findFile(root, fileName, maxDepth) {
  const queue = [{ dir: root, depth: 0 }]
  while (queue.length > 0) {
    const { dir, depth } = queue.shift()
    if (depth > maxDepth) continue
    for (const entry of safeReaddir(dir)) {
      const path = join(dir, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) return path
      if (entry.isDirectory() && depth < maxDepth) queue.push({ dir: path, depth: depth + 1 })
    }
  }
  return undefined
}

/** Siemens installs may sit on any fixed drive: C:\Program Files\Siemens or D:\Siemens. */
export function siemensAutomationRoots() {
  const roots = []
  for (const base of PROGRAM_FILES) roots.push(join(base, 'Siemens', 'Automation'))
  for (const letter of 'CDEFGHIJ') {
    roots.push(join(`${letter}:\\`, 'Siemens', 'Automation'))
    roots.push(join(`${letter}:\\`, 'Program Files', 'Siemens', 'Automation'))
  }
  return [...new Set(roots)]
}

/** Every Siemens TIA Portal installation that ships the Openness public API. */
export function detectTiaPortal() {
  const installs = []
  for (const automation of siemensAutomationRoots()) {
    for (const entry of safeReaddir(automation)) {
      if (!entry.isDirectory()) continue
      const match = /^Portal V(\d{2})$/i.exec(entry.name)
      if (!match) continue
      const version = `V${match[1]}`
      const directory = join(automation, entry.name)
      const apis = []
      for (const api of safeReaddir(join(directory, 'PublicAPI'))) {
        if (!api.isDirectory()) continue
        const assembly = join(directory, 'PublicAPI', api.name, 'Siemens.Engineering.dll')
        if (existsSync(assembly)) {
          apis.push({ version: /^V(\d+(?:\.\d+)?)$/i.test(api.name) ? `V${api.name.slice(1)}` : api.name, assembly })
        }
      }
      installs.push({
        version,
        directory,
        apis,
        opennessAssembly: apis.find((api) => api.version === version)?.assembly ?? apis[apis.length - 1]?.assembly ?? null,
        opennessReady: apis.length > 0,
        executable: existsSync(join(directory, 'bin', 'Siemens.Automation.Portal.exe'))
          ? join(directory, 'bin', 'Siemens.Automation.Portal.exe')
          : null,
      })
    }
  }
  installs.sort((left, right) => left.version.localeCompare(right.version))
  return installs
}

/** OMRON Sysmac Studio installations: the IDE itself, not its ProgramData settings folder. */
export function detectSysmacStudio() {
  const roots = [
    join(PROGRAM_FILES[1], 'OMRON'),
    join(PROGRAM_FILES[0], 'OMRON'),
    join(process.env.ProgramData ?? 'C:\\ProgramData', 'OMRON'),
    // Sysmac Studio commonly installs to a drive-root OMRON folder, e.g. D:\OMRON.
    ...'CDEFGHIJ'.split('').map((letter) => join(`${letter}:\\`, 'OMRON')),
  ]
  const installs = []
  const seen = new Set()
  for (const root of roots) {
    for (const entry of safeReaddir(root)) {
      if (!entry.isDirectory()) continue
      if (!/sysmac/i.test(entry.name)) continue
      const directory = join(root, entry.name)
      if (seen.has(directory.toLowerCase())) continue
      seen.add(directory.toLowerCase())
      let executable = null
      for (const candidate of [
        'SysmacStudio.exe',
        'Sysmac Studio.exe',
        join('Bin', 'SysmacStudio.exe'),
        join('Bin', 'Sysmac Studio.exe'),
        join('Sysmac Studio', 'SysmacStudio.exe'),
      ]) {
        const path = join(directory, candidate)
        if (existsSync(path)) {
          executable = path
          break
        }
      }
      installs.push({ directory, executable, ready: Boolean(executable), dataOnly: executable === null })
    }
  }
  return installs
}

/** .NET Framework 4.x release number mapped to its product version. */
export async function detectDotNetFramework() {
  const release = Number(await regQuery('HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full', 'Release'))
  if (!Number.isFinite(release) || release <= 0) return { ready: false, version: null, release: null }
  const entry = DOTNET_BY_RELEASE.find(([minimum]) => release >= minimum)
  return { ready: entry !== undefined, version: entry ? entry[1] : null, release }
}

async function detectPowerShell() {
  const modern = await run('where.exe', ['pwsh.exe'])
  return {
    windowsPowerShell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    pwsh: modern.ok && modern.stdout.trim() ? modern.stdout.split(/\r?\n/)[0].trim() : null,
  }
}

/**
 * One snapshot of the machine's PLC engineering toolchain. Everything is probed
 * defensively: an absent tool is a fact to report, never an exception.
 */
export async function detectEnvironment() {
  const [dotnet, powerShell, opennessGroup, sysmacGroup] = await Promise.all([
    detectDotNetFramework(),
    detectPowerShell(),
    belongsToWindowsGroup('Siemens TIA Openness'),
    belongsToWindowsGroup('OMRON'),
  ])
  const tia = detectTiaPortal()
  const sysmac = detectSysmacStudio()
  const tiaApis = tia.flatMap((install) => install.apis.map((api) => ({ ...api, portal: install.version })))
  const projectDirs = [
    join(homedir(), 'Documents'),
    join(homedir(), 'Desktop'),
    join(homedir(), 'OneDrive', 'Documents'),
  ].filter((directory) => existsSync(directory))

  return {
    platform: process.platform,
    windows: process.platform === 'win32',
    tiaPortal: {
      installed: tia.length > 0,
      installs: tia.map((install) => ({
        version: install.version,
        directory: install.directory,
        executable: install.executable,
        opennessReady: install.opennessReady,
        apis: install.apis,
      })),
      apis: tiaApis,
      latest: tia.length > 0 ? tia[tia.length - 1].version : null,
      opennessReady: tiaApis.length > 0,
      userInOpennessGroup: opennessGroup ?? null,
      automationReady: tiaApis.length > 0 && opennessGroup === true,
      enablement:
        opennessGroup === true
          ? null
          : {
              group: 'Siemens TIA Openness',
              command: `net localgroup "Siemens TIA Openness" ${process.env.USERNAME ?? '<user>'} /add`,
              note: 'Run that in an elevated PowerShell, then sign out and sign back in: the new group only applies to a fresh logon token.',
            },
      note:
        tia.length === 0
          ? 'No Siemens TIA Portal installation was found on this machine.'
          : tiaApis.length === 0
            ? 'TIA Portal is installed but no Siemens.Engineering.dll was found under PublicAPI.'
            : opennessGroup === false
              ? 'Openness assemblies are installed, but the current Windows user is not in the "Siemens TIA Openness" group.'
              : 'TIA Portal Openness looks ready for automation.',
    },
    sysmacStudio: {
      installed: sysmac.some((install) => install.ready),
      installs: sysmac.filter((install) => install.ready),
      dataFolders: sysmac.filter((install) => install.dataOnly).map((install) => install.directory),
      userInOmronGroup: sysmacGroup ?? null,
      note:
        sysmac.some((install) => install.ready)
          ? 'Sysmac Studio found. Offline .smc2 inspection works with or without the IDE.'
          : 'No OMRON Sysmac Studio IDE was found; .smc2 projects can still be inspected offline.',
    },
    runtime: {
      dotnetFramework: dotnet,
      powerShell,
      node: process.versions.node,
      projectDirs,
    },
    hints: [
      tia.some((install) => install.opennessReady)
        ? 'Use plc_tia with action "plan" to review the Openness command, then action "run".'
        : 'TIA Openness automation needs TIA Portal plus the "Siemens TIA Openness" Windows group.',
      'Use plc_sysmac to list and inspect .smc2 projects offline; it reads POU sources and variable tables without Sysmac Studio.',
    ],
    probedAt: new Date().toISOString(),
  }
}

/** Keep one bounded snapshot per process; a stale toolchain is only a display fact. */
export function createEnvironmentCache(ttlMs = 60000) {
  let cached
  let at = 0
  return async function environment(refresh = false) {
    const now = Date.now()
    if (!refresh && cached !== undefined && now - at < ttlMs) return cached
    cached = await detectEnvironment()
    at = now
    return cached
  }
}

export { statSync }
