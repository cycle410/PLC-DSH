import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { parseSysmacProject } from './smc2.js'
import { ZipArchive } from './zip.js'
import { writeZip } from './zip-write.js'

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Sysmac stores each source line as `&#xD;` followed by a real newline. */
function encodeStText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => escapeXml(line))
    .join('&#xD;\n')
}

function sanitizeCell(value) {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .trim()
}

/** Rebuild one global SLWD table, keeping the template's header lines. */
function buildSlwd(headerLines, variables) {
  const rows = variables.map((variable) => {
    const cells = []
    if (variable.dataType) cells.push(`D=${sanitizeCell(variable.dataType)}`)
    cells.push(`N=${sanitizeCell(variable.name)}`)
    if (variable.address) cells.push(`AT=${sanitizeCell(variable.address)}`)
    if (variable.initialValue) cells.push(`IV=${sanitizeCell(variable.initialValue)}`)
    if (variable.constant) cells.push('Const=1')
    cells.push(`G=${sanitizeCell(variable.scope || 'VAR_GLOBAL')}`)
    if (variable.comment) cells.push(`Com=${escapeXml(sanitizeCell(variable.comment))}`)
    if (variable.networkPublish) cells.push(`NTP=${sanitizeCell(variable.networkPublish)}`)
    if (variable.retain) cells.push('R=1')
    if (variable.readOnly) cells.push('RO=1')
    return `++${cells.join('\t')}`
  })
  return `${[...headerLines, ...rows].join('\r\n')}\r\n`
}

function slwdHeader(text) {
  const lines = text.split(/\r?\n/)
  const header = []
  for (const line of lines) {
    if (line.trim().startsWith('++')) break
    header.push(line.replace(/\s+$/, ''))
  }
  while (header.length > 0 && header[header.length - 1] === '') header.pop()
  return header
}

function replaceSolutionName(oem, projectName) {
  const pattern = /(<Entity\b[^>]*type="Solution"[^>]*\bname=")([^"]*)(")/
  if (!pattern.test(oem)) return { text: oem, replaced: false }
  return { text: oem.replace(pattern, `$1${escapeXml(projectName)}$3`), replaced: true }
}

function replaceController(manifest, controller) {
  if (!controller) return { text: manifest, replaced: false }
  // The manifest carries the controller inside an attribute: name="SetUnit NJ501-1500 Ver. 1.47"
  const pattern = /(<ApplicationFeature\b[^>]*\bname="SetUnit\s+)([^"]*)(")/
  if (!pattern.test(manifest)) return { text: manifest, replaced: false }
  return {
    text: manifest.replace(pattern, `$1${escapeXml(controller)}$3`),
    replaced: true,
  }
}

function replaceBodyText(bodyText, stText) {
  const start = bodyText.indexOf('<Text>')
  const end = bodyText.lastIndexOf('</Text>')
  if (start < 0 || end < start) return undefined
  return `${bodyText.slice(0, start + '<Text>'.length)}${encodeStText(stText)}${bodyText.slice(end)}`
}

function normalizePous(input) {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim() !== '')
      .map((entry) => ({ name: entry.name.trim(), stText: typeof entry.stText === 'string' ? entry.stText : '' }))
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, value]) => typeof value === 'string')
      .map(([name, stText]) => ({ name, stText }))
  }
  return []
}

function normalizeVariables(input) {
  if (!Array.isArray(input)) return []
  return input
    .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim() !== '')
    .map((entry) => ({
      name: entry.name.trim(),
      dataType: typeof entry.dataType === 'string' ? entry.dataType.trim() : '',
      address: typeof entry.address === 'string' ? entry.address.trim() : '',
      scope: typeof entry.scope === 'string' ? entry.scope.trim() : 'VAR_GLOBAL',
      comment: typeof entry.comment === 'string' ? entry.comment.trim() : '',
      initialValue: typeof entry.initialValue === 'string' ? entry.initialValue.trim() : '',
      networkPublish: typeof entry.networkPublish === 'string' ? entry.networkPublish.trim() : '',
      retain: entry.retain === true,
      readOnly: entry.readOnly === true,
    }))
}

/**
 * Build a new OMRON Sysmac Studio project from a template: the archive layout,
 * entity tree and GUIDs stay, while the project name, the global variable table,
 * the POU Structured Text bodies and optionally the controller string are replaced.
 */
