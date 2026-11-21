import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPowerShell, windowsPowerShellPath } from './win.js'
import { stripTrailingComments } from './scl-autofix.js'

const here = dirname(fileURLToPath(import.meta.url))
export const DRIVER_PATH = join(here, '..', 'powershell', 'tia-openness.ps1')

const ACTIONS = new Set(['list', 'create', 'compile', 'importScl', 'exportBlocks', 'importBlocks', 'createInstanceDb', 'compileBlock', 'compileUi', 'listTags', 'readBlocks', 'deleteBlocks'])
const SOURCE_EXTENSIONS = /\.(scl|db|udt)$/i

function versionNumber(version) {
  const match = /V?(\d+(?:\.\d+)?)/i.exec(String(version ?? ''))
  return match ? Number.parseFloat(match[1]) : 0
}

/** The Openness assembly a project of the requested TIA version must use. */
export function pickAssembly(environment, apiVersion) {
  const apis = Array.isArray(environment?.tiaPortal?.apis) ? environment.tiaPortal.apis : []
  if (apiVersion) {
    const exact = apis.find((api) => String(api.version).toLowerCase() === String(apiVersion).toLowerCase())
    if (exact) return exact
  }
  return [...apis].sort((left, right) => versionNumber(left.version) - versionNumber(right.version)).pop()
}

/** What the host can currently do with TIA Openness, before any project is opened. */
export function describeTia(environment) {
  const tia = environment?.tiaPortal
  const apis = Array.isArray(tia?.apis) ? tia.apis : []
  const readiness = !tia || !tia.installed
    ? 'missing-tia'
    : apis.length === 0
      ? 'missing-openness'
      : tia.userInOpennessGroup === false
        ? 'missing-group'
        : 'ready'
  return {
    readiness,
    readinessText: {
      'missing-tia': 'TIA Portal is not installed on this machine.',
      'missing-openness': 'TIA Portal is installed but the Openness assembly was not found under PublicAPI.',
      'missing-group': 'The current Windows user is not in the "Siemens TIA Openness" group.',
      ready: 'TIA Openness looks ready for automation.',
    }[readiness],
    versions: [...new Set(apis.map((api) => api.version))],
    apis,
    driverPath: DRIVER_PATH,
    driverShipped: existsSync(DRIVER_PATH),
    powershell: windowsPowerShellPath(),
    userInOpennessGroup: tia?.userInOpennessGroup ?? null,
    enablement: tia?.enablement ?? null,
  }
}

function ensureAbsolute(path, field, errors) {
  if (typeof path !== 'string' || path.trim() === '') {
    errors.push(`${field} is required.`)
    return undefined
  }
  const absolute = isAbsolute(path) ? path : resolve(path)
  return absolute
}

