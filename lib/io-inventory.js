/**
 * One IO inventory shape for both controllers.
 *
 * OMRON and Siemens express the same idea in very different strings:
 *   OMRON   AT "ECAT://node#1/Inputs_Status word_6041_00", "CIO 0.00", "D100"
 *   Siemens LogicalAddress "%I0.0", "%QW80", "%M10.0"
 * The agent needs one table it can reason about, so every entry is normalized to
 * { direction, area, name, address, dataType, comment, table, scope } where direction is
 *   input    an input image / EtherCAT input / %I
 *   output   an output image / EtherCAT output / %Q
 *   io       an IO area whose direction is not encoded in the address (CIO, %IW without I/Q pair)
 *   memory   non-IO storage (D, W, H, A, E, %M)
 *   internal no address at all (a pure program variable)
 *
 * This module is read-only and never assigns an address or a task.
 */

import { parseSysmacProject as defaultSysmacParse } from './smc2.js'

const DIRECTION_ORDER = { input: 0, output: 1, io: 2, memory: 3, internal: 4 }

/** Percent notation shared by TIA Portal and the IEC 61131-3 direct-address forms. */
function classifyPercent(address) {
  const match = /^%([A-Za-z]+)/.exec(address)
  if (!match) return null
  const code = match[1].toUpperCase()
  // %IB/%IW/%ID and %QB/%QW/%QD are the byte/word/dword forms of the same areas.
  if (code === 'PI' || code.startsWith('I')) return { direction: 'input', area: `%${code}` }
  if (code === 'PQ' || code.startsWith('Q')) return { direction: 'output', area: `%${code}` }
  if (code.startsWith('M')) return { direction: 'memory', area: `%${code}` }
  if (code.startsWith('DB')) return { direction: 'memory', area: `%${code}` }
  return { direction: 'io', area: `%${code}` }
}

/** EtherCAT device variables carry the direction in the object path ("Inputs_"/"Outputs_"). */
function classifyEthercat(address) {
  // OMRON writes node#1 for the first node and node#[2,0] (node, sub-index) for later ones.
  const match = /^ECAT:\/\/node#([^/]+)\/(Inputs|Outputs)?/i.exec(address)
  if (!match) return null
  const node = `ECAT #${match[1]}`
  if (!match[2]) return { direction: 'io', area: node }
  return { direction: match[2].toLowerCase() === 'inputs' ? 'input' : 'output', area: node }
}

/** CJ/CS/NJ device areas: some are IO, some are memories. Direction is not in the address. */
function classifyDevice(address) {
  const match = /^([A-Za-z]{1,4})[\s:]*[0-9]/.exec(address)
  if (!match) return null
  const device = match[1].toUpperCase()
  if (device === 'CIO' || device === 'IO') return { direction: 'io', area: device }
  if (['D', 'W', 'H', 'A', 'E', 'EM', 'IR', 'DR', 'CJ', 'ZR', 'M'].includes(device)) return { direction: 'memory', area: device }
  return null
}

/** Normalize one raw address string from either controller. */
export function classifyAddress(rawAddress) {
  const address = String(rawAddress ?? '').trim()
  if (address === '') return { direction: 'internal', area: '' }
  return classifyPercent(address) ?? classifyEthercat(address) ?? classifyDevice(address) ?? { direction: 'io', area: '' }
}

function compareEntries(left, right) {
  const order = (DIRECTION_ORDER[left.direction] ?? 9) - (DIRECTION_ORDER[right.direction] ?? 9)
  if (order !== 0) return order
  if (left.address && right.address) {
    const byAddress = left.address.localeCompare(right.address, undefined, { numeric: true })
    if (byAddress !== 0) return byAddress
  } else if (left.address !== right.address) {
    return left.address ? -1 : 1
  }
  return left.name.localeCompare(right.name, undefined, { numeric: true })
}

function summarize(items) {
  const counts = { total: items.length, input: 0, output: 0, io: 0, memory: 0, internal: 0, addressed: 0 }
  for (const item of items) {
    counts[item.direction] = (counts[item.direction] ?? 0) + 1
    if (item.address) counts.addressed += 1
  }
  return counts
}

