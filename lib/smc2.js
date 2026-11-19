import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { ZipArchive } from './zip.js'

/** Decode the XML entities Sysmac Studio writes into table text and ST sources. */
export function decodeXmlEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

const PAIR = /([A-Za-z][A-Za-z0-9]*)=/g

/**
 * SLWD is Sysmac Studio's tab-separated variable table: each record is a row of
 * `key=value` cells, and a repeated key inside one record means the later one wins.
 */
export function parseSlwd(text, options = {}) {
  const { maxVariables = 6000 } = options
  const lines = text.split(/\r?\n/)
  const variables = []
  const notes = []
  let started = false
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!started) {
      if (line.includes('[SLWD')) started = true
      continue
    }
    if (line.trim() === '' || line.trim() === ']') continue
    const record = {}
    for (const cell of line.split('\t')) {
      const cleaned = cell.replace(/^\+/, '')
      if (cleaned === '') continue
      PAIR.lastIndex = 0
      const matches = [...cleaned.matchAll(PAIR)]
      for (let index = 0; index < matches.length; index += 1) {
        const key = matches[index][1]
        const valueStart = matches[index].index + matches[index][0].length
        const valueEnd = index + 1 < matches.length ? matches[index + 1].index : cleaned.length
        record[key] = cleaned.slice(valueStart, valueEnd).trim()
      }
    }
    const keys = Object.keys(record)
    if (keys.length === 0) continue
    if (keys.every((key) => key === 'GN' || key === 'G' || key === 'GVT' || key === '_EN')) continue
    if (record.N === undefined) continue
    if (variables.length >= maxVariables) {
      notes.push(`Variable table truncated at ${maxVariables} records.`)
      break
    }
    variables.push({
      name: record.N,
      dataType: record.D ?? record.DT ?? '',
      address: record.AT ?? '',
      scope: record.G ?? '',
      comment: decodeXmlEntities(record.Com ?? ''),
      initialValue: record.IV ?? '',
      networkPublish: record.NTP ?? '',
      retain: record.R === '1',
      readOnly: record.RO === '1',
    })
  }
  return { variables, notes }
}

function attributesOf(tag) {
  const attributes = {}
  const source = tag.replace(/^<\w+/, '').replace(/\/?>$/, '')
  const pattern = /([\w:.-]+)\s*=\s*"([^"]*)"/g
  let match
  while ((match = pattern.exec(source)) !== null) attributes[match[1]] = match[2]
  return attributes
}

/** Parse the `.oem` entity manifest into a tree, because POUs own their bodies. */
export function parseOemTree(xml) {
  const root = { name: '#document', attributes: {}, children: [], parent: null }
  const stack = [root]
  const pattern = /<Entity\b[^>]*?\/?>|<\/Entity>/g
  let match
  while ((match = pattern.exec(xml)) !== null) {
    const token = match[0]
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const node = {
      name: 'Entity',
      attributes: attributesOf(token),
      children: [],
      parent: stack[stack.length - 1],
    }
    stack[stack.length - 1].children.push(node)
    if (!token.endsWith('/>')) stack.push(node)
  }
  return root
}

export function flattenEntities(root) {
  const list = []
  let index = 0
  const walk = (node, depth, parentIndex) => {
    for (const child of node.children) {
      const current = index
      index += 1
      list.push({ ...child.attributes, depth, index: current, parentIndex })
      walk(child, depth + 1, current)
    }
  }
  walk(root, 0, -1)
  return list
}