/** Validate the model-supplied plan and normalize defaults before anything runs. */
export function validatePlan(plan, environment) {
  const errors = []
  const warnings = []
  const input = plan && typeof plan === 'object' ? plan : {}
  const action = String(input.action ?? 'list')
  if (!ACTIONS.has(action)) errors.push(`action must be one of ${[...ACTIONS].join(', ')}`)

  let projectPath
  let projectFile
  const requestedVersion = typeof input.version === 'string' ? input.version.trim().toUpperCase() : ''
  if (requestedVersion && !/^V\d{2}$/.test(requestedVersion)) {
    errors.push('version must look like V16 or V18 (the version installed for the project).')
  }
  if (action !== 'list' || input.projectPath) {
    projectPath = ensureAbsolute(input.projectPath, 'projectPath', errors)
    if (projectPath && !/\.ap\d{2}$/i.test(projectPath)) {
      if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
        // A project folder such as ...\LineV16 that holds LineV16.ap16
        let entries = []
        try {
          entries = readdirSync(projectPath).filter((name) => /\.ap\d{2}$/i.test(name))
        } catch {
          entries = []
        }
        if (entries.length === 1) projectPath = join(projectPath, entries[0])
        else if (entries.length > 1) errors.push(`Several .apNN project files are inside ${projectPath}; pass the exact file.`)
        else errors.push(`No .apNN project file was found inside ${projectPath}.`)
      } else if (/^V\d{2}$/.test(requestedVersion)) {
        projectPath = `${projectPath.replace(/[\\/]+$/, '')}.ap${requestedVersion.slice(1)}`
      } else {
        errors.push('projectPath must end in .ap<version>, or pass version such as V16.')
      }
    }
    if (projectPath) {
      const match = /\.ap(\d{2})$/i.exec(projectPath)
      if (match && requestedVersion && `V${match[1]}` !== requestedVersion) {
        warnings.push(`projectPath says ${match[1]} but version says ${requestedVersion}; the project suffix wins.`)
      }
      if (!match) {
        errors.push('projectPath must be a TIA Portal project path ending in .ap<version>, such as Line1.ap16.')
      } else if (action === 'create') {
        if (existsSync(projectPath)) errors.push(`create needs a new target; this one already exists: ${projectPath}`)
      } else if (!existsSync(projectPath)) {
        errors.push(`projectPath does not exist: ${projectPath}`)
      } else if (statSync(projectPath).isDirectory()) {
        // TIA keeps the project file inside the project folder: <folder>/<name>.ap<version>
        const suffix = `.ap${match[1]}`
        let entry
        try {
          entry = readdirSync(projectPath).find((name) => name.toLowerCase().endsWith(suffix))
        } catch {
          entry = undefined
        }
        if (entry) projectFile = join(projectPath, entry)
        else errors.push(`No ${suffix} project file was found inside ${projectPath}.`)
      } else {
        projectFile = projectPath
      }
    }
  }
  if (input.versionSource === 'config' && requestedVersion) {
    warnings.push(`No version was given, so agentplc.tiaDefaultVersion (${requestedVersion}) was used.`)
  }

  const projectVersion = projectPath ? /\.ap(\d{2})$/i.exec(projectPath)?.[1] : undefined
  const sourceFiles = Array.isArray(input.sourceFiles) ? input.sourceFiles : []
  if (action === 'importScl' && sourceFiles.length === 0) errors.push('importScl requires at least one file in sourceFiles.')
  const sources = []
  for (const file of sourceFiles) {
    const absolute = ensureAbsolute(file, 'sourceFiles entry', errors)
    if (!absolute) continue
    if (!SOURCE_EXTENSIONS.test(absolute)) errors.push(`SCL external sources must end in .scl, .db or .udt: ${absolute}`)
    if (!existsSync(absolute)) errors.push(`source file does not exist: ${absolute}`)
    sources.push(absolute)
  }
  // TIA can report Success yet skip an SCL block whose code lines carry trailing // comments.
  for (const source of sources) {
    let text
    try {
      text = readFileSync(source, 'utf8')
    } catch {
      continue
    }
    const trailing = stripTrailingComments(text)
    if (trailing.comments > 0) {
      warnings.push(
        `SCL source ${source} has ${trailing.comments} trailing // comment(s) on code lines; TIA may report Success yet skip the block. ` +
          'autoFix:true removes them in temporary copies, or move each comment onto its own line.',
      )
    }
  }

  const blockPaths = Array.isArray(input.blockPaths) ? input.blockPaths.filter((item) => typeof item === 'string') : []
  if (action === 'exportBlocks' && blockPaths.length === 0) {
    errors.push('exportBlocks requires at least one entry in blockPaths, for example "Program blocks/FB_Main".')
  }
  if (action === 'importBlocks' && blockPaths.length === 0) {
    errors.push('importBlocks requires at least one XML file in blockPaths.')
  }
  if (action === 'deleteBlocks' && blockPaths.length === 0) {
    errors.push('deleteBlocks requires at least one block name or path in blockPaths.')
  }

  let outputDir
  if (input.outputDir) {
    outputDir = isAbsolute(input.outputDir) ? input.outputDir : resolve(input.outputDir)
  } else if (action === 'exportBlocks' && projectPath) {
    outputDir = join(dirname(projectPath), 'agentplc-export')
    warnings.push(`outputDir defaulted to ${outputDir}`)
  }

  const deviceName = typeof input.deviceName === 'string' && input.deviceName.trim() !== '' ? input.deviceName.trim() : undefined
  const deviceOrderNumber =
    typeof input.deviceOrderNumber === 'string' && input.deviceOrderNumber.trim() !== ''
      ? input.deviceOrderNumber.trim()
      : action === 'create'
        ? 'OrderNumber:6ES7 214-1AG40-0XB0/V4.4'
        : undefined
  if (action === 'create' && deviceOrderNumber === 'OrderNumber:6ES7 214-1AG40-0XB0/V4.4') {
    warnings.push('deviceOrderNumber defaulted to a S7-1200 CPU 1214C DC/DC/DC V4.4; pass the order number of your own CPU to change it.')
  }

  const apiVersion = projectVersion ? `V${projectVersion}` : undefined
  const assembly = pickAssembly(environment, apiVersion)
  if (projectVersion && assembly && String(assembly.version).toLowerCase() !== apiVersion.toLowerCase()) {
    warnings.push(`No Openness API for ${apiVersion} was found; using ${assembly.version}. The project may need conversion by its own TIA Portal version.`)
  }

  const tia = describeTia(environment)
  if (tia.readiness !== 'ready') warnings.push(tia.readinessText)

  return {
    errors,
    warnings,
    command: {
      action,
      projectPath,
      projectFile,
      projectName:
        typeof input.projectName === 'string' && input.projectName.trim() !== ''
          ? input.projectName.trim()
          : projectPath
            ? projectPath.slice(projectPath.lastIndexOf('\\') + 1).replace(/\.ap\d{2}$/i, '')
            : undefined,
      deviceName,
      deviceOrderNumber,
      sourceFiles: sources,
      blockPaths,
      limit: typeof input.limit === 'number' ? input.limit : undefined,
      outputDir,
      mode: input.mode === 'withUi' ? 'withUi' : 'withoutUi',
      saveProject: input.saveProject !== false,
      assemblyPath: assembly?.assembly,
    },
    readiness: { ...tia, apiVersion, assemblyVersion: assembly?.version ?? null },
  }
}

