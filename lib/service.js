import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEnvironmentCache } from './env.js'
import { createProjectStore, resolveScanRoots } from './inventory.js'
import { describeInventory, filterInventory, inventorySysmac, inventoryTia, inventoryToCsv } from './io-inventory.js'
import { addUserRoot, loadUserRoots, removeUserRoot, rootsStorePath } from './roots-store.js'
import { buildSysmacProject } from './smc2-write.js'
import { verifySysmacProject } from './sysmac-verify.js'
import { compileWithSysmac } from './sysmac-compile.js'
import { convertSt, convertStToText, converterReady, detectPython, readStSource } from './st.js'
import { describeTia, planTia, runTia } from './tia.js'

const MAX_TOOL_JSON = 60000

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXAMPLE_DIR = join(PLUGIN_ROOT, 'examples')

/**
 * The bundled demo template lives outside the scanned roots, so allow it as a
 * read-only template without weakening the roots rule for arbitrary paths.
 */
function bundledExampleTemplate(input) {
  if (typeof input !== 'string' || input.trim() === '') return undefined
  if (!/\.smc2$/i.test(input.trim())) return undefined
  const candidate = resolve(input.trim())
  const rel = relative(EXAMPLE_DIR, candidate)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return undefined
  return existsSync(candidate) ? candidate : undefined
}

function clip(text, max) {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max)}\n... (truncated at ${max} characters)` : value
}

/** Tool data must stay parseable JSON, so an oversized payload degrades into a bounded preview. */
function jsonBlock(value) {
  let text
  try {
    text = JSON.stringify(value)
  } catch {
    text = '"unserializable result"'
  }
  if (text.length <= MAX_TOOL_JSON) return text
  return JSON.stringify({
    truncated: true,
    note: `The full result was ${text.length} characters; narrow the request to see all of it.`,
    preview: text.slice(0, 8000),
  })
}

/** Every tool answers with one sentence plus JSON text, so the schema has one shared shape. */
function toolOutput(dataDescription) {
  return {
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'summary', 'data'],
      properties: {
        ok: { type: 'boolean' },
        summary: { type: 'string' },
        data: { type: 'string', description: dataDescription },
      },
    },
    render: (_args, value) => [{ type: 'text', text: value.summary }],
  }
}

function toolResult(ok, summary, data) {
  return { ok, summary, data: jsonBlock(data) }
}

const SIMATIC_BLOCK_KIND = {
  PlcFunctionBlock: 'FB',
  PlcFunction: 'FC',
  PlcOrganizationBlock: 'OB',
  PlcGlobalDB: 'DB',
  PlcInstanceDB: 'InstanceDB',
  PlcBackgroundDB: 'InstanceDB',
}

/** Short block kind from the Openness CLR type name (TypeIdentifier is empty on V16 blocks). */
function blockKind(entry) {
  const value = String(entry ?? '')
  return SIMATIC_BLOCK_KIND[value] ?? (value === '' ? 'block' : value)
}

/**
 * Turn the readBlocks export list into parsed interfaces and remove the temp directory.
 * Shared by the plc_tia tool and the panel's block-interface route.
 */
async function finalizeReadBlocks(data) {
  const { parseBlockInterface } = await import('./simatic-interface.js')
  for (const block of data.blocks ?? []) {
    if (!block.file) continue
    if (block.exportError) {
      block.interfaceError = /Inconsistent/i.test(block.exportError)
        ? 'The block is inconsistent (it has compile errors), so TIA refuses to export it; fix the errors and read it again.'
        : block.exportError
      delete block.file
      continue
    }
    try {
      const parsed = parseBlockInterface(readFileSync(block.file, 'utf8'))
      block.sections = parsed.sections
      if (parsed.error) block.interfaceError = parsed.error
    } catch (error) {
      block.interfaceError = error instanceof Error ? error.message : String(error)
    }
    delete block.file
  }
  if (data.directory) {
    try {
      rmSync(data.directory, { recursive: true, force: true })
    } catch {
      // A leftover temp directory is not worth failing the read.
    }
    delete data.directory
  }
  return data
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function download(body, mediaType, fileName) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': mediaType,
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

/** Panel-facing projection of a parsed project: no bulk source text, bounded samples. */
function projectSummary(project) {
  if (project.kind === 'sysmac') {
    const { variables, ...rest } = project
    return {
      ...rest,
      pous: project.pous.map(({ stText, sections, ...pou }) => ({
        ...pou,
        stChars: stText === undefined ? 0 : stText.length,
        sections: sections.map(({ stText: sectionText, rungs, ...section }) => ({
          ...section,
          stChars: sectionText === undefined ? 0 : sectionText.length,
          rungsPreview: rungs.slice(0, 8).map((rung) => (rung.comment ? `${rung.text}   // ${rung.comment}` : rung.text)),
        })),
      })),
      tables: project.tables.map(({ variables: rows, ...table }) => table),
      variableSample: variables.slice(0, 400),
      variableSampleSize: Math.min(variables.length, 400),
      variableSampleLimited: variables.length > 400,
    }
  }
  if (project.kind === 'st') {
    return { ...project, source: clip(project.source, 12000), sourceTruncated: (project.source ?? '').length >= 12000 }
  }
  return project
}

export class AgentPlcService {
  constructor(ctx, config = {}) {
    this.ctx = ctx
    this.config = { ...(config ?? {}) }
    this.configRoots = Array.isArray(this.config.projectRoots) ? [...this.config.projectRoots] : []
    this.refreshRoots()
    this.environment = createEnvironmentCache(60000)
    this.pythonCache = undefined
    /** IO inventory is expensive for TIA (one TIA launch); keep the last read for two minutes. */
    this.ioCache = new Map()
  }

  /** Merge profile-configured roots with the user-level store and rebuild the scanner. */
  refreshRoots() {
    const userRoots = loadUserRoots()
    this.config.projectRoots = [...new Set([...this.configRoots, ...userRoots])]
    this.store = createProjectStore(this.config)
    return { config: this.configRoots, user: userRoots, effective: this.config.projectRoots }
  }

  async env(refresh = false) {
    return this.environment(refresh)
  }

  async python(refresh = false) {
    if (!refresh && this.pythonCache !== undefined) return this.pythonCache
    this.pythonCache = await detectPython(refresh)
    return this.pythonCache
  }

  async state(refresh = false) {
    const [environment, python] = await Promise.all([this.env(refresh), this.python(refresh)])
    const inventory = this.store.inventory(refresh)
    return {
      generatedAt: new Date().toISOString(),
      roots: inventory.roots,
      truncated: inventory.truncated,
      visitedDirectories: inventory.visitedDirectories,
      projects: inventory.projects,
      counts: {
        total: inventory.projects.length,
        sysmac: inventory.projects.filter((project) => project.kind === 'sysmac').length,
        tia: inventory.projects.filter((project) => project.kind === 'tia').length,
        st: inventory.projects.filter((project) => project.kind === 'st').length,
      },
      environment,
      converter: { ready: converterReady(), python: python ? `${python.command} ${python.version}` : null },
    }
  }

