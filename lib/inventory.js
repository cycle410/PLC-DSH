import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { parseSysmacProject, variablesToCsv } from './smc2.js'

const SYSMAc_RE = /\.(smc2|csm2|smc)$/i
const TIA_DIRECTORY = /\.(ap|zap)(\d{2})$/i
const TIA_ARCHIVE = /\.zap(\d{2})$/i
const ST_SOURCE = /\.st$/i
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'appdata',
  'windows',
  'system volume information',
  '$recycle.bin',
  'programdata',
  'program files',
  'program files (x86)',
])

function expandRoot(input) {
  if (typeof input !== 'string' || input.trim() === '') return undefined
  let text = input.trim()
  if (text === '~') text = homedir()
  else if (text.startsWith('~/') || text.startsWith('~\\')) text = join(homedir(), text.slice(2))
  const absolute = resolve(text)
  return existsSync(absolute) ? absolute : undefined
}

/** Directories the project inventory walks: only what the user configured, no implicit defaults. */
export function resolveScanRoots(config = {}) {
  const configured = Array.isArray(config.projectRoots) ? config.projectRoots : []
  return configured.map(expandRoot).filter(Boolean)
}

function kindOfName(name, isDirectory) {
  if (!isDirectory && SYSMAc_RE.test(name)) return { kind: 'sysmac', version: null }
  if (!isDirectory && ST_SOURCE.test(name)) return { kind: 'st', version: null }
  if (isDirectory) {
    const tia = TIA_DIRECTORY.exec(name)
    if (tia) return { kind: 'tia', version: `V${tia[2]}` }
  } else {
    const archive = TIA_ARCHIVE.exec(name)
    if (archive) return { kind: 'tia', version: `V${archive[2]}` }
  }
  return undefined
}

/** Breadth-first bounded walk: enough to find projects without timing out a panel request. */
export function scanProjects(config = {}) {
  const roots = resolveScanRoots(config)
  const depthLimit = Number.isFinite(config.scanDepth) ? Math.max(1, Math.min(12, config.scanDepth)) : 6
  const resultLimit = Number.isFinite(config.scanLimit) ? Math.max(1, Math.min(5000, config.scanLimit)) : 1000
  const projects = []
  const seen = new Set()
  let visited = 0
  let truncated = false

  for (const root of roots) {
    const queue = [{ directory: root, depth: 0 }]
    while (queue.length > 0 && projects.length < resultLimit) {
      const { directory, depth } = queue.shift()
      const key = directory.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      visited += 1
      if (visited > 20000) {
        truncated = true
        break
      }
      let entries
      try {
        entries = readdirSync(directory, { withFileTypes: true })
      } catch {
        continue
      }
      // A TIA Portal project is a folder (any name) holding <name>.ap<version> next to System/.
      const tiaProjectFile = entries.find((entry) => entry.isFile() && /\.(ap|zap)\d{2}$/i.test(entry.name))
      const looksLikeTiaProject =
        tiaProjectFile !== undefined &&
        entries.some((entry) => entry.isDirectory() && /^(System|IM|XRef|AdditionalFiles)$/i.test(entry.name))
      if (looksLikeTiaProject && depth > 0) {
        let stat
        try {
          stat = statSync(directory)
        } catch {
          stat = undefined
        }
        const version = /\.(ap|zap)(\d{2})$/i.exec(tiaProjectFile.name)
        projects.push({
          id: Buffer.from(directory.toLowerCase()).toString('base64url').slice(0, 24),
          path: directory,
          kind: 'tia',
          version: version ? `V${version[2]}` : null,
          name: basename(directory),
          isDirectory: true,
          projectFile: join(directory, tiaProjectFile.name),
          sizeBytes: null,
          modifiedAt: (stat ?? { mtime: new Date() }).mtime.toISOString(),
        })
        if (projects.length >= resultLimit) {
          truncated = true
          break
        }
        // Project internals are TIA's own database; do not walk into them.
        continue
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue
        const path = join(directory, entry.name)
        const isDirectory = entry.isDirectory()
        const kind = kindOfName(entry.name, isDirectory)
        if (kind) {
          let stat
          try {
            stat = statSync(path)
          } catch {
            continue
          }
          projects.push({
            id: Buffer.from(path.toLowerCase()).toString('base64url').slice(0, 24),
            path,
            kind: kind.kind,
            version: kind.version,
            name: basename(entry.name).replace(/\.(smc2|csm2|smc|st|ap\d{2}|zap\d{2})$/i, ''),
            isDirectory,
            sizeBytes: isDirectory ? null : stat.size,
            modifiedAt: stat.mtime.toISOString(),
          })
          if (projects.length >= resultLimit) {
            truncated = true
            break
          }
          continue
        }
        if (isDirectory && depth + 1 <= depthLimit && !SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) {
          queue.push({ directory: path, depth: depth + 1 })
        }
      }
    }
  }

  projects.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
  return {
    roots,
    depthLimit,
    resultLimit,
    truncated,
    visitedDirectories: visited,
    projects,
    scannedAt: new Date().toISOString(),
  }
}