export function buildSysmacProject(options = {}) {
  const templatePath = options.template ? resolve(options.template) : ''
  if (!templatePath || !existsSync(templatePath)) throw new Error(`Template project not found: ${options.template ?? '(missing)'}`)
  if (!/\.(smc2|csm2)$/i.test(templatePath)) throw new Error('Template must be an .smc2 or .csm2 project archive')
  const projectName = String(options.projectName ?? '').trim() || 'AgentPlcProject'
  const outputPath = resolve(
    options.output || join(dirname(templatePath), `${projectName.replace(/[\\/:*?"<>|]/g, '_')}.smc2`),
  )
  if (existsSync(outputPath) && options.overwrite !== true) {
    throw new Error(`Output already exists: ${outputPath} (pass overwrite: true to replace it)`)
  }
  if (!/\.(smc2|csm2)$/i.test(outputPath)) throw new Error('Output must end in .smc2')
  if (!existsSync(dirname(outputPath))) mkdirSync(dirname(outputPath), { recursive: true })

  const template = parseSysmacProject(templatePath, { maxVariables: 8000 })
  const archive = new ZipArchive(readFileSync(templatePath))
  const names = archive.names()
  const root = names[0].includes('/') ? names[0].slice(0, names[0].lastIndexOf('/')) : names[0]
  const raw = new Map()
  for (const name of names) {
    const buffer = archive.read(name)
    raw.set(name, buffer ?? Buffer.alloc(0))
  }
  const readText = (name) => {
    const buffer = raw.get(name)
    if (!buffer) return undefined
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
    return { text, bom: hasBom }
  }
  const writeText = (name, text, bom) => {
    const body = Buffer.from(text, 'utf8')
    raw.set(name, bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body)
  }

  const warnings = []
  const changes = { projectName: false, controller: false, variables: 0, pous: [] }

  const oemName = `${root}/${root.split('/').pop()}.oem`
  const oem = readText(oemName)
  if (oem) {
    const renamed = replaceSolutionName(oem.text, projectName)
    if (renamed.replaced) {
      writeText(oemName, renamed.text, oem.bom)
      changes.projectName = true
    } else {
      warnings.push('The template has no Solution entity name; the project name was not changed.')
    }
  } else {
    warnings.push('The template .oem manifest was not found; the project name was not changed.')
  }

  if (options.controller) {
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.manifest')) continue
      const manifest = readText(name)
      if (!manifest) continue
      const updated = replaceController(manifest.text, options.controller)
      if (updated.replaced) {
        writeText(name, updated.text, manifest.bom)
        changes.controller = true
        break
      }
    }
    if (!changes.controller) warnings.push('No SetUnit controller string was found in the template manifest.')
  }

  const requestedVariables = normalizeVariables(options.variables)
  const variablesMode = ['replace', 'merge', 'keep'].includes(options.variablesMode) ? options.variablesMode : 'replace'
  if (requestedVariables.length > 0 || variablesMode !== 'replace') {
    const candidates = []
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.xml')) continue
      const entry = readText(name)
      if (!entry || !entry.text.includes('[SLWD')) continue
      if (!entry.text.includes('+GN=VAR_GLOBAL')) continue
      const rows = entry.text.split(/\r?\n/).filter((line) => line.trim().startsWith('++')).length
      candidates.push({ name, entry, rows })
    }
    const target = candidates[0]
    if (!target) {
      warnings.push('The template has no global SLWD variable table; requested variables were not applied.')
    } else {
      const header = slwdHeader(target.entry.text)
      if (header.length === 0) header.push('[SLWD version=1.0]')
      let rows = requestedVariables
      let text = null
      if (variablesMode === 'keep') {
        if (requestedVariables.length > 0) warnings.push('variablesMode "keep" ignored the requested variables.')
        rows = []
      } else if (variablesMode === 'merge') {
        // Append only the new rows: rewriting the template rows drops attributes such as Const.
        const templateGlobal = template.tables.find((table) => table.scope === 'Global')?.variables ?? []
        const existing = new Set(templateGlobal.map((variable) => String(variable.name).toLowerCase()))
        const added = requestedVariables.filter((variable) => !existing.has(String(variable.name).toLowerCase()))
        const original = target.entry.text.replace(/\s+$/, '')
        const appended = added.length > 0 ? buildSlwd([], added).trimEnd() : ''
        text = appended ? `${original}\r\n${appended}\r\n` : `${original}\r\n`
        changes.variables = added.length
        changes.variablesMode = 'merge'
      }
      if (text === null && (rows.length > 0 || variablesMode === 'replace')) {
        text = buildSlwd(header, rows)
        changes.variables = rows.length
        changes.variablesMode = variablesMode
      }
      if (text !== null) writeText(target.name, text, target.entry.bom)
    }
  }

  const requestedPous = normalizePous(options.pous)
  if (requestedPous.length > 0) {
    const byName = new Map(template.pous.map((pou) => [pou.name, pou]))
    for (const requested of requestedPous) {
      const pou = byName.get(requested.name)
      if (!pou) {
        warnings.push(`Template has no POU named "${requested.name}"; its source was not applied.`)
        continue
      }
      let applied = 0
      for (const section of pou.sections) {
        if (section.language !== 'ST') {
          warnings.push(`POU "${pou.name}" section "${section.name}" is ${section.language}, not ST; it was left unchanged.`)
          continue
        }
        const bodyName = `${root}/${section.bodyGuid}.xml`
        const body = readText(bodyName)
        if (!body) {
          warnings.push(`Body entry missing for POU "${pou.name}"; skipped.`)
          continue
        }
        const updated = replaceBodyText(body.text, requested.stText)
        if (updated === undefined) {
          warnings.push(`POU "${pou.name}" body has no <Text> element; skipped.`)
          continue
        }
        writeText(bodyName, updated, body.bom)
        applied += 1
      }
      if (applied > 0) changes.pous.push({ name: pou.name, sections: applied, lines: requested.stText.split('\n').length })
    }
  }

  const entries = names.map((name) => ({
    name,
    data: raw.get(name) ?? Buffer.alloc(0),
    store: name.endsWith('/') || (raw.get(name)?.length ?? 0) === 0,
  }))
  writeFileSync(outputPath, writeZip(entries))

  const rebuilt = parseSysmacProject(outputPath, { maxVariables: 8000 })
  return {
    path: outputPath,
    sizeBytes: statSync(outputPath).size,
    projectName: rebuilt.projectName ?? rebuilt.name,
    template: templatePath,
    changes,
    warnings,
    verification: {
      readable: true,
      projectName: rebuilt.name,
      cpu: rebuilt.cpu,
      pous: rebuilt.pous.map((pou) => ({
        name: pou.name,
        language: pou.language,
        stLines: pou.stLines,
        rungCount: pou.rungCount,
      })),
      variableCount: rebuilt.variableCount,
      tables: rebuilt.tables.map((table) => ({ name: table.name, scope: table.scope, count: table.count })),
      notes: rebuilt.notes,
    },
  }
}