/** Collect STRUCT and ENUM definitions carried as XML instead of ST text. */
export function parseDuts(xml) {
  const duts = []
  const headerPattern = /<DataType\b[^>]*BaseType\s*=\s*"(STRUCT|ENUM)"[^>]*>/g
  let header
  while ((header = headerPattern.exec(xml)) !== null) {
    const attributes = attributesOf(header[0])
    const name = attributes.Name ?? attributes.name
    if (!name) continue
    const baseType = (attributes.BaseType ?? attributes.baseType ?? '').toUpperCase()
    const bodyStart = header.index + header[0].length
    const bodyEnd = xml.indexOf('</DataType>', bodyStart)
    const members = []
    if (bodyEnd > 0 && baseType === 'STRUCT') {
      const memberPattern = /<DataType\b[^>]*\/>/g
      const body = xml.slice(bodyStart, bodyEnd)
      let member
      while ((member = memberPattern.exec(body)) !== null) {
        const memberAttributes = attributesOf(member[0])
        const memberName = memberAttributes.Name ?? memberAttributes.name
        if (!memberName) continue
        members.push({
          name: memberName,
          dataType: memberAttributes.BaseType ?? memberAttributes.baseType ?? '',
        })
      }
    }
    duts.push({ name, baseType, members })
  }
  return duts
}

/** One ladder rung as a readable contact / coil line. */
export function formatRung(rung) {
  const cells = Array.isArray(rung?.CLs) ? [...rung.CLs] : []
  cells.sort((left, right) => (left.X ?? 0) - (right.X ?? 0) || (left.Ix ?? 0) - (right.Ix ?? 0))
  return cells.map((cell) => {
    const type = cell.__type
    if (type === 'LD') return cell.Not ? `/${cell.Var ?? '?'}` : `${cell.Var ?? '?'}`
    if (type === 'ST') {
      const name = cell.Var ?? '?'
      if (cell.S) return `(S)${name}`
      if (cell.R) return `(R)${name}`
      if (cell.RS) return `(RS)${name}`
      if (cell.SR) return `(SR)${name}`
      return `(${name})`
    }
    if (type === 'FB') {
      const inputs = (cell.In ?? [])
        .map((pin) => (pin.__type === 'PRM' ? `${pin.Arg}=${pin.Var || '—'}` : `${pin.Arg}=◀能流`))
        .join(', ')
      const outputs = (cell.Out ?? [])
        .filter((pin) => pin.Var || (pin.__type === 'PF' && pin.Arg))
        .map((pin) => (pin.__type === 'PRM' ? `${pin.Arg}=${pin.Var}` : `${pin.Arg}=能流▶`))
        .join(', ')
      const head = `【${cell.Name ?? '?'} ${cell.Var ?? ''}】(${inputs})`
      return outputs ? `${head}  → ${outputs}` : head
    }
    if (type === 'VL') return `VL:${cell.Var ?? ''}`
    if (type === 'HL') return '─'
    if (type === 'IST') {
      const inline = typeof cell.TXT === 'string' ? cell.TXT.replace(/\r/g, '').trim() : ''
      const lines = inline.split('\n').filter((line) => line.trim() !== '')
      return `⟦ST⟧ ${lines[0] ?? ''}${lines.length > 1 ? ' …' : ''}`
    }
    return `<${type}>`
  })
}

function extractStText(bodyXml) {
  const start = bodyXml.indexOf('<Text>')
  const end = bodyXml.lastIndexOf('</Text>')
  if (start < 0 || end < start) return undefined
  return decodeXmlEntities(bodyXml.slice(start + '<Text>'.length, end)).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function parseLadderBody(bodyXml) {
  const rungs = []
  for (const line of bodyXml.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('<')) continue
    try {
      const parsed = JSON.parse(trimmed)
      const inlineSt = (Array.isArray(parsed.CLs) ? parsed.CLs : [])
        .filter((cell) => cell.__type === 'IST' && typeof cell.TXT === 'string')
        .map((cell) => cell.TXT.replace(/\r/g, ''))
        .join('\n\n')
      rungs.push({
        text: formatRung(parsed).join('  '),
        comment: typeof parsed.CMT === 'string' ? parsed.CMT : '',
        stText: inlineSt === '' ? undefined : inlineSt,
      })
    } catch {
      // A rung that is not JSON is not a ladder rung; skip it.
    }
  }
  return rungs
}