  project(path) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    return { ok: true, project: projectSummary(inspected.project) }
  }

  pou(path, name) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'sysmac') return { ok: false, error: 'POU sources are available for OMRON .smc2 projects.' }
    const pou = inspected.project.pous.find((candidate) => candidate.name === name)
    if (!pou) {
      return {
        ok: false,
        error: `POU not found: ${name}`,
        available: inspected.project.pous.map((candidate) => candidate.name),
      }
    }
    return {
      ok: true,
      pou: {
        name: pou.name,
        type: pou.type,
        language: pou.language,
        sectionCount: pou.sectionCount,
        stLines: pou.stLines,
        rungCount: pou.rungCount,
        stText: pou.stText === undefined ? undefined : clip(pou.stText, 200000),
        sections: pou.sections.map((section) => ({
          name: section.name,
          bodyGuid: section.bodyGuid,
          language: section.language,
          rungCount: section.rungCount,
          rungsTruncated: section.rungs.length > 400,
          stLines: section.stLines,
          stText: section.stText === undefined ? undefined : clip(section.stText, 200000),
          stTextTruncated: section.stText === undefined ? false : section.stText.length >= 200000,
          rungs: section.rungs
            .slice(0, 400)
            .map((rung) => ({ text: rung.text, comment: rung.comment, stText: rung.stText === undefined ? undefined : clip(rung.stText, 4000) })),
        })),
      },
    }
  }

  async stSource(path) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'st') return { ok: false, error: 'This path is not an .st source file.' }
    return { ok: true, source: readStSource(inspected.project.path), name: inspected.project.name }
  }

  async stXml(path, format = 'iec61131-10') {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'st') return { ok: false, error: 'ST conversion needs an .st source file.' }
    return convertStToText(inspected.project.path, format)
  }

  csv(path) {
    return this.store.csv(path)
  }

  /** Offline lint for one .smc2 project: undeclared names, duplicates, addresses, unbalanced blocks. */
  verify(path) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'sysmac') return { ok: false, error: 'Static verification is available for OMRON .smc2 projects.' }
    try {
      return { ok: true, result: verifySysmacProject(inspected.project.path) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Panel entry point: create a project from query parameters (no tool call involved). */
  async createProject(options = {}) {
    const inspected = this.store.inspect(options.template)
    const example = inspected.ok ? undefined : bundledExampleTemplate(options.template)
    if (!inspected.ok && !example) return { ok: false, error: inspected.error }
    if (inspected.ok && inspected.project.kind !== 'sysmac') return { ok: false, error: 'A create template must be an OMRON .smc2 project.' }
    const templatePath = inspected.ok ? inspected.project.path : example
    const projectName = options.projectName && String(options.projectName).trim() !== '' ? options.projectName : example ? 'AgentPLC_项目' : undefined
    let output = options.output && String(options.output).trim() !== '' ? options.output : undefined
    if (!output && example) {
      const documents = join(homedir(), 'Documents')
      mkdirSync(documents, { recursive: true })
      output = join(documents, `${projectName}.smc2`)
    }
    const result = buildSysmacProject({
      template: templatePath,
      output,
      projectName,
      controller: options.controller,
      variablesMode: options.variablesMode,
      variables: options.variables,
      pous: options.pous,
      overwrite: options.overwrite === true,
    })
    const newPous = Array.isArray(options.newPous) ? options.newPous : []
    if (newPous.length > 0) {
      try {
        const { addPousToProject } = await import('./smc2-add-pou.js')
        const pouResult = addPousToProject({ template: result.path, output: result.path, pous: newPous, overwrite: true })
        result.newPous = pouResult.added
      } catch (error) {
        try {
          const { rmSync } = await import('node:fs')
          rmSync(result.path, { force: true })
        } catch {
          // Nothing to clean up.
        }
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
    const verification = verifySysmacProject(result.path)
    result.verification = verification
    let compiled
    if (options.compile === true) {
      compiled = await this.compile(result.path)
      result.vendorCompile = compiled
    }
    // ok means "the file was built". Static-check errors or a failing vendor compile are
    // reported alongside it, so the panel can show them instead of a bare HTTP 400.
    return {
      ok: true,
      built: true,
      path: result.path,
      sizeBytes: result.sizeBytes,
      projectName: result.projectName,
      newPous: result.newPous ?? [],
      backupPath: result.backupPath ?? null,
      verification,
      verificationErrors: verification.errors,
      verificationWarnings: verification.warnings,
      compile: compiled
        ? {
            ok: compiled.ok,
            errorCount: compiled.errorCount,
            warningCount: compiled.warningCount,
            messages: compiled.messages,
            error: compiled.error,
          }
        : null,
    }
  }

  /** Bundled .smc2 templates, offered by the panel even when no project is scanned yet. */
  examples() {
    const examples = []
    try {
      for (const name of readdirSync(EXAMPLE_DIR)) {
        if (name.toLowerCase().endsWith('.smc2')) examples.push({ name, path: join(EXAMPLE_DIR, name), bundled: true })
      }
    } catch {
      // The shipped examples folder is optional.
    }
    return { ok: true, examples }
  }

  /** Vendor compile probe: elevated helper copies the project, builds it in Sysmac and OCRs the result. */
  async compile(path, options = {}) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'sysmac') return { ok: false, error: 'The Sysmac compile probe works on OMRON .smc2 projects.' }
    return compileWithSysmac(inspected.project.path, options)
  }

  /** Read one TIA project's devices and blocks through Openness (slow: starts TIA in the background). */
  async tiaList(path) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'tia') return { ok: false, error: 'This path is not a TIA Portal project.' }
    const environment = await this.env()
    const result = await runTia({ action: 'list', projectPath: inspected.project.path, saveProject: false }, environment, {
      timeoutMs: 240000,
    })
    if (!result.ok) {
      return {
        ok: false,
        error: (result.errors ?? []).join(' ') || result.result?.error || result.stderr || 'Openness list failed',
        readiness: result.readiness ?? null,
        enablement: result.enablement ?? result.readiness?.enablement ?? null,
      }
    }
    return { ok: true, project: inspected.project, data: result.result?.data, attempts: result.attempts }
  }

  /** Read one TIA project's PLC tag tables through Openness (slow: starts TIA in the background). */
  async tiaTags(path) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'tia') return { ok: false, error: 'Tag tables are available for TIA Portal projects.' }
    const environment = await this.env()
    const projectPath = inspected.project.path
    const version = /\.ap\d{2}$/i.test(projectPath)
      ? undefined
      : typeof this.config.tiaDefaultVersion === 'string'
        ? this.config.tiaDefaultVersion
        : 'V16'
    const result = await runTia({ action: 'listTags', projectPath, version, saveProject: false }, environment, { timeoutMs: 300000 })
    if (!result.ok) {
      return {
        ok: false,
        error: (result.errors ?? []).join(' ') || result.result?.error || result.stderr || 'Openness listTags failed',
        readiness: result.readiness ?? null,
        enablement: result.enablement ?? result.readiness?.enablement ?? null,
      }
    }
    return { ok: true, project: inspected.project, data: result.result?.data }
  }

  /** One normalized IO table for either controller: OMRON is parsed offline, Siemens needs Openness. */
  async ioInventory(path, options = {}) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    const cacheKey = inspected.project.path
    const cached = this.ioCache.get(cacheKey)
    if (!options.refresh && cached && Date.now() - cached.at < 120000) return cached.result
    let result
    if (inspected.project.kind === 'sysmac') {
      try {
        result = { ok: true, inventory: inventorySysmac(inspected.project.path) }
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    } else if (inspected.project.kind === 'tia') {
      const tags = await this.tiaTags(inspected.project.path)
      result = tags.ok
        ? { ok: true, inventory: inventoryTia(tags.data ?? {}, { project: inspected.project.name, path: inspected.project.path }) }
        : { ok: false, error: tags.error, readiness: tags.readiness, enablement: tags.enablement }
    } else {
      result = { ok: false, error: 'The IO inventory works on OMRON .smc2 and Siemens TIA Portal projects.' }
    }
    if (result.ok) this.ioCache.set(cacheKey, { at: Date.now(), result })
    return result
  }

  /** Read TIA block interfaces for the panel: export the blocks and parse their Simatic ML. */
  async tiaBlocks(path, options = {}) {
    const inspected = this.store.inspect(path)
    if (!inspected.ok) return { ok: false, error: inspected.error }
    if (inspected.project.kind !== 'tia') return { ok: false, error: 'Block interfaces are available for TIA Portal projects.' }
    const environment = await this.env()
    const projectPath = inspected.project.path
    const version = /\.ap\d{2}$/i.test(projectPath)
      ? undefined
      : typeof this.config.tiaDefaultVersion === 'string'
        ? this.config.tiaDefaultVersion
        : 'V16'
    const blocks = Array.isArray(options.blocks) ? options.blocks.filter((name) => typeof name === 'string' && name.trim() !== '') : []
    const limit = typeof options.limit === 'number' ? options.limit : undefined
    const result = await runTia({ action: 'readBlocks', projectPath, blockPaths: blocks, limit, version }, environment, { timeoutMs: 300000 })
    if (!result.ok) {
      return {
        ok: false,
        error: (result.errors ?? []).join(' ') || result.result?.error || result.stderr || 'Openness readBlocks failed',
        readiness: result.readiness ?? null,
      }
    }
    const data = result.result?.data ?? {}
    if (Array.isArray(data.blocks)) await finalizeReadBlocks(data)
    return { ok: true, project: inspected.project.name, data }
  }

  /** Routes the panel reads. Every route is read-only GET data or a generated download. */
  registerRoutes(webServer) {
    const disposers = []
    const route = (path, resource) => {
      disposers.push(webServer.register({ kind: 'exact', path, resource }))
    }
    // Resource routes only answer GET/HEAD, so the create endpoint owns its own request/response.
    const routeHandler = (path, handler) => {
      disposers.push(webServer.register({ kind: 'exact', path, handler }))
    }

    route('/agentplc/api/state', async (request) => {
      const refresh = new URL(request.url).searchParams.get('refresh') === '1'
      try {
        return json(await this.state(refresh))
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/project', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = this.project(path)
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/pou', async (request) => {
      const url = new URL(request.url)
      try {
        const result = this.pou(url.searchParams.get('path'), url.searchParams.get('name'))
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/variables.csv', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = this.csv(path)
        if (!result.ok) return json(result, 400)
        return download(`\uFEFF${result.text}`, 'text/csv; charset=utf-8', result.name)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/st-xml', async (request) => {
      const url = new URL(request.url)
      const path = url.searchParams.get('path')
      const format = url.searchParams.get('format') === 'plcopen' ? 'plcopen' : 'iec61131-10'
      try {
        const result = await this.stXml(path, format)
        if (!result.ok) return json(result, 400)
        const suffix = format === 'plcopen' ? '.plcopen.xml' : '.sysmac.xml'
        return download(result.xml, 'application/xml; charset=utf-8', `${result.name}${suffix}`)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/st-source', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = await this.stSource(path)
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/tia/list', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = await this.tiaList(path)
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/tia/blocks', async (request) => {
      const params = new URL(request.url).searchParams
      const path = params.get('path')
      const block = params.get('block')
      const limitParam = Number(params.get('limit'))
      try {
        const result = await this.tiaBlocks(path, {
          blocks: block ? [block] : undefined,
          limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
        })
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/io', async (request) => {
      const params = new URL(request.url).searchParams
      const path = params.get('path')
      try {
        const result = await this.ioInventory(path, { refresh: params.get('fresh') === '1' })
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/io.csv', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = await this.ioInventory(path)
        if (!result.ok) return json(result, 400)
        return download(inventoryToCsv(result.inventory), 'text/csv; charset=utf-8', `${result.inventory.project || 'agentplc'}-io.csv`)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/sysmac/verify', async (request) => {
      const path = new URL(request.url).searchParams.get('path')
      try {
        const result = this.verify(path)
        return json(result, result.ok ? 200 : 400)
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/pick-folder', async () => {
      try {
        const { mkdtempSync, writeFileSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const { run } = await import('./win.js')
        const directory = mkdtempSync(join(tmpdir(), 'agentplc-pick-'))
        const script = join(directory, 'pick.vbs')
        writeFileSync(
          script,
          'Set shell = CreateObject("Shell.Application")\n' +
            'Set folder = shell.BrowseForFolder(0, "Select a PLC project folder", 0)\n' +
            'If Not folder Is Nothing Then WScript.Echo folder.Self.Path\n',
          'utf8',
        )
        const result = await run('cscript.exe', ['//nologo', script], { timeoutMs: 90000 })
        const lines = String(result.stdout ?? '').trim().split(/\r?\n/).filter(Boolean)
        const path = lines.length > 0 ? lines[lines.length - 1].trim() : ''
        return json({ ok: Boolean(path), path })
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/roots', async (request) => {
      const params = new URL(request.url).searchParams
      const action = params.get('action')
      let path = params.get('path')
      const path64 = params.get('path64')
      if (path64) {
        try {
          path = Buffer.from(path64, 'base64').toString('utf8')
        } catch {
          // Fall back to the plain path parameter.
        }
      }
      try {
        if (action === 'add' || action === 'remove') {
          if (!path) return json({ ok: false, error: 'path is required for add/remove' }, 400)
          if (action === 'add') {
            const resolved = resolve(path)
            if (!existsSync(resolved)) return json({ ok: false, error: `Folder not found: ${resolved}` }, 400)
            let directory = false
            try {
              directory = statSync(resolved).isDirectory()
            } catch {
              directory = false
            }
            if (!directory) return json({ ok: false, error: `Not a folder: ${resolved}` }, 400)
            addUserRoot(resolved)
          } else {
            removeUserRoot(path)
          }
          const roots = this.refreshRoots()
          return json({ ok: true, ...roots, store: rootsStorePath() })
        }
        return json({ ok: true, config: this.configRoots, user: loadUserRoots(), effective: this.config.projectRoots, store: rootsStorePath() })
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    route('/agentplc/api/examples', async () => {
      try {
        return json(this.examples())
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
      }
    })

    const writeJson = (res, status, value) => {
      const text = JSON.stringify(value)
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(text),
      })
      res.end(text)
    }

    routeHandler('/agentplc/api/create', async (req, res) => {
      // POST carries the whole request as JSON so ST bodies never travel in a URL; GET stays as a fallback.
      const parseJson = (raw, field) => {
        if (!raw) return undefined
        try {
          return JSON.parse(raw)
        } catch {
          throw new Error(`Invalid JSON in the "${field}" parameter.`)
        }
      }
      try {
        let input
        if (req.method === 'POST') {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 4_000_000) {
              writeJson(res, 413, { ok: false, error: 'The request body is larger than 4 MB.' })
              return
            }
            chunks.push(chunk)
          }
          let body
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            writeJson(res, 400, { ok: false, error: 'The request body is not valid JSON.' })
            return
          }
          input = body && typeof body === 'object' ? body : {}
        } else {
          const params = new URL(req.url ?? '', 'http://localhost').searchParams
          input = {
            template: params.get('template') ?? undefined,
            output: params.get('output') ?? undefined,
            projectName: params.get('projectName') ?? undefined,
            controller: params.get('controller') ?? undefined,
            variablesMode: params.get('variablesMode') ?? undefined,
            variables: parseJson(params.get('variables'), 'variables'),
            pous: parseJson(params.get('pous'), 'pous'),
            newPous: parseJson(params.get('newPous'), 'newPous') ?? [],
            compile: params.get('compile') === 'true',
            overwrite: params.get('overwrite') === 'true',
          }
        }
        const result = await this.createProject({
          template: input.template,
          output: input.output,
          projectName: input.projectName,
          controller: input.controller,
          variablesMode: input.variablesMode,
          variables: input.variables,
          pous: input.pous,
          newPous: Array.isArray(input.newPous) ? input.newPous : [],
          compile: input.compile === true,
          overwrite: input.overwrite === true,
        })
        writeJson(res, result.ok ? 200 : 400, result)
      } catch (error) {
        writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    })

    return () => disposers.forEach((dispose) => dispose())
  }

  registerTools(tools) {
    const disposers = []
    disposers.push(tools.register(this.#environmentTool()))
    disposers.push(tools.register(this.#sysmacTool()))
    disposers.push(tools.register(this.#stTool()))
    disposers.push(tools.register(this.#tiaTool()))
    disposers.push(tools.register(this.#ioTool()))
    return () => disposers.forEach((dispose) => dispose())
  }

  #environmentTool() {
    return {
      name: 'plc_env',
      description:
        'Detect this machine\'s PLC engineering toolchain before promising automation: Siemens TIA Portal installations with the Openness assembly, ' +
        'the current user\'s "Siemens TIA Openness" group membership, OMRON Sysmac Studio, .NET Framework, Windows PowerShell, Python 3, ' +
        'and the directories scanned for projects. Read-only.',
      parameters: {
        refresh: { type: 'boolean', description: 'Probe again instead of using the cached snapshot (cache lives 60 seconds).' },
      },
      output: toolOutput('The full detection snapshot as JSON.'),
      execute: async (args) => {
        const environment = await this.env(args?.refresh === true)
        const python = await this.python()
        const data = {
          tiaPortal: environment.tiaPortal,
          sysmacStudio: environment.sysmacStudio,
          runtime: environment.runtime,
          python: python ? `${python.command} ${python.version}` : null,
          converterReady: converterReady(),
          scanRoots: resolveScanRoots(this.config),
        }
        const summary = [
          environment.tiaPortal.installed
            ? `TIA Portal ${environment.tiaPortal.installs.map((install) => install.version).join('/')} installed; ` +
              `Openness APIs ${environment.tiaPortal.apis.map((api) => `${api.version}@${api.portal}`).join(', ') || 'missing'}; ` +
              `Openness group ${environment.tiaPortal.userInOpennessGroup === true ? 'member' : environment.tiaPortal.userInOpennessGroup === false ? 'not a member (automation blocked)' : 'unknown'}` +
              `${environment.tiaPortal.enablement ? `; enable with "${environment.tiaPortal.enablement.command}" in an elevated shell, then sign out and back in` : ''}.`
            : 'TIA Portal: not installed.',
          environment.sysmacStudio.installed ? 'OMRON Sysmac Studio: installed.' : 'OMRON Sysmac Studio: not installed (offline .smc2 reading and creation still work).',
          `Python 3: ${python ? python.version : 'not found'} (needed for ST to Sysmac XML conversion).`,
          `Scanning ${data.scanRoots.length} project root(s).`,
        ].join(' ')
        return toolResult(true, summary, data)
      },
    }
  }

  #sysmacTool() {
    return {
      name: 'plc_sysmac',
      description:
        'Work with OMRON Sysmac Studio projects offline: list projects under the scanned roots, summarize one project ' +
        '(controller, tasks, POUs with language and line counts, variable tables), filter its variable table, read one POU body ' +
        '(ST source or ladder rungs), and CREATE a new .smc2 project from a template .smc2 by writing your ST bodies and global ' +
        'variable table into it. Reading and creation need no Sysmac Studio installation; the produced .smc2 opens in Sysmac Studio. ' +
        'Rules that keep generated programs compilable: (1) the global variable table accepts only ordinary data types (BOOL/INT/REAL/...); ' +
        'function-block instances such as TON belong in the POU-local table with scope VAR. (2) Every global variable used by a program must ' +
        'also be declared in that POU with scope VAR_EXTERNAL (same name and type) — otherwise Sysmac reports 未定义的标识符. ' +
        '(3) ST only: ladder editing and IO assignment (AT addresses) are NOT automated; tasks cannot be created or their periods changed, ' +
        'though a new program can be attached to an existing task by name. ' +
        '(4) Prefer compile:true and fix the compiler errors it returns; warnings are usually ignorable. ' +
        '(5) create with autoFix:true adds the missing VAR_EXTERNAL mirrors for new programs before writing (declarations only).',
      parameters: {
        action: {
          type: 'string',
          required: true,
          enum: ['scan', 'overview', 'variables', 'pou', 'export-variables', 'create', 'verify', 'compile', 'design'],
          description:
            'scan: list projects. overview: summarize one project. variables: filter one project\'s variables. ' +
            'pou: read one POU body. export-variables: write the variable table as CSV. ' +
            'create: write a new .smc2 project from a template plus your ST bodies and variables. ' +
            'verify: run the offline static check on one project (undeclared names, duplicate variables, duplicate addresses, unbalanced blocks). ' +
            'design: read-only inventory for planning (existing POUs, global variables with IO addresses, tasks) — no file is written. ' +
            'compile: ask Sysmac Studio to run "check all programs" (F7) and "rebuild controller" on a copy of the project, then read the compiler messages back (requires confirming one UAC prompt).',
        },
        path: { type: 'string', description: 'Absolute .smc2 path; required for overview/variables/pou/export-variables.' },
        pou: { type: 'string', description: 'POU name for action "pou", as listed by action "overview".' },
        query: { type: 'string', description: 'Case-insensitive filter over variable name, data type, address and comment (action "variables").' },
        limit: { type: 'integer', description: 'Maximum rows for action "variables" (default 120, max 1000).' },
        output: {
          type: 'string',
          description:
            'For export-variables: CSV path (defaults next to the project). For create: the new .smc2 path ' +
            '(defaults to the template directory with the project name).',
        },
        template: {
          type: 'string',
          description:
            'Action "create": absolute .smc2 template path, normally found with action "scan". ' +
            'The bundled examples/AgentPLC_Demo.smc2 is accepted as a fallback (no scan root needed); with it, output defaults to Documents.',
        },
        projectName: { type: 'string', description: 'Action "create": project name written into the new archive.' },
        controller: {
          type: 'string',
          description: 'Action "create": controller model string, such as "NX502-1600 Ver. 1.66". Omit to keep the template controller.',
        },
        variablesMode: {
          type: 'string',
          enum: ['replace', 'merge', 'keep'],
          description:
            'Action "create": how the global variable table is written. replace (default) uses only the supplied variables; ' +
            'merge keeps the template variables and adds/replaces by name; keep leaves the template table untouched.',
        },
        variables: {
          type: 'array',
          description: 'Action "create": global variables to write: name, dataType, optional address, comment, initialValue, networkPublish, retain, readOnly. Only ordinary data types here (BOOL/INT/REAL/...); TON and other function-block instances must go into newPous[].variables with scope VAR.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', required: true },
              dataType: { type: 'string', required: true },
              address: { type: 'string' },
              comment: { type: 'string' },
              initialValue: { type: 'string' },
              networkPublish: { type: 'string' },
              retain: { type: 'boolean' },
              readOnly: { type: 'boolean' },
            },
          },
        },
        pous: {
          type: 'array',
          description: 'Action "create": ST bodies to write into the template\'s existing POUs, matched by name.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', required: true },
              stText: { type: 'string', required: true },
            },
          },
        },
        overwrite: { type: 'boolean', description: 'Action "create": replace an existing output file (default false).' },
        verify: {
          type: 'boolean',
          description:
            'Action "create": run the offline static check on the written archive (default true). ' +
            'The check is not the vendor compiler; it catches undeclared identifiers, duplicate variables, duplicate AT addresses and unbalanced blocks.',
        },
        autoFix: {
          type: 'boolean',
          description:
            'Action "create": before writing, add VAR_EXTERNAL mirrors for globals that newPous bodies use but do not declare (default false). ' +
            'Only declarations are added, matched against the project global table; the ST body and other POUs are untouched, and the vendor compile still decides.',
        },
        keepScreenshot: { type: 'boolean', description: 'Action "compile": keep the Sysmac screenshot used as an OCR fallback (default false).' },
        compile: {
          type: 'boolean',
          description:
            'Action "create": run the vendor compile right after writing the archive (default false). ' +
            'It copies the project, opens Sysmac Studio elevated, runs check-all-programs and rebuild, and returns the real compiler errors. ' +
            'Takes 1-2 minutes and one UAC confirmation; warnings are reported but usually ignorable.',
        },
        newPous: {
          type: 'array',
          description:
            'Action "create": add new POUs by cloning the template program entity (fresh GUIDs, body, local variable table). ' +
            'Task assignment stays with the user: a new program is not attached to any task unless you pass taskName or associateTask:true. ' +
            'Names must not collide with existing POUs or each other. Put local VAR declarations (TON/FB instances) and the VAR_EXTERNAL mirrors ' +
            'of the globals this POU reads/writes into variables, or the program will not compile.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'New POU name, e.g. PRG_NewDemo.' },
              type: { type: 'string', enum: ['Program', 'FunctionBlock'], description: 'POU kind: Program (task-associated, default) or FunctionBlock (called from code).' },
              stText: { type: 'string', description: 'ST body to write into the new POU.' },
              associateTask: {
                type: 'boolean',
                description:
                  'Program only: pass true to attach the new program to the first task (or the taskName when both are given). ' +
                  'Default false — the user assigns tasks in Sysmac Studio, and the result reports whether the POU is attached.',
              },
              taskName: {
                type: 'string',
                description:
                  'Program only: exact task name to attach to, such as "PrimaryTask". Giving a taskName attaches the program even without associateTask.',
              },
              variables: {
                type: 'array',
                description: 'Local variables to append to the new POU table (default type BOOL).',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Variable name.' },
                    dataType: { type: 'string', description: 'IEC type such as BOOL, INT, REAL; function-block types (TON) belong in scope VAR.' },
                    scope: { type: 'string', enum: ['VAR', 'VAR_EXTERNAL'], description: 'VAR (internal, default) or VAR_EXTERNAL (mirror of a global variable used by the program).' },
                    address: { type: 'string', description: 'Optional AT address.' },
                    comment: { type: 'string', description: 'Optional comment.' },
                  },
                },
              },
            },
            required: ['name', 'stText'],
          },
        },
      },
      output: toolOutput('Structured JSON result.'),
      execute: async (args) => {
        const action = String(args?.action ?? '')
        if (action === 'scan') {
          const inventory = this.store.inventory(true)
          const projects = inventory.projects.map((project) => ({
            kind: project.kind,
            name: project.name,
            path: project.path,
            version: project.version,
            modifiedAt: project.modifiedAt,
            sizeBytes: project.sizeBytes,
          }))
          const counts = projects.reduce((total, project) => {
            total[project.kind] = (total[project.kind] ?? 0) + 1
            return total
          }, {})
          return toolResult(
            true,
            `Found ${projects.length} project item(s) under ${inventory.roots.join(', ')}: ${counts.sysmac ?? 0} .smc2, ${counts.tia ?? 0} TIA, ${counts.st ?? 0} .st${inventory.truncated ? ' (scan hit its limit)' : ''}.`,
            { roots: inventory.roots, truncated: inventory.truncated, counts, projects },
          )
        }
        if (action === 'export-variables') {
          const result = this.csv(args?.path)
          if (!result.ok) throw new Error(result.error)
          const target = args?.output ? String(args.output) : undefined
          const inspected = this.store.inspect(args?.path)
          if (!inspected.ok) throw new Error(inspected.error)
          const { writeFileSync } = await import('node:fs')
          const { dirname, join } = await import('node:path')
          const path = target ?? join(dirname(inspected.project.path), `${inspected.project.name}.variables.csv`)
          writeFileSync(path, `\uFEFF${result.text}`, 'utf8')
          return toolResult(true, `Wrote ${result.text.split('\n').length - 1} variable rows to ${path}.`, { path })
        }

        if (action === 'create') {
          const requestedTemplate = args?.template ?? args?.path
          const inspected = this.store.inspect(requestedTemplate)
          const example = inspected.ok ? undefined : bundledExampleTemplate(requestedTemplate)
          if (!inspected.ok && !example) throw new Error(inspected.error)
          if (inspected.ok && inspected.project.kind !== 'sysmac') throw new Error('A create template must be an OMRON .smc2 project.')
          const templatePath = inspected.ok ? inspected.project.path : example
          const exampleName = 'AgentPLC_项目'
          const projectName = typeof args?.projectName === 'string' && args.projectName.trim() !== '' ? args.projectName : example ? exampleName : undefined
          let output = typeof args?.output === 'string' && args.output.trim() !== '' ? args.output : undefined
          if (!output && example) {
            // Writing next to the bundled example would pollute the plugin install.
            const documents = join(homedir(), 'Documents')
            mkdirSync(documents, { recursive: true })
            output = join(documents, `${projectName}.smc2`)
          }
          // Tool arguments may be frozen by the host; clone before autoFix adds declarations.
          const requestedNewPous = (Array.isArray(args?.newPous) ? args.newPous : [])
            .filter((pou) => pou && pou.name)
            .map((pou) => ({ ...pou, variables: Array.isArray(pou.variables) ? [...pou.variables] : [] }))
          let autoFixReport = []
          let autoFixError
          if (args?.autoFix === true && requestedNewPous.length > 0) {
            try {
              const { completeExternalMirrors } = await import('./sysmac-autofix.js')
              autoFixReport = completeExternalMirrors({
                template: templatePath,
                variables: args?.variables,
                variablesMode: args?.variablesMode,
                newPous: requestedNewPous,
              })
            } catch (error) {
              autoFixError = error instanceof Error ? error.message : String(error)
            }
          }
          const result = buildSysmacProject({
            template: templatePath,
            output,
            projectName,
            controller: args?.controller,
            variablesMode: args?.variablesMode,
            variables: args?.variables,
            pous: args?.pous,
            overwrite: args?.overwrite === true,
          })
          result.autoFix = autoFixReport
          if (autoFixError) result.autoFixError = autoFixError
          const written = result.changes.pous.reduce((total, pou) => total + pou.lines, 0)
          if (requestedNewPous.length > 0) {
            try {
              const { addPousToProject } = await import('./smc2-add-pou.js')
              const pouResult = addPousToProject({
                template: result.path,
                output: result.path,
                pous: requestedNewPous,
                overwrite: true,
              })
              result.newPous = pouResult.added
              result.pousAfterCreate = pouResult.pous
              const { statSync } = await import('node:fs')
              result.sizeBytes = statSync(result.path).size
            } catch (error) {
              try {
                const { rmSync } = await import('node:fs')
                rmSync(result.path, { force: true })
              } catch {
                // Leave nothing half-written behind.
              }
              throw error
            }
          }
          let verification
          if (args?.verify !== false) {
            try {
              verification = verifySysmacProject(result.path)
              result.verification = verification
            } catch (error) {
              result.verificationError = error instanceof Error ? error.message : String(error)
            }
          }
          const rewrittenPous = result.changes.pous.map((pou) => pou.name)
          const rewrittenNote =
            rewrittenPous.length > 0
              ? ` (${rewrittenPous.slice(0, 8).join(', ')}${rewrittenPous.length > 8 ? `, +${rewrittenPous.length - 8} more` : ''})`
              : ''
          const autoFixNote =
            autoFixReport.length > 0
              ? `, auto-fix added ${autoFixReport.reduce((total, entry) => total + entry.added.length, 0)} VAR_EXTERNAL mirror(s): ${autoFixReport
                  .map((entry) => `${entry.pou} (${entry.added.join(', ')})`)
                  .join('; ')}`
              : ''
          const autoFixErrorNote = autoFixError ? `, autoFix failed: ${autoFixError}` : ''
          const summary =
            `Created ${result.path} (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB): ` +
            `${result.changes.variables} global variable(s) written (${result.changes.variablesMode ?? 'replace'}), ` +
            `${result.changes.pous.length} POU(s) / ${written} ST line(s) rewritten${rewrittenNote}` +
            `${result.newPous?.length ? `, ${result.newPous.length} new POU(s): ${result.newPous.map((pou) => `${pou.name}${pou.task ? ` (task ${pou.task})` : pou.type === 'Program' ? ' (no task)' : ''}`).join(', ')}` : ''}` +
            autoFixNote +
            autoFixErrorNote +
            `${result.changes.controller ? `, controller "${args.controller}"` : ''}` +
            `${result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : ''}. ` +
            (verification
              ? `Static check: ${verification.errors} error(s), ${verification.warnings} warning(s)` +
                `${verification.issues.length > 0 ? ` — first: ${verification.issues.slice(0, 3).map((issue) => issue.message).join('; ')}` : ''}. `
              : '')
          if (args?.compile === true) {
            // The output may live outside the scanned roots (Documents, %TEMP%); this file was
            // just written by create, so compile it directly instead of re-applying the roots gate.
            const compiled = await compileWithSysmac(result.path, {})
            result.vendorCompile = compiled
            if (!compiled.ok) {
              return toolResult(false, `${summary}Vendor compile could not run: ${compiled.error}`, result)
            }
            const compileMessages = Array.isArray(compiled.messages) ? compiled.messages : []
            const detail = compileMessages
              .slice(0, 4)
              .map((message) => `${message.text} (${message.program || '?'} ${message.location})`)
              .join(' | ')
            const vendorSummary =
              `Vendor compile: ${compiled.errorCount ?? '?'} error(s), ${compiled.warningCount ?? '?'} warning(s)` +
              `${detail ? ` — ${detail}` : ''}.`
            return toolResult(compiled.errorCount === 0, `${summary}${vendorSummary}`, result)
          }
          return toolResult(true, `${summary}Open it in Sysmac Studio to run the vendor compiler.`, result)
        }

        if (action === 'verify') {
          const result = this.verify(args?.path)
          if (!result.ok) throw new Error(result.error)
          const verified = result.result
          const summary =
            `Static check of ${verified.project}: ${verified.errors} error(s), ${verified.warnings} warning(s) ` +
            `across ${verified.stats.pous} POU(s) and ${verified.stats.variables} variable(s).` +
            `${verified.issues.length > 0 ? ` First: ${verified.issues.slice(0, 3).map((issue) => issue.message).join('; ')}` : ''}`
          return toolResult(verified.errors === 0, summary, verified)
        }

        if (action === 'compile') {
          const result = await this.compile(args?.path, { keepScreenshot: args?.keepScreenshot === true })
          if (!result.ok) throw new Error(result.error ?? 'The Sysmac compile probe failed.')
          const messages = Array.isArray(result.messages) ? result.messages : []
          const errorCount = typeof result.errorCount === 'number' ? result.errorCount : null
          const warningCount = typeof result.warningCount === 'number' ? result.warningCount : null
          const detail = messages
            .slice(0, 3)
            .map((message) => `${message.text} (${message.program || '?'} ${message.location})`)
            .join(' | ')
          const summary =
            `Sysmac build finished: ${errorCount ?? '?'} error(s), ${warningCount ?? '?'} warning(s)` +
            `${detail ? ` — ${detail}` : ''}` +
            `${!messages.length && Array.isArray(result.errorLines) && result.errorLines.length > 0 ? ` — OCR: ${result.errorLines.slice(0, 2).join(' | ')}` : ''}.`
          const succeeded = errorCount === 0 || (errorCount === null && messages.length === 0)
          return toolResult(succeeded, summary, result)
        }

        if (action === 'design') {
          const { parseSysmacProject } = await import('./smc2.js')
          const inspected = this.store.inspect(args?.path)
          if (!inspected.ok) throw new Error(inspected.error)
          if (inspected.project.kind !== 'sysmac') throw new Error('design works on OMRON .smc2 projects.')
          const parsed = parseSysmacProject(inspected.project.path, { maxVariables: 8000 })
          const globals = (parsed.tables ?? [])
            .filter((table) => table.scope === 'Global')
            .flatMap((table) => table.variables ?? [])
          const design = {
            project: parsed.name ?? parsed.projectName,
            pous: (parsed.pous ?? []).map((pou) => ({ name: pou.name, type: pou.type, language: pou.language, stLines: pou.stLines })),
            tables: (parsed.tables ?? []).map((table) => ({
              name: table.name,
              scope: table.scope,
              varScopes: [...new Set((table.variables ?? []).map((variable) => variable.scope).filter(Boolean))],
              owner: table.owner ?? null,
              count: (table.variables ?? []).length,
            })),
            globals: globals.map((variable) => ({
              name: variable.name,
              dataType: variable.dataType,
              address: variable.address,
              comment: variable.comment,
            })),
            ioCandidates: globals
              .filter((variable) => variable.address)
              .map((variable) => ({ name: variable.name, address: variable.address, dataType: variable.dataType })),
            tasks: (parsed.tasks ?? []).map((task) => ({ name: task.name, type: task.type })),
          }
          return toolResult(
            true,
            `Design inventory for ${design.project}: ${design.pous.length} POU(s), ${design.globals.length} global variable(s), ${design.ioCandidates.length} with an IO address.`,
            design,
          )
        }

        const path = args?.path
        if (!path) throw new Error(`Action "${action}" requires a project path.`)
        if (action === 'overview') {
          const result = this.project(path)
          if (!result.ok) throw new Error(result.error)
          const project = result.project
          const summary = [
            `OMRON project ${project.name}`,
            project.cpu ? `controller ${project.cpu.model}${project.cpu.firmware ? ` firmware ${project.cpu.firmware}` : ''}` : 'controller unknown',
            `${project.pous.length} POU(s)`,
            `${project.variableCount} variable(s) in ${project.tables.length} table(s)`,
            project.tasks.length > 0 ? `tasks: ${project.tasks.map((task) => task.name).join(', ')}` : 'no task metadata',
          ].join('; ')
          return toolResult(true, `${summary}.`, project)
        }
        if (action === 'variables') {
          const inspected = this.store.inspect(path)
          if (!inspected.ok) throw new Error(inspected.error)
          if (inspected.project.kind !== 'sysmac') throw new Error('Variable tables are available for OMRON .smc2 projects.')
          const query = String(args?.query ?? '').trim().toLowerCase()
          const limit = Math.min(1000, Math.max(1, Number(args?.limit ?? 120)))
          const rows = inspected.project.variables.filter((variable) =>
            query === ''
              ? true
              : [variable.name, variable.dataType, variable.address, variable.comment, variable.table]
                  .join(' ')
                  .toLowerCase()
                  .includes(query),
          )
          return toolResult(
            true,
            `${rows.length} of ${inspected.project.variableCount} variable(s) match${query ? ` "${query}"` : ''}; returning ${Math.min(rows.length, limit)}.`,
            { total: rows.length, returned: Math.min(rows.length, limit), variables: rows.slice(0, limit) },
          )
        }
        if (action === 'pou') {
          const name = String(args?.pou ?? '').trim()
          if (!name) throw new Error('Action "pou" requires the pou name.')
          const result = this.pou(path, name)
          if (!result.ok) throw new Error(`${result.error}${result.available ? ` Available: ${result.available.join(', ')}` : ''}`)
          const pou = result.pou
          const summary =
            pou.sectionCount > 1
              ? `POU ${pou.name} (${pou.type}) has ${pou.sectionCount} sections: ${pou.rungCount} ladder rung(s), ${pou.stLines} ST line(s).`
              : pou.language === 'ST'
                ? `POU ${pou.name} (${pou.type}) is Structured Text with ${pou.stLines} line(s).`
                : `POU ${pou.name} (${pou.type}) is ${pou.language} with ${pou.rungCount} rung(s).`
          return toolResult(true, summary, pou)
        }
        throw new Error(`Unknown action: ${action}`)
      },
    }
  }

  #stTool() {
    return {
      name: 'plc_st',
      description:
        'Convert IEC 61131-3 Structured Text sources into XML in one of two standard formats: ' +
        '"iec61131-10" (default) writes the IEC 61131-10 document with the OMRON Smc extension that Sysmac Studio imports; ' +
        '"plcopen" writes a vendor-neutral PLCopen TC6 2.01 document (dataTypes + pous, ST bodies as CDATA). ' +
        'The converter uses the workspace\'s own XSD-validated implementation. ' +
        'Action "scan" lists .st files under the scanned roots; action "convert" writes one XML file and reports the POU/type counts.',
      parameters: {
        action: { type: 'string', required: true, enum: ['scan', 'convert'], description: 'scan: list .st sources. convert: build the XML.' },
        inputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Absolute .st file or directory paths to convert (action "convert").',
        },
        path: { type: 'string', description: 'Single .st file or directory, an alternative to inputs.' },
        output: { type: 'string', description: 'Output XML path; defaults to <source>.sysmac.xml or <source>.plcopen.xml beside the first input.' },
        outputFormat: { // ✅ 已将 format 改为 outputFormat
          type: 'string',
          enum: ['iec61131-10', 'plcopen'],
          description:
            'Output format. iec61131-10: Sysmac Studio import (OMRON Smc namespace). ' +
            'plcopen: PLCopen TC6 2.01, readable by vendor-neutral PLC tooling and analyzers.',
        },
        name: { type: 'string', description: 'Project name recorded in the XML header.' },
        onlyFb: { type: 'boolean', description: 'Emit only data types and function blocks, skipping programs.' },
      },
      output: toolOutput('Structured JSON result.'),
      execute: async (args) => {
        const action = String(args?.action ?? '')
        if (action === 'scan') {
          const inventory = this.store.inventory(true)
          const sources = inventory.projects.filter((project) => project.kind === 'st')
          return toolResult(true, `Found ${sources.length} .st source file(s) under the scanned roots.`, { roots: inventory.roots, sources })
        }
        if (action === 'convert') {
          const inputs = Array.isArray(args?.inputs) && args.inputs.length > 0 ? args.inputs : args?.path ? [args.path] : []
          const format = args?.outputFormat === 'plcopen' ? 'plcopen' : 'iec61131-10' // ✅ 对应的读取逻辑也改为了 args?.outputFormat
          const result = await convertSt({
            inputs,
            output: args?.output,
            name: args?.name,
            format,
            onlyFb: args?.onlyFb === true,
          })
          if (!result.ok) throw new Error(`${result.error ?? 'Conversion failed'}${result.stderr ? `\n${result.stderr}` : ''}`)
          const label = format === 'plcopen' ? 'PLCopen TC6 XML' : 'IEC 61131-10 XML'
          return toolResult(
            true,
            `Wrote ${result.output} (${result.bytes} bytes, ${label}): ${result.dataTypes} data type(s), ${result.functionBlocks} function block(s), ${result.programs} program(s) from ${result.sources.length} source(s).`,
            result,
          )
        }
        throw new Error(`Unknown action: ${action}`)
      },
    }
  }

  #tiaTool() {
    return {
      name: 'plc_tia',
      description:
        'Drive Siemens TIA Portal through the official Openness API from Windows PowerShell: CREATE a new .ap<version> project ' +
        '(optionally with a PLC device and SCL sources), list devices/blocks and PLC types, import SCL external sources and compile ' +
        'the generated blocks, compile the PLC software, export blocks as XML, READ the PLC tag tables (names, addresses, types, comments), ' +
        'READ block interfaces and DB members (readBlocks: input/output/inout/static/temp/constant members with type, start value and comment), ' +
        'DELETE blocks (deleteBlocks: clean up a failed or superseded generated block), ' +
        'or build an SCL OB together with a global DB as Simatic ML XML and import it (createOb: an SCL external source cannot create an OB). ' +
        'action "plan" validates and writes the Openness command file without starting TIA Portal; action "run" executes it. ' +
        'Compile results carry the block, line and the compiler text when TIA provides it, so errors can be fixed directly. ' +
        'SCL external sources are always imported from UTF-8 BOM copies because TIA reads BOM-less files as ANSI (Chinese tag names would be mojibake); autoFix additionally strips trailing // comments that make TIA skip a block. ' +
        'This machine has V16 and V18 installed, and V16 is the default when no version is given. Requires TIA Portal, the Openness option, ' +
        'and the "Siemens TIA Openness" Windows group.',
      parameters: {
        action: { type: 'string', required: true, enum: ['plan', 'run'], description: 'plan: validate and show the command. run: execute it.' },
        operation: {
          type: 'string',
          required: true,
          enum: ['create', 'list', 'compile', 'importScl', 'exportBlocks', 'importBlocks', 'createInstanceDb', 'compileBlock', 'createOb', 'compileUi', 'listTags', 'readBlocks', 'deleteBlocks'],
          description: 'Openness operation to perform.',
        },
        projectPath: {
          type: 'string',
          description: 'TIA project path, such as D:\\Projects\\Line1.ap16. The .ap<version> suffix may be omitted when version is given. For "create" the target must not exist yet.',
        },
        version: {
          type: 'string',
          enum: ['V16', 'V18'],
          description:
            'TIA version for the project when projectPath has no .ap<version> suffix. Defaults to agentplc.tiaDefaultVersion (V16 on this machine). ' +
            'The suffix always wins when the path already carries one.',
        },
        projectName: { type: 'string', description: 'Operation "create": project name (defaults to the projectPath file name).' },
        deviceName: { type: 'string', description: 'PLC device name; defaults to PLC_1 for create and the first PLC for other operations.' },
        deviceOrderNumber: {
          type: 'string',
          description:
            'Operation "create": CPU order number for the device, such as "OrderNumber:6ES7 214-1AG40-0XB0/V4.4". ' +
            'Defaults to an S7-1200 CPU 1214C DC/DC/DC V4.4; use your own CPU order number for real hardware.',
        },
        sourceFiles: { type: 'array', items: { type: 'string' }, description: 'SCL external source files (.scl/.db/.udt) for operation "importScl".' },
        blockPaths: { type: 'array', items: { type: 'string' }, description: 'Block paths such as "Program blocks/FB_Main" for exportBlocks/deleteBlocks; for readBlocks, optional block names to read (all blocks when omitted).' },
        limit: { type: 'number', description: 'Operation "readBlocks": maximum blocks returned (default 30, max 100).' },
        obName: { type: 'string', description: 'Operation "createOb": SCL OB name.' },
        obCode: { type: 'string', description: 'Operation "createOb": SCL body for the OB.' },
        obNumber: { type: 'number', description: 'Operation "createOb": OB number (default 123).' },
        dbName: { type: 'string', description: 'Operation "createOb": optional global DB name that holds the state/time variables.' },
        dbNumber: { type: 'number', description: 'Operation "createOb": DB number (default 124).' },
        dbMembers: {
          type: 'array',
          description: 'Operation "createOb": global DB members (e.g. timer instance and state variables).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Member name.' },
              dataType: { type: 'string', description: 'Data type such as Bool, Int, TON_TIME.' },
            },
          },
        },
        outputDir: { type: 'string', description: 'Directory for exported XML; defaults beside the project.' },
        autoFix: {
          type: 'boolean',
          description:
            'Operation importScl/create: strip trailing // comments from code lines in the temporary import copies (default false). ' +
            'Copies are always written as UTF-8 BOM (TIA reads BOM-less files as ANSI, which breaks Chinese tag names); full-line comments and Chinese identifiers are fine. ' +
            'The original files are not modified, and the result reports the comment count and any blocks the importer skipped.',
        },
        mode: { type: 'string', enum: ['withoutUi', 'withUi'], description: 'Open TIA Portal silently (default) or with its user interface.' },
        saveProject: { type: 'boolean', description: 'Save the project after the operation (default true).' },
      },
      output: toolOutput('Structured JSON result.'),
      execute: async (args) => {
        const environment = await this.env()
        const projectPathHasVersion = /\.ap\d{2}$/i.test(String(args?.projectPath ?? ''))
        const defaultVersion = typeof this.config.tiaDefaultVersion === 'string' ? this.config.tiaDefaultVersion : 'V16'
        const plan = {
          action: args?.operation,
          projectPath: args?.projectPath,
          projectName: args?.projectName,
          deviceName: args?.deviceName,
          deviceOrderNumber: args?.deviceOrderNumber,
          sourceFiles: args?.sourceFiles,
          blockPaths: args?.blockPaths,
          limit: args?.limit,
          outputDir: args?.outputDir,
          mode: args?.operation === 'compileUi' ? 'withUi' : args?.mode,
          saveProject: args?.saveProject,
          version: args?.version ?? (projectPathHasVersion ? undefined : defaultVersion),
          versionSource: args?.version === undefined && !projectPathHasVersion ? 'config' : 'argument',
        }
        if (args?.operation === 'createOb') {
          if (!args?.obName) throw new Error('operation "createOb" requires obName.')
          const { buildSclObXml, buildGlobalDbXml } = await import('./tia-block-xml.js')
          const { mkdtempSync, writeFileSync } = await import('node:fs')
          const { tmpdir } = await import('node:os')
          const { join } = await import('node:path')
          const directory = mkdtempSync(join(tmpdir(), 'agentplc-ob-'))
          const files = []
          if (args?.dbName) {
            const dbFile = join(directory, `${args.dbName}.xml`)
            writeFileSync(
              dbFile,
              buildGlobalDbXml({
                name: args.dbName,
                number: args.dbNumber ?? (700 + (Date.now() % 200)),
                members: Array.isArray(args.dbMembers) ? args.dbMembers : [],
              }),
              'utf8',
            )
            files.push(dbFile)
          }
          const obFile = join(directory, `${args.obName}.xml`)
          writeFileSync(obFile, buildSclObXml({ name: args.obName, number: args.obNumber ?? (600 + (Date.now() % 200)), code: args.obCode ?? '' }), 'utf8')
          files.push(obFile)
          plan.action = 'importBlocks'
          plan.blockPaths = files
        }
        if (String(args?.action) === 'plan') {
          const prepared = planTia(plan, environment)
          const summary = prepared.ok
            ? `Plan ready (${plan.action}): ${prepared.readiness.readinessText} Openness API ${prepared.readiness.assemblyVersion ?? 'unknown'}; command written to ${prepared.commandFile}. TIA Portal was not started.${prepared.warnings.length > 0 ? ` Warnings: ${prepared.warnings.join(' ')}` : ''}${prepared.enablement ? ` To enable automation: ${prepared.enablement.command} (elevated), then sign out and back in.` : ''}`
            : `Plan rejected: ${prepared.errors.join(' ')}`
          return toolResult(prepared.ok, summary, prepared)
        }
        // Always import SCL from UTF-8 BOM copies: TIA reads BOM-less files as ANSI, which
        // turns Chinese tag names into mojibake and fails the import. autoFix additionally
        // strips trailing // comments (the other silent-skip cause).
        let sclPrep
        if ((plan.action === 'importScl' || plan.action === 'create') && Array.isArray(plan.sourceFiles) && plan.sourceFiles.length > 0) {
          const { prepareSclSources } = await import('./scl-autofix.js')
          try {
            sclPrep = prepareSclSources({ files: plan.sourceFiles, stripComments: args?.autoFix === true })
            plan.sourceFiles = sclPrep.files
          } catch (error) {
            plan.autoFixError = error instanceof Error ? error.message : String(error)
          }
        }
        const result = await runTia(plan, environment)
        const state = result.result?.data?.state ?? result.result?.state
        const created = result.result?.data?.path
        const data = result.result?.data ?? {}
        if (sclPrep) {
          const generated = (Array.isArray(data.generated) ? data.generated : []).map((block) => String(block?.name ?? '').toLowerCase())
          data.autoFix = {
            comments: sclPrep.comments,
            encodingFixed: sclPrep.encodingFixed,
            skipped: sclPrep.declaredBlocks.filter((name) => !generated.includes(String(name).toLowerCase())),
          }
          try {
            const { rmSync } = await import('node:fs')
            rmSync(sclPrep.directory, { recursive: true, force: true })
          } catch {
            // Temp copies are disposable.
          }
        }
        // readBlocks exports each block to Simatic ML; parse the interface out of that XML.
        if (result.ok && plan.action === 'readBlocks' && Array.isArray(data.blocks)) {
          await finalizeReadBlocks(data)
        }
        const blockNames = Array.isArray(data.generated) ? data.generated.map((block) => block.name).join(', ') : ''
        const deviceNames = Array.isArray(data.devices) ? data.devices.map((device) => device.name).join(', ') : ''
        const messageCount = Array.isArray(data.messages) ? data.messages.length : 0
        const errorCount = typeof data.errorCount === 'number' ? data.errorCount : null
        const warningCount = typeof data.warningCount === 'number' ? data.warningCount : null
        // Messages are a tree: block nodes carry the block name, leaf nodes carry the offending
        // line and the real text ("Tag \"DB_SD\".Main not defined."). Skip empty block nodes when
        // a message with text is available.
        const meaningfulMessages = Array.isArray(data.messages)
          ? data.messages.filter((message) => (message?.text ?? message?.description ?? message?.message ?? '') !== '')
          : []
        const sourceMessages = meaningfulMessages.length > 0 ? meaningfulMessages : Array.isArray(data.messages) ? data.messages : []
        const messageText = sourceMessages
          .slice(0, 3)
          .map((message) => {
            const text = message?.text ?? message?.description ?? message?.message
            const state = message?.state ?? ''
            const block = message?.block ?? ''
            const path = message?.path ?? ''
            const line = /^\d+$/.test(String(path)) ? path : ''
            const where = block ? ` [${block}${line ? ` line ${line}` : ''}]` : path ? ` [${path}]` : ''
            if (text) return `${state}: ${text}${where}`
            const label = [state, path].filter(Boolean).join(' · ')
            return label || JSON.stringify(message).slice(0, 240)
          })
          .join('; ')
        const baseNote = messageText ? ` ${messageText}` : messageCount > 0 ? ` (${messageCount} compiler message(s))` : ''
        const countNote = errorCount !== null || warningCount !== null ? ` [${errorCount ?? '?'} error(s), ${warningCount ?? '?'} warning(s)]` : ''
        const compileNote = `${baseNote}${countNote}`
        // validatePlan warnings (non-ASCII SCL names, defaulted CPU/version) must survive a direct run too.
        const planWarnings = Array.isArray(result.warnings) ? result.warnings : []
        const warningNote = planWarnings.length > 0 ? ` Warnings: ${planWarnings.slice(0, 2).join(' ')}` : ''
        const summary = result.ok
          ? plan.action === 'create'
            ? `Created ${created}${deviceNames ? ` with device(s) ${deviceNames}` : ''}${blockNames ? `, generated ${blockNames}` : ''}${state ? `, compile ${state}` : ''}${compileNote}.`
            : plan.action === 'list'
              ? `Listed ${Array.isArray(data.devices) ? data.devices.length : 0} device(s)${deviceNames ? `: ${deviceNames}` : ''}${Array.isArray(data.devices) && data.devices[0]?.plc?.blocks ? `; blocks: ${data.devices[0].plc.blocks.map((block) => block.name).join(', ')}` : ''}.`
            : plan.action === 'listTags'
              ? `Read ${Array.isArray(data.tables) ? data.tables.length : 0} tag table(s), ${Array.isArray(data.tables) ? data.tables.reduce((total, table) => total + (Array.isArray(table.tags) ? table.tags.length : 0), 0) : 0} tag(s).`
              : plan.action === 'readBlocks'
                ? `Read ${data.returned ?? (Array.isArray(data.blocks) ? data.blocks.length : 0)} of ${data.total ?? '?'} block(s): ${(data.blocks ?? [])
                    .slice(0, 5)
                    .map((block) => {
                      const counts = (block.sections ?? [])
                        .filter((section) => section.members.length > 0)
                        .map((section) => `${section.name} ${section.members.length}`)
                        .join('/')
                      const error = block.interfaceError ? ' (interface unreadable)' : ''
                      return `${block.name} (${blockKind(block.kind || block.type)}${counts ? `: ${counts}` : ''})${error}`
                    })
                    .join(', ')}${data.truncated ? ' — raise limit to see more' : ''}.`
                : plan.action === 'deleteBlocks'
                  ? `Deleted ${Array.isArray(data.deleted) ? data.deleted.join(', ') : 'block(s)'}${state ? `, compile ${state}` : ''}${compileNote}.`
              : plan.action === 'importBlocks'
              ? `Imported ${Array.isArray(data.imported) ? data.imported.join(', ') : 'block(s)'}${state ? `, compile ${state}` : ''}${compileNote}.`
              : `${plan.action} finished${state ? ` with state ${state}` : ''}${blockNames ? `; generated ${blockNames}` : ''}${data.exported ? `; ${data.exported.length} block(s) exported` : ''}${compileNote}.`
          : `${plan.action} failed: ${(result.errors ?? []).join(' ') || result.result?.error || result.stderr || 'unknown error'}${result.enablement ? ` To enable automation: ${result.enablement.command} (elevated), then sign out and back in.` : ''}`
        const sclNote = data.autoFix
          ? (() => {
              const parts = []
              if (data.autoFix.encodingFixed > 0) parts.push(`imported from UTF-8 BOM copies (${data.autoFix.encodingFixed} source(s) had no BOM)`)
              if (data.autoFix.comments > 0) parts.push(`removed ${data.autoFix.comments} trailing // comment(s)`)
              if (data.autoFix.skipped.length > 0) parts.push(`blocks the importer skipped: ${data.autoFix.skipped.join(', ')}`)
              return parts.length > 0 ? ` SCL: ${parts.join('; ')}.` : ''
            })()
          : plan.autoFixError
            ? ` autoFix failed: ${plan.autoFixError}.`
            : ''
        const fullSummary = result.ok ? `${summary}${warningNote}${sclNote}` : summary
        return toolResult(result.ok, fullSummary, {
          ok: result.ok,
          command: result.command,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          result: result.result,
          stdout: result.stdout,
          stderr: result.stderr,
          errors: result.errors,
          warnings: planWarnings,
        })
      },
    }
  }

  #ioTool() {
    return {
      name: 'plc_io',
      description:
        'Read the IO picture of one project in one normalized table: every variable or PLC tag whose address is classified as ' +
        '"input", "output", "io" (an IO area whose direction is not in the address, such as CIO), "memory" (D/W/H/A/E/%M) or ' +
        '"internal" (no address). OMRON .smc2 projects are parsed offline and fast; Siemens TIA Portal projects are read through ' +
        'Openness, which starts TIA in the background and takes about 40 seconds. Read-only: this tool never assigns an IO address ' +
        'or a task and never modifies the project. Use it before writing a program so generated code references the real names and ' +
        'addresses that already exist, instead of inventing new ones.',
      parameters: {
        path: { type: 'string', required: true, description: 'Absolute .smc2 file or TIA project path (folder or .ap16/.ap18 file).' },
        direction: {
          type: 'string',
          enum: ['input', 'output', 'io', 'memory', 'internal'],
          description: 'Only return rows with this direction. Omit to get every row.',
        },
        query: { type: 'string', description: 'Case-insensitive filter over name, address, data type, comment, table name and area.' },
        limit: { type: 'number', description: 'Maximum rows returned (default 200, max 2000). The counts always describe the whole project; filter by direction or query on large projects.' },
      },
      output: toolOutput('JSON: platform, project, controller, counts, table list and the filtered rows.'),
      execute: async (args) => {
        const result = await this.ioInventory(args?.path)
        if (!result.ok) throw new Error(result.error)
        const inventory = result.inventory
        const filtered = filterInventory(inventory, {
          direction: args?.direction,
          query: args?.query,
          limit: args?.limit,
        })
        const counts = inventory.counts
        const data = {
          platform: inventory.platform,
          project: inventory.project,
          controller: inventory.controller,
          path: inventory.path,
          counts,
          tables: inventory.tables,
          total: filtered.total,
          returned: filtered.returned,
          rows: filtered.rows,
        }
        const platformLabel = inventory.platform === 'omron' ? 'OMRON' : inventory.platform === 'siemens' ? 'Siemens' : inventory.platform
        const filterNote = filtered.total === counts.total ? '' : `; showing ${filtered.returned} of ${filtered.total} matching row(s)`
        const summary = `${inventory.project || 'project'} (${platformLabel}): ${describeInventory(inventory)}${filterNote}.`
        return toolResult(true, summary, data)
      },
    }
  }

  dispose() {
    this.store = undefined
  }
}

export { describeTia }