function finish(items, meta) {
  const sorted = [...items].sort(compareEntries)
  return {
    platform: meta.platform,
    project: meta.project ?? '',
    controller: meta.controller ?? '',
    path: meta.path ?? '',
    tables: meta.tables ?? [],
    counts: summarize(sorted),
    items: sorted,
  }
}

/** OMRON: every variable table in the .smc2 (global tables and POU-local tables). */
export function inventorySysmac(filePath, options = {}) {
  const parse = options.parse ?? defaultSysmacParse
  const parsed = parse(filePath, { maxVariables: options.maxVariables ?? 20000 })
  const items = []
  const tables = []
  for (const table of parsed.tables ?? []) {
    tables.push({ name: table.name, scope: table.scope, count: (table.variables ?? []).length, owner: table.owner ?? null })
    for (const variable of table.variables ?? []) {
      const { direction, area } = classifyAddress(variable.address)
      items.push({
        name: variable.name ?? '',
        address: String(variable.address ?? '').trim(),
        dataType: variable.dataType ?? '',
        comment: variable.comment ?? '',
        direction,
        area,
        table: table.name,
        scope: variable.scope || table.scope || '',
        pou: table.owner ?? null,
        source: 'omron',
      })
    }
  }
  return finish(items, {
    platform: 'omron',
    project: parsed.name ?? parsed.projectName ?? '',
    controller: parsed.cpu ? [parsed.cpu.model, parsed.cpu.firmware].filter(Boolean).join(' / ') : '',
    path: filePath,
    tables,
  })
}

/** Siemens: the tag tables returned by Openness "listTags". */
export function inventoryTia(data, options = {}) {
  const items = []
  const tables = []
  for (const table of data?.tables ?? []) {
    tables.push({ name: table.name, scope: 'PLC tags', count: (table.tags ?? []).length })
    for (const tag of table.tags ?? []) {
      const { direction, area } = classifyAddress(tag.address)
      items.push({
        name: tag.name ?? '',
        address: String(tag.address ?? '').trim(),
        dataType: tag.dataType ?? '',
        comment: tag.comment ?? '',
        direction,
        area,
        table: table.name,
        scope: 'PLC tags',
        pou: null,
        source: 'siemens',
      })
    }
  }
  return finish(items, {
    platform: 'siemens',
    project: data?.project ?? options.project ?? '',
    controller: data?.plc ?? '',
    path: options.path ?? '',
    tables,
  })
}

/** Filter by direction and/or free text; used by the tool and the panel. */
export function filterInventory(inventory, options = {}) {
  const direction = String(options.direction ?? '').trim().toLowerCase()
  const query = String(options.query ?? '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(5000, Number(options.limit ?? 400) || 400))
  const rows = (inventory.items ?? []).filter((item) => {
    if (direction && item.direction !== direction) return false
    if (!query) return true
    return [item.name, item.address, item.dataType, item.comment, item.table, item.area]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
  return { total: rows.length, returned: Math.min(rows.length, limit), rows: rows.slice(0, limit) }
}

/** Spreadsheet-friendly export; UTF-8 BOM and CRLF keep Excel happy. */
export function inventoryToCsv(inventory) {
  const header = ['direction', 'name', 'address', 'dataType', 'comment', 'table', 'scope', 'pou']
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [header.join(',')]
  for (const item of inventory.items ?? []) {
    lines.push([item.direction, item.name, item.address, item.dataType, item.comment, item.table, item.scope, item.pou].map(escape).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** One-line summary shared by the tool and the panel header. */
export function describeInventory(inventory) {
  const counts = inventory.counts ?? {}
  return (
    `${counts.total ?? 0} variable(s): ${counts.input ?? 0} input, ${counts.output ?? 0} output, ` +
    `${counts.io ?? 0} IO area, ${counts.memory ?? 0} memory, ${counts.internal ?? 0} internal; ` +
    `${counts.addressed ?? 0} with an address`
  )
}
