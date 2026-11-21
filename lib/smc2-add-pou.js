import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { ZipArchive } from './zip.js'
import { writeZip } from './zip-write.js'
import { parseSysmacProject } from './smc2.js'

const ENTITY_OPEN = /<Entity\b[^>]*>/g

function blockAt(source, startIndex) {
  let depth = 0
  const pattern = /<Entity\b([^>]*)>|<\/Entity>/g
  pattern.lastIndex = startIndex
  let match
  while ((match = pattern.exec(source)) !== null) {
    if (match[0] === '</Entity>') {
      depth -= 1
      if (depth === 0) return { start: startIndex, end: pattern.lastIndex }
    } else {
      depth += 1
    }
  }
  return null
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function stamp() {
  const now = new Date()
  const two = (value) => String(value).padStart(2, '0')
  return `${two(now.getMonth() + 1)}/${two(now.getDate())}/${now.getFullYear()} ${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

/** Append local rows to an SLWD table, refusing names that already exist in it. */
function addLocalVariables(slwd, rows) {
  const lines = slwd.split(/\r?\n/)
  const existing = new Set()
  for (const line of lines) {
    const match = /^\+D=[^\t]*\tN=([^\t\r]+)/.exec(line)
    if (match) existing.add(match[1])
  }
  const byGroup = { VAR: [], VAR_EXTERNAL: [] }
  const duplicates = []
  for (const row of rows) {
    const name = String(row?.name ?? '').trim()
    if (!name) continue
    if (existing.has(name)) {
      duplicates.push(name)
      continue
    }
    existing.add(name)
    const scope = row.scope === 'VAR_EXTERNAL' ? 'VAR_EXTERNAL' : 'VAR'
    const parts = [`D=${row.dataType || 'BOOL'}`, `N=${name}`]
    if (row.address) parts.push(`AT=${row.address}`)
    parts.push(`G=${scope}`)
    if (row.comment) parts.push(`Com=${row.comment}`)
    byGroup[scope].push('++' + parts.join('\t'))
  }
  if (duplicates.length > 0) throw new Error(`Local variable(s) already exist: ${duplicates.join(', ')}`)
  if (byGroup.VAR.length === 0 && byGroup.VAR_EXTERNAL.length === 0) return slwd

  const insertIntoGroup = (groupName, newRows, headerLine) => {
    if (newRows.length === 0) return
    let headerIndex = lines.findIndex((line) => line.startsWith(`+GN=${groupName}\t`) || line === `+GN=${groupName}`)
    if (headerIndex < 0) {
      lines.push(headerLine)
      headerIndex = lines.length - 1
    }
    let insertAt = headerIndex + 1
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith('+GN=')) break
      if (lines[index].startsWith('++')) insertAt = index + 1
    }
    lines.splice(insertAt, 0, ...newRows)
  }
  insertIntoGroup('VAR', byGroup.VAR, '+GN=VAR\tGVT=DefaultGroup')
  insertIntoGroup('VAR_EXTERNAL', byGroup.VAR_EXTERNAL, '+GN=VAR_EXTERNAL\tGA=External\tGVT=ExternalGroup')
  return lines.join('\r\n')
}

/**
 * Clone an existing StructuredText Program entity into a new POU: fresh GUIDs for the
 * entity and every child, copied body/local-variable entries, new ST text, and a task
 * association so the program actually runs.
 */
export function addPousToProject({ template, output, pous = [], overwrite = false } = {}) {
  const archive = new ZipArchive(readFileSync(template))
  const names = [...archive.entries.keys()]
  const raw = new Map(names.map((name) => [name, archive.read(name)]))
  const oemName = names.find((name) => name.toLowerCase().endsWith('.oem'))
  if (!oemName) throw new Error('Template has no .oem entity tree.')
  const directory = oemName.slice(0, oemName.lastIndexOf('/') + 1)
  let oem = raw.get(oemName).toString('utf8')
  const changes = []
  const added = []

  const existingNames = new Set(parseSysmacProject(template).pous.map((pou) => String(pou.name).toLowerCase()))
  for (const request of pous) {
    if (!request?.name) continue
    const key = String(request.name).trim().toLowerCase()
    if (!key) continue
    if (existingNames.has(key)) throw new Error(`POU name already exists: ${request.name}`)
    existingNames.add(key)
  }

  for (const request of pous) {
    if (!request?.name) continue
    const name = String(request.name).trim()
    if (!name) continue
    // Locate a StructuredText entity of the requested kind to clone.
    const wantedType = request.type === 'FunctionBlock' ? 'FunctionBlock' : 'Program'
    let templateBlock = null
    ENTITY_OPEN.lastIndex = 0
    let match
    while ((match = ENTITY_OPEN.exec(oem)) !== null) {
      const attributes = match[0]
      if (!attributes.includes(`type="${wantedType}"`) || !/subtype="StructuredText"/.test(attributes)) continue
      const block = blockAt(oem, match.index)
      if (block) {
        templateBlock = { start: match.index, end: block.end, text: oem.slice(match.index, block.end) }
        break
      }
    }
    if (!templateBlock) throw new Error(`Template has no StructuredText ${wantedType} to clone.`)
    const varsMatch = /<Entity\b[^>]*type="Variables"[^>]*id="([0-9a-fA-F-]{36})"/.exec(templateBlock.text)
    const oldVarsId = varsMatch ? varsMatch[1].toLowerCase() : null

    const idMap = new Map()
    const cloned = templateBlock.text.replace(/\b(id|trackingId)="([0-9a-fA-F-]{36})"/g, (_all, attr, guid) => {
      const lower = guid.toLowerCase()
      if (!idMap.has(lower)) idMap.set(lower, randomUUID())
      return `${attr}="${idMap.get(lower)}"`
    })
    let block = cloned.replace(/name="[^"]*"/, `name="${escapeXml(name)}"`)
    block = block.replace(/dateCreated="[^"]*"/, `dateCreated="${stamp()}"`).replace(/dateLastModified="[^"]*"/, `dateLastModified="${stamp()}"`)

    if (typeof request.stText === 'string') {
      const body = escapeXml(request.stText).replace(/\r?\n/g, '&#xD;\n')
      block = block.replace(/(<Text>)[\s\S]*?(<\/Text>)/, `$1${body}$2`)
    }

    // Clone the body/debug/local-table entries under the fresh child GUIDs.
    for (const [oldId, newId] of idMap) {
      for (const suffix of ['.xml', '.slwd']) {
        const source = `${directory}${oldId}${suffix}`
        if (!raw.has(source)) continue
        const target = `${directory}${newId}${suffix}`
        let data = raw.get(source)
        if (suffix === '.xml' && typeof request.stText === 'string') {
          const text = data.toString('utf8')
          if (text.includes('<Text>')) {
            data = Buffer.from(
              text.replace(/<Text>[\s\S]*?<\/Text>/, () => `<Text>${escapeXml(request.stText).replace(/\r?\n/g, '&#xD;\n')}</Text>`),
              'utf8',
            )
          }
        }
        raw.set(target, data)
        if (!names.includes(target)) names.push(target)
      }
    }

    let localVariables = 0
    if (Array.isArray(request.variables) && request.variables.length > 0) {
      if (!oldVarsId || !idMap.has(oldVarsId)) throw new Error(`Template POU ${name} has no local variable table to clone.`)
      const varsEntry = `${directory}${idMap.get(oldVarsId)}.xml`
      if (!raw.has(varsEntry)) throw new Error('Local variable table entry is missing in the template.')
      const updated = addLocalVariables(raw.get(varsEntry).toString('utf8'), request.variables)
      raw.set(varsEntry, Buffer.from(updated, 'utf8'))
      localVariables = request.variables.length
    }

    // Insert before the Programs group's closing </ChildEntities>.
    const groupPattern = /<Entity\b[^>]*subtype="IecPrograms"[^>]*>/
    const groupMatch = groupPattern.exec(oem)
    if (!groupMatch) throw new Error('Template has no Programs group (IecPrograms).')
    const groupBlock = blockAt(oem, groupMatch.index)
    if (!groupBlock) throw new Error('Programs group entity is malformed.')
    const groupText = oem.slice(groupBlock.start, groupBlock.end)
    const closeIndex = groupText.lastIndexOf('</ChildEntities>')
    if (closeIndex < 0) throw new Error('Programs group has no ChildEntities block.')
    const insertAt = groupBlock.start + closeIndex
    oem = oem.slice(0, insertAt) + block + '                    ' + oem.slice(insertAt)

    // Associate only programs with the task; function blocks are called from code.
    // The caller may pick a task by name, or turn the association off entirely.
    let associatedTask = null
    if (wantedType === 'Program' && request.associateTask !== false) {
      const wantedTask = typeof request.taskName === 'string' ? request.taskName.trim() : ''
      const taskPattern = /<Entity\b[^>]*type="NexTask"[^>]*>/g
      const taskNames = []
      let chosen
      let taskMatch
      while ((taskMatch = taskPattern.exec(oem)) !== null) {
        const candidate = blockAt(oem, taskMatch.index)
        if (!candidate) continue
        const opening = /^<Entity\b[^>]*>/.exec(oem.slice(candidate.start, candidate.end))?.[0] ?? ''
        const taskName = /\bname="([^"]*)"/.exec(opening)?.[1] ?? ''
        taskNames.push(taskName)
        if (!chosen && (wantedTask === '' || taskName === wantedTask)) chosen = { block: candidate, name: taskName }
      }
      if (wantedTask && !chosen) {
        throw new Error(
          `Task not found: ${wantedTask}. Available task(s): ${taskNames.filter(Boolean).join(', ') || 'none'}. ` +
            'Pass associateTask:false to leave the new program unattached.',
        )
      }
      if (chosen) {
        const taskText = oem.slice(chosen.block.start, chosen.block.end)
        const linkPattern = /<Entity\b[^>]*type="NexAssociatedProgram"[^>]*>[\s\S]*?<\/Entity>/
        const linkMatch = linkPattern.exec(taskText)
        if (linkMatch) {
          const assoc = linkMatch[0]
            .replace(/\b(id|trackingId)="[0-9a-fA-F-]{36}"/g, (_all, attr) => `${attr}="${randomUUID()}"`)
            .replace(/name="[^"]*"/, `name="${escapeXml(name)}"`)
            .replace(/dateCreated="[^"]*"/, `dateCreated="${stamp()}"`)
            .replace(/dateLastModified="[^"]*"/, `dateLastModified="${stamp()}"`)
          const taskInsert = chosen.block.start + taskText.lastIndexOf('</ChildEntities>')
          oem = oem.slice(0, taskInsert) + assoc + '                      ' + oem.slice(taskInsert)
          associatedTask = chosen.name || null
        }
      }
    }

    added.push({ name, type: wantedType, bodyEntries: [...idMap.keys()].length, localVariables, task: associatedTask })
    changes.push({ name, section: 'new-pou' })
  }

  if (added.length === 0) throw new Error('No POU was requested.')

  raw.set(oemName, Buffer.from(oem, 'utf8'))
  const entries = names.map((name) => ({ name, data: raw.get(name) ?? Buffer.alloc(0), store: name.endsWith('/') || (raw.get(name)?.length ?? 0) === 0 }))
  writeFileSync(output, writeZip(entries))
  const rebuilt = parseSysmacProject(output, { maxVariables: 8000 })
  const namesAfter = new Set(rebuilt.pous.map((pou) => pou.name))
  return {
    path: output,
    sizeBytes: statSync(output).size,
    added,
    warnings: added.filter((item) => !namesAfter.has(item.name)).map((item) => `POU ${item.name} was written but not re-parsed.`),
    pous: rebuilt.pous.map((pou) => ({ name: pou.name, language: pou.language, stLines: pou.stLines })),
  }
}