function detectCpu(texts) {
  const all = texts.join('\n').slice(0, 400000)
  const setUnit = /SetUnit\s+"?([A-Z0-9][A-Z0-9-]*)\s+Ver\.?\s*([\d.]+)/i.exec(all)
  if (setUnit) {
    return {
      raw: `${setUnit[1]} Ver. ${setUnit[2]}`,
      model: setUnit[1],
      firmware: setUnit[2],
      candidates: [],
      source: 'manifest',
    }
  }
  const matches = [...all.matchAll(/\b(NX\d{3,4}|NJ\d{3,4})(-[A-Z0-9]+)?/gi)].map((match) =>
    match[0].toUpperCase(),
  )
  const candidates = [...new Set(matches)].slice(0, 6)
  const preferred = candidates.find((candidate) => candidate.startsWith('NX')) ?? candidates[0]
  return preferred
    ? { raw: preferred, model: preferred, firmware: null, candidates, inferred: true }
    : null
}

function bodyLanguage(bodyXml) {
  if (bodyXml.includes('StructuredTextModel')) return 'ST'
  if (bodyXml.includes('"CLs"') || bodyXml.includes('"__type"')) return 'Ladder'
  return 'Unknown'
}

/**
 * Read one OMRON Sysmac Studio project archive. The layout is undocumented by
 * OMRON, so every step degrades into a note instead of failing the inspection.
 */
