import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './win.js'

const here = dirname(fileURLToPath(import.meta.url))
export const CONVERTER_PATH = join(here, '..', 'python', 'convert_st.py')
export const CONVERTER_SCRIPTS = [CONVERTER_PATH, join(here, '..', 'python', 'st2iec61131.py'), join(here, '..', 'python', 'st2plcopen.py')]

let cachedPython

/** The Python 3 interpreter the bundled ST converter runs under. */
export async function detectPython(refresh = false) {
  if (!refresh && cachedPython !== undefined) return cachedPython
  const candidates = [
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
    { command: 'python3', prefix: [] },
  ]
  for (const candidate of candidates) {
    const result = await run(candidate.command, [...candidate.prefix, '-c', 'import sys; print(sys.version.split()[0])'], {
      timeoutMs: 15000,
    })
    if (result.ok && result.stdout.trim()) {
      cachedPython = { ...candidate, version: result.stdout.trim() }
      return cachedPython
    }
  }
  cachedPython = null
  return cachedPython
}

export function converterReady() {
  return CONVERTER_SCRIPTS.every((path) => existsSync(path))
}

function normalizeFormat(value) {
  return value === 'plcopen' ? 'plcopen' : 'iec61131-10'
}

function outputSuffix(format) {
  return normalizeFormat(format) === 'plcopen' ? '.plcopen.xml' : '.sysmac.xml'
}

function outputFor(input, requested, format) {
  if (requested) return resolve(requested)
  const directory = dirname(resolve(input))
  return join(directory, `${basename(input, extname(input))}${outputSuffix(format)}`)
}

/**
 * Convert ST sources into XML: IEC 61131-10 (Sysmac Studio import) by default,
 * or PLCopen TC6 2.01 for vendor-neutral exchange.
 */
export async function convertSt(options = {}) {
  const inputs = (Array.isArray(options.inputs) ? options.inputs : [])
    .filter((input) => typeof input === 'string' && input.trim() !== '')
    .map((input) => resolve(input.trim()))
  if (inputs.length === 0) return { ok: false, error: 'At least one .st source file or directory is required.' }
  const missing = inputs.filter((input) => !existsSync(input))
  if (missing.length > 0) return { ok: false, error: `Input does not exist: ${missing.join(', ')}` }
  if (!converterReady()) return { ok: false, error: 'The bundled ST converter scripts are missing from this plugin package.' }
  const python = await detectPython()
  if (!python) {
    return {
      ok: false,
      error: 'Python 3 was not found on PATH; the ST-to-XML converter needs it (install Python 3 or add it to PATH).',
    }
  }
  const format = normalizeFormat(options.format)
  const output = outputFor(inputs[0], options.output, format)
  const args = [...python.prefix, '-X', 'utf8', CONVERTER_PATH]
  for (const input of inputs) args.push('--input', input)
  args.push('--output', output, '--format', format)
  if (options.name) args.push('--name', String(options.name))
  if (options.onlyFb) args.push('--only-fb')
  const result = await run(python.command, args, {
    timeoutMs: 180000,
    maxBuffer: 16 * 1024 * 1024,
    // Keep the package directory clean: no __pycache__ beside the bundled scripts.
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  let json
  try {
    json = JSON.parse(result.stdout.trim())
  } catch {
    json = undefined
  }
  if (!json) {
    return {
      ok: false,
      error: 'The converter returned no JSON result.',
      stdout: result.stdout.slice(0, 4000),
      stderr: result.stderr.slice(0, 4000),
      exitCode: result.code,
    }
  }
  return { ...json, output, python: `${python.command} ${python.version}` }
}

/** Convert one source and hand back the XML text, used by the panel download route. */
export async function convertStToText(input, format = 'iec61131-10') {
  const normalized = normalizeFormat(format)
  const directory = mkdtempSync(join(tmpdir(), 'agentplc-st-'))
  const output = join(directory, `${basename(input, extname(input))}${outputSuffix(normalized)}`)
  try {
    const result = await convertSt({ inputs: [input], output, format: normalized })
    if (!result.ok) return result
    return { ...result, xml: readFileSync(output, 'utf8') }
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true })
    } catch {
      // A leftover temp directory is harmless.
    }
  }
}

/** Bounded preview of an ST source for the panel. */
export function readStSource(path, maxChars = 40000) {
  const text = readFileSync(path, 'utf8')
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n// ... truncated at ${maxChars} characters` : text
}