function insideRoots(path, roots) {
  const normalized = path.toLowerCase()
  return roots.some((root) => {
    const base = resolve(root).toLowerCase()
    return normalized === base || normalized.startsWith(base.endsWith('\\') ? base : `${base}\\`)
  })
}

/** One parsed project, cached by path and modification time. */
export function createProjectStore(config = {}) {
  const cache = new Map()
  const scanCache = { at: 0, value: undefined }

  function inventory(refresh = false) {
    if (!refresh && scanCache.value !== undefined && Date.now() - scanCache.at < 15000) return scanCache.value
    scanCache.value = scanProjects(config)
    scanCache.at = Date.now()
    return scanCache.value
  }

  /** A TIA project is either a .apNN/.zapNN file or a folder holding one beside System/. */
  function tiaProjectInfo(absolute, stat) {
    if (!stat.isDirectory()) {
      const file = /\.(?:ap|zap)(\d{2})$/i.exec(absolute)
      return file ? { version: `V${file[1]}`, projectFile: absolute } : undefined
    }
    let entries = []
    try {
      entries = readdirSync(absolute, { withFileTypes: true })
    } catch {
      entries = []
    }
    const file = entries.find((entry) => entry.isFile() && /\.(?:ap|zap)\d{2}$/i.test(entry.name))
    if (!file) return undefined
    const match = /\.(?:ap|zap)(\d{2})$/i.exec(file.name)
    return { version: `V${match[1]}`, projectFile: join(absolute, file.name) }
  }

  function allowed(path) {
    if (typeof path !== 'string' || path.trim() === '') return { error: 'A project path is required.' }
    const absolute = resolve(path.trim())
    if (!existsSync(absolute)) return { error: `Path does not exist: ${absolute}` }
    const stat = statSync(absolute)
    let kind = kindOfName(basename(absolute), stat.isDirectory())
    let projectFile
    if (!kind) {
      const tia = tiaProjectInfo(absolute, stat)
      if (!tia) return { error: `Not an OMRON .smc2, TIA Portal .ap/.zap, or .st source path: ${absolute}` }
      kind = { kind: 'tia', version: tia.version }
      projectFile = tia.projectFile
    } else if (kind.kind === 'tia') {
      const tia = tiaProjectInfo(absolute, stat)
      projectFile = tia?.projectFile
      if (tia) kind = { kind: 'tia', version: tia.version }
    }
    const roots = resolveScanRoots(config)
    if (!insideRoots(absolute, roots)) {
      return {
        error: `Path is outside the scanned roots (${roots.join(', ')}). Add its directory to the agentplc projectRoots setting.`,
      }
    }
    return { absolute, kind: kind.kind, version: kind.version, projectFile, stat }
  }

  function inspect(path) {
    const target = allowed(path)
    if (target.error) return { ok: false, error: target.error }
    const { absolute, kind, stat } = target
    const cacheKey = `${absolute.toLowerCase()}|${stat.mtimeMs}|${kind}`
    const cached = cache.get(cacheKey)
    if (cached) return { ok: true, project: cached }

    if (kind === 'tia') {
      const project = {
        kind: 'tia',
        path: absolute,
        projectFile: target.projectFile ?? null,
        name: basename(absolute).replace(/\.(?:ap|zap)\d{2}$/i, ''),
        version: target.version ? `V${String(target.version).replace(/^V/i, '')}` : null,
        sizeBytes: stat.isDirectory() ? null : stat.size,
        modifiedAt: stat.mtime.toISOString(),
        isDirectory: stat.isDirectory(),
        note:
          'TIA Portal 工程由博途自己管理的工程数据库；读取或修改必须通过 TIA Openness。' +
          '使用 plc_tia 工具（action=plan 先审查，action=run 执行）。',
      }
      cache.set(cacheKey, project)
      return { ok: true, project }
    }

    if (kind === 'st') {
      const text = readFileSync(absolute, 'utf8')
      const project = {
        kind: 'st',
        path: absolute,
        name: basename(absolute).replace(/\.st$/i, ''),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        lines: text.split('\n').length,
        source: text.slice(0, 60000),
        blocks: [...text.matchAll(/^\s*(FUNCTION_BLOCK|PROGRAM|TYPE)\s+(\w+)/gim)].map((match) => ({
          type: match[1].toUpperCase(),
          name: match[2],
        })),
        note: 'ST 源文件可转换为 Sysmac Studio 可导入的 IEC 61131-10 XML。',
      }
      cache.set(cacheKey, project)
      return { ok: true, project }
    }

    try {
      const project = parseSysmacProject(absolute, { maxVariables: 6000 })
      cache.set(cacheKey, project)
      return { ok: true, project }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: `Could not read ${absolute}: ${message}` }
    }
  }

  function csv(path) {
    const inspected = inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'sysmac') {
      return { ok: false, error: 'Variable CSV export is available for OMRON .smc2 projects only.' }
    }
    return {
      ok: true,
      name: `${inspected.project.name}-variables.csv`,
      text: variablesToCsv(inspected.project.variables),
    }
  }

  return { inventory, inspect, csv }
}
