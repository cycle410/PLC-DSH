/**
 * Opt-in auto-fix for `plc_sysmac create`: add the VAR_EXTERNAL mirrors a new program needs.
 *
 * Sysmac requires every global a program reads or writes to be re-declared inside that
 * program as VAR_EXTERNAL; forgetting it is the most common compile error after generation.
 * This module only *declares* globals that already exist in the project's global table.
 * It never invents a type, never touches the ST body, and never edits other POUs.
 *
 * New POUs are cloned from the template's first StructuredText program, so that program's
 * local table (usually full of VAR_EXTERNAL mirrors) is part of the new POU before we add
 * anything — it must be included in the "already declared" set or the mirror is duplicated.
 */
import { parseSysmacProject } from './smc2.js'
import { extractBodyDeclarations, normalizeSource } from './sysmac-verify.js'

const IDENTIFIER = /[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*/g
const LITERAL = /^(?:[TtDd]#[0-9A-Za-z_:#.+\-]+|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|16#[0-9A-Fa-f_]+|2#[01_]+|8#[0-7_]+)$/

/** Names the clone source already declares locally (they arrive with the cloned table). */
function cloneDeclarations(parsed) {
  const names = new Set()
  if (!parsed) return names
  const source = (parsed.pous ?? []).find((pou) => pou.type === 'Program' && pou.subtype === 'StructuredText')
  if (!source) return names
  for (const table of parsed.tables ?? []) {
    if (table.owner !== source.name || table.scope === 'Global') continue
    for (const variable of table.variables ?? []) names.add(variable.name)
  }
  return names
}

/** Global variables visible to the generated project, honouring variablesMode. */
function globalTable(parsed, variables, variablesMode) {
  const table = new Map()
  if (parsed && variablesMode !== 'replace') {
    for (const variable of parsed.variables ?? []) {
      if (variable.scope === 'VAR_GLOBAL' && variable.name) {
        table.set(variable.name, { name: variable.name, dataType: variable.dataType, comment: variable.comment ?? '' })
      }
    }
  }
  for (const variable of variables ?? []) {
    if (variable?.name) table.set(variable.name, { name: variable.name, dataType: variable.dataType, comment: variable.comment ?? '' })
  }
  return table
}

/**
 * Complete the VAR_EXTERNAL declarations of the requested new programs.
 * Mutates each `newPous[]` entry's `variables` array and returns a per-POU report.
 */
export function completeExternalMirrors({ template, variables, variablesMode, newPous }) {
  let parsed
  try {
    parsed = parseSysmacProject(template, { maxVariables: 20000 })
  } catch {
    parsed = undefined
  }
  const globals = globalTable(parsed, variables, variablesMode)
  const clone = cloneDeclarations(parsed)
  const report = []
  for (const pou of newPous ?? []) {
    if (!pou || !pou.name) continue
    if (pou.type === 'FunctionBlock') continue // keep the mirror rule for programs only
    const declared = new Set(clone)
    for (const variable of pou.variables ?? []) if (variable?.name) declared.add(variable.name)
    const body = extractBodyDeclarations(String(pou.stText ?? ''))
    for (const name of body.names) declared.add(name)
    const source = normalizeSource(body.text)
    const added = []
    IDENTIFIER.lastIndex = 0
    let match
    while ((match = IDENTIFIER.exec(source)) !== null) {
      const name = match[0]
      const before = match.index > 0 ? source[match.index - 1] : ''
      if (before === '.') continue // member access: the root identifier is the reference
      if (declared.has(name)) continue
      if (LITERAL.test(name)) continue
      const global = globals.get(name)
      if (!global) continue
      declared.add(name)
      added.push({ name, dataType: global.dataType, scope: 'VAR_EXTERNAL', comment: global.comment })
    }
    if (added.length > 0) {
      pou.variables = [...(pou.variables ?? []), ...added]
      report.push({ pou: pou.name, added: added.map((variable) => `${variable.name}:${variable.dataType}`) })
    }
  }
  return report
}