export function parseSysmacProject(filePath, options = {}) {
  const { maxVariables = 6000, maxStChars = 400000 } = options
  const stat = statSync(filePath)
  const archive = new ZipArchive(readFileSync(filePath))
  const notes = [...archive.notes]
  const names = archive.names()
  const root = names[0].includes('/') ? names[0].slice(0, names[0].lastIndexOf('/')) : names[0]
  const rootTail = root.split('/').pop()
  const oemName = `${root}/${rootTail}.oem`
  const oemText = oemName ? archive.text(oemName) ?? '' : ''
  const entities = oemText ? flattenEntities(parseOemTree(oemText)) : []
  const byId = new Map()
  for (const entity of entities) if (entity.id) byId.set(entity.id.toLowerCase(), entity)

  const bodyCache = new Map()
  const readBody = (guid) => {
    if (!guid) return undefined
    const key = guid.toLowerCase()
    if (bodyCache.has(key)) return bodyCache.get(key)
    const text = archive.text(`${root}/${guid}.xml`)
    bodyCache.set(key, text)
    return text
  }

  const namedPous = entities.filter(
    (entity) => /^(Program|FunctionBlock|Function)$/i.test(entity.type ?? '') && (entity.name ?? '') !== '',
  )
  const childrenOf = new Map()
  for (const entity of entities) {
    if (entity.parentIndex === undefined) continue
    const bucket = childrenOf.get(entity.parentIndex) ?? []
    bucket.push(entity)
    childrenOf.set(entity.parentIndex, bucket)
  }
  /** Every ladder/ST body a POU owns: a MultipartLadder program owns one body per section. */
  const descendantBodies = (entity) => {
    const found = []
    const queue = [...(childrenOf.get(entity.index) ?? [])]
    while (queue.length > 0) {
      const current = queue.shift()
      if (/^PouBody$/i.test(current.type ?? '')) {
        found.push(current)
        continue
      }
      queue.push(...(childrenOf.get(current.index) ?? []))
    }
    return found
  }

  let pouCandidates = []
  if (namedPous.length > 0) {
    for (const entity of namedPous) pouCandidates.push({ entity, bodies: descendantBodies(entity) })
  } else {
    pouCandidates = entities
      .filter((entity) => /^PouBody$/i.test(entity.type ?? ''))
      .map((entity) => ({ entity: { ...entity, type: entity.subtype || 'Program' }, bodies: [entity] }))
  }

  let stBudget = maxStChars
  const pous = []
  for (const { entity, bodies } of pouCandidates) {
    const sections = []
    for (const body of bodies) {
      const bodyXml = readBody(body.id)
      if (bodyXml === undefined) {
        notes.push(`Section ${body.name || body.id} of ${entity.name ?? ''} has no readable body entry.`)
        continue
      }
      const language = bodyLanguage(bodyXml)
      const rungs = language === 'Ladder' ? parseLadderBody(bodyXml) : []
      let stText
      if (language === 'ST') {
        stText = extractStText(bodyXml) ?? ''
        if (stText.length > stBudget) {
          stText = stText.slice(0, Math.max(0, stBudget))
          notes.push(`ST source truncated for ${entity.name ?? body.id}.`)
        }
        stBudget -= stText.length
      }
      sections.push({
        name: body.name || body.id,
        bodyGuid: body.id,
        language,
        rungCount: rungs.length,
        stLines: stText === undefined ? 0 : stText.split('\n').length,
        stText,
        rungs,
      })
    }
    if (sections.length === 0) continue
    const languages = [...new Set(sections.map((section) => section.language))]
    pous.push({
      name: entity.name || sections[0].bodyGuid,
      type: entity.type ?? '',
      subtype: entity.subtype ?? '',
      language: languages.length === 1 ? languages[0] : 'Mixed',
      sectionCount: sections.length,
      rungCount: sections.reduce((total, section) => total + section.rungCount, 0),
      stLines: sections.reduce((total, section) => total + section.stLines, 0),
      stText: sections.length === 1 ? sections[0].stText : undefined,
      sections,
    })
  }

  const tables = []
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.xml')) continue
    const text = archive.text(name)
    if (text === undefined || !text.includes('[SLWD')) continue
    const entryBase = name.slice(name.lastIndexOf('/') + 1).replace(/\.xml$/i, '')
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryBase) ? entryBase : null
    const entity = guid ? byId.get(guid.toLowerCase()) : undefined
    const isGlobal = text.includes('+GN=VAR_GLOBAL')
    const { variables, notes: tableNotes } = parseSlwd(text, {
      maxVariables: isGlobal ? maxVariables : Math.min(2000, maxVariables),
    })
    notes.push(...tableNotes)
    const label = entity?.name && entity.name !== '程序体'
      ? entity.name
      : entity?.subtype
        ? `${entity.subtype} ${entity.name || ''}`.trim()
        : `Table ${tables.length + 1}`
    tables.push({
      name: label,
      scope: entity?.subtype || (isGlobal ? 'Global' : 'Local'),
      guid,
      entry: name,
      count: variables.length,
      variables,
    })
  }

  const variables = tables.flatMap((table) => table.variables.map((variable) => ({ ...variable, table: table.name })))
  const tasks = entities
    .filter((entity) => /task/i.test(entity.type ?? ''))
    .map((entity) => ({ name: entity.name || entity.type, type: entity.type }))
  const allText = [
    oemText,
    ...names
      .filter((name) => /\.(manifest|xml)$/i.test(name))
      .map((name) => archive.text(name) ?? ''),
  ]
    .join('\n')
    .slice(0, 400000)
  const cpu = detectCpu([oemText, allText])
  const compiler = /CompileVersion[^0-9]{0,40}(\d+\.\d+(?:\.\d+)?)/.exec(oemText)
  const duts = parseDuts(oemText)

  return {
    kind: 'sysmac',
    path: filePath,
    name: basename(filePath).replace(/\.[^.]+$/, ''),
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    format: 'OMRON Sysmac Studio project archive (.smc2)',
    projectGuid: root,
    projectName: entities.find((entity) => /^Solution$/i.test(entity.type ?? ''))?.name ?? null,
    cpu,
    compilerVersion: compiler ? compiler[1] : null,
    pous,
    tasks,
    tables,
    variables,
    variableCount: variables.length,
    duts,
    notes: [...new Set(notes)],
  }
}

/** Comma-separated variable table for spreadsheet review. */
export function variablesToCsv(variables) {
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = ['Table', 'Name', 'DataType', 'Address', 'Scope', 'NetworkPublish', 'Comment']
  const rows = variables.map((variable) => [
    variable.table,
    variable.name,
    variable.dataType,
    variable.address,
    variable.scope,
    variable.networkPublish,
    variable.comment,
  ])
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}
