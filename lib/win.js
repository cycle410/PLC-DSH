import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Run one native command without a shell and resolve with its captured output. */
export function run(command, args, options = {}) {
  const { timeoutMs = 20000, maxBuffer = 8 * 1024 * 1024, env } = options
  return new Promise((resolve) => {
    try {
      execFile(
        command,
        args,
        { timeout: timeoutMs, maxBuffer, windowsHide: true, encoding: 'utf8', env: env ?? process.env },
        (error, stdout, stderr) => {
          const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
          resolve({
            ok: !error,
            code,
            stdout: typeof stdout === 'string' ? stdout : '',
            stderr: typeof stderr === 'string' ? stderr : '',
            message: error ? error.message : '',
          })
        },
      )
    } catch (error) {
      resolve({ ok: false, code: 1, stdout: '', stderr: '', message: error instanceof Error ? error.message : String(error) })
    }
  })
}

/** The Windows PowerShell host TIA Openness assemblies are documented against. */
export function windowsPowerShellPath() {
  const root = process.env.SystemRoot ?? 'C:\\Windows'
  const candidate = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return existsSync(candidate) ? candidate : 'powershell.exe'
}

/** Read one REG_SZ/REG_DWORD value from a registry key through reg.exe. */
export async function regQuery(key, value) {
  const result = await run('reg', ['query', key, '/v', value])
  if (!result.ok) return undefined
  const line = result.stdout
    .split(/\r?\n/)
    .map((row) => row.trim())
    .find((row) => row.toLowerCase().startsWith(value.toLowerCase()))
  if (!line) return undefined
  const parts = line.split(/\s{2,}/).filter(Boolean)
  return parts.length >= 3 ? parts.slice(2).join(' ') : undefined
}

/** True when the current token belongs to a Windows group whose name contains `fragment`. */
export async function belongsToWindowsGroup(fragment) {
  const result = await run('whoami', ['/groups', '/fo', 'csv', '/nh'])
  if (!result.ok) return undefined
  const needle = fragment.toLowerCase()
  return result.stdout
    .split(/\r?\n/)
    .some((row) => row.toLowerCase().includes(needle))
}

/** Run a PowerShell script file and parse the single JSON document it prints. */
export async function runPowerShell(scriptPath, args, options = {}) {
  const { timeoutMs = 600000, extraArgs = [] } = options
  const result = await run(
    windowsPowerShellPath(),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', scriptPath, ...extraArgs, ...args],
    { timeoutMs, maxBuffer: 16 * 1024 * 1024 },
  )
  const text = result.stdout.trim()
  let json
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
  }
  return { ...result, json }
}