function prepare(config) {
  const directory = mkdtempSync(join(tmpdir(), 'agentplc-tia-'))
  const commandFile = join(directory, 'command.json')
  writeFileSync(commandFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', DRIVER_PATH, '-CommandFile', commandFile]
  return { directory, commandFile, commandLine: `"${windowsPowerShellPath()}" ${args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}` }
}

/** Write the Openness command file for review, without starting TIA Portal. */
export function planTia(plan, environment) {
  const validated = validatePlan(plan, environment)
  const prepared = prepare(validated.command)
  return {
    ok: validated.errors.length === 0,
    errors: validated.errors,
    warnings: validated.warnings,
    command: validated.command,
    commandFile: prepared.commandFile,
    commandLine: prepared.commandLine,
    readiness: validated.readiness,
    enablement: validated.readiness.enablement,
  }
}

/** Execute one validated Openness command through Windows PowerShell. */
export async function runTia(plan, environment, options = {}) {
  const validated = validatePlan(plan, environment)
  if (validated.errors.length > 0) {
    return { ok: false, errors: validated.errors, warnings: validated.warnings, command: validated.command }
  }
  if (validated.readiness.readiness !== 'ready') {
    return {
      ok: false,
      errors: [validated.readiness.readinessText],
      warnings: validated.warnings,
      command: validated.command,
      readiness: validated.readiness,
      enablement: validated.readiness.enablement,
    }
  }
  if (!validated.command.assemblyPath) {
    return {
      ok: false,
      errors: ['No TIA Openness assembly matches this project version.'],
      warnings: validated.warnings,
      command: validated.command,
      readiness: validated.readiness,
    }
  }
  if (validated.command.action === 'exportBlocks' && validated.command.outputDir) {
    mkdirSync(validated.command.outputDir, { recursive: true })
  }
  const prepared = prepare(validated.command)
  const startedAt = Date.now()
  let result
  let attempts = 0
  for (attempts = 1; attempts <= 2; attempts += 1) {
    result = await runPowerShell(DRIVER_PATH, ['-CommandFile', prepared.commandFile], {
      timeoutMs: options.timeoutMs ?? 900000,
    }).catch((error) => ({ ok: false, stdout: '', stderr: String(error), json: undefined }))
    const failureText = `${JSON.stringify(result.json ?? {})} ${result.stderr ?? ''}`
    const transient = /Connection to TiaPortal failed|TIA Portal.*not (?:available|reachable)|Could not connect to TIA/i.test(failureText)
    if (result.json?.ok || !transient || attempts === 2) break
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 4000))
  }
  return {
    ok: Boolean(result.json?.ok ?? result.ok),
    durationMs: Date.now() - startedAt,
    attempts,
    warnings: validated.warnings,
    command: validated.command,
    commandFile: prepared.commandFile,
    commandLine: prepared.commandLine,
    exitCode: result.code,
    result: result.json,
    stdout: typeof result.stdout === 'string' ? result.stdout.slice(0, 8000) : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.slice(0, 4000) : '',
  }
}
