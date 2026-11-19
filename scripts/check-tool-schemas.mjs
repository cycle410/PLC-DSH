/**
 * Preflight check for this bundle's model-facing tool schemas.
 *
 * The provider rejects the whole request when a single tool schema is malformed
 * (an object where a string is expected), so validate the registered definitions
 * before reloading the plugin:
 *
 *   node scripts/check-tool-schemas.mjs
 */
import { AgentPlcService } from '../lib/service.js'

const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'])
const problems = []

function checkNode(node, path) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    problems.push(`${path}: schema node must be an object`)
    return
  }
  if (node.type !== undefined && !TYPES.has(node.type)) problems.push(`${path}.type: unsupported type ${JSON.stringify(node.type)}`)
  if (node.description !== undefined && typeof node.description !== 'string') problems.push(`${path}.description: must be a string`)
  if (node.required !== undefined) {
    const validRequired =
      typeof node.required === 'boolean' ||
      (Array.isArray(node.required) && node.required.every((value) => typeof value === 'string'))
    if (!validRequired) problems.push(`${path}.required: must be a boolean (parameter spec) or an array of names (JSON Schema)`)
  }
  if (node.enum !== undefined) {
    if (!Array.isArray(node.enum)) problems.push(`${path}.enum: must be an array`)
    else if (node.enum.some((value) => typeof value !== 'string')) problems.push(`${path}.enum: every value must be a string`)
  }
  if (node.items !== undefined) checkNode(node.items, `${path}.items`)
  if (node.properties !== undefined) {
    if (typeof node.properties !== 'object' || Array.isArray(node.properties)) problems.push(`${path}.properties: must be an object`)
    else for (const [key, value] of Object.entries(node.properties)) checkNode(value, `${path}.properties.${key}`)
  }
}

const tools = []
const ctx = {
  get: () => undefined,
  effect: (callback) => callback(),
  tools: { register: (definition) => { tools.push(definition); return () => {} } },
}
new AgentPlcService(ctx, {}).registerTools(ctx.tools)

if (tools.length === 0) problems.push('no tools were registered')
for (const tool of tools) {
  if (typeof tool.name !== 'string' || tool.name === '') problems.push(`tool ${tool.name ?? '?'}: name must be a non-empty string`)
  if (typeof tool.description !== 'string') problems.push(`tool ${tool.name}: description must be a string`)
  if (tool.parameters === null || typeof tool.parameters !== 'object') {
    problems.push(`tool ${tool.name}: parameters must be an object`)
    continue
  }
  for (const [key, value] of Object.entries(tool.parameters)) checkNode(value, `${tool.name}.parameters.${key}`)
  if (tool.output !== undefined) {
    if (!tool.output || typeof tool.output.schema !== 'object') problems.push(`tool ${tool.name}: output.schema must be an object`)
    else checkNode(tool.output.schema, `${tool.name}.output.schema`)
    if (typeof tool.output?.render !== 'function') problems.push(`tool ${tool.name}: output.render must be a function`)
  }
}

if (problems.length > 0) {
  console.error(`tool schema check failed with ${problems.length} problem(s):`)
  for (const problem of problems) console.error('  - ' + problem)
  process.exit(1)
}
console.log(`tool schema check passed: ${tools.length} tool(s) — ${tools.map((tool) => tool.name).join(', ')}`)
