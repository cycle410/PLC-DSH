import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './win.js'

const here = dirname(fileURLToPath(import.meta.url))
export const COMPILE_SCRIPT = join(here, '..', 'powershell', 'sysmac-compile.ps1')
export const COMPILE_SCREENSHOT_DIR = join(tmpdir(), 'agentplc-compile')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Build a copy of the project inside Sysmac Studio and read the result back.
 *
 * Sysmac Studio runs elevated and its build window is owner-drawn, so the only
 * workable channel is a consent-then-capture helper: it runs elevated, triggers
 * Project > Build (F8), screenshots the window and OCRs it. The project itself is
 * copied first, so a probe build never touches the caller's archive.
 */
export async function compileWithSysmac(projectPath, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'agentplc-compile-request-'))
  const resultPath = join(directory, 'result.json')
  const screenshotPath = join(directory, 'window.png')
  const timeoutMs = options.timeoutMs ?? 240000
  const quote = (value) => `'${String(value).replace(/'/g, "''")}'`
  const argumentList = [
    "'-NoProfile'",
    "'-ExecutionPolicy'",
    "'Bypass'",
    "'-STA'",
    "'-File'",
    quote(COMPILE_SCRIPT),
    "'-ProjectPath'",
    quote(projectPath),
    "'-ResultPath'",
    quote(resultPath),
    "'-ScreenshotPath'",
    quote(screenshotPath),
    "'-WaitSeconds'",
    `'${String(options.waitSeconds ?? 60)}'`,
  ].join(',')
  const launch = `Start-Process -FilePath 'powershell.exe' -ArgumentList @(${argumentList}) -Verb RunAs`
  const launcher = await run('powershell.exe', ['-NoProfile', '-Command', launch], { timeoutMs: 30000 })
  if (!launcher.ok) {
    const message = (launcher.stderr || launcher.message || '').trim()
    const cancelled = /cancel|取消|拒绝|denied/i.test(message)
    return {
      ok: false,
      error: cancelled
        ? 'UAC consent was declined, so Sysmac Studio was not started for the compile check.'
        : `Could not start the elevated compile helper: ${message || 'unknown error'}`,
    }
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(resultPath)) {
      try {
        const result = JSON.parse(readFileSync(resultPath, 'utf8'))
        if (options.keepScreenshot !== true) {
          result.screenshotSaved = Boolean(result.screenshot)
          delete result.screenshot
          try {
            rmSync(directory, { recursive: true, force: true })
          } catch {
            // A leftover request directory is harmless.
          }
        }
        return { ...result, ok: Boolean(result.ok) }
      } catch {
        // The helper writes the file in one call; a partial read only means "not ready yet".
      }
    }
    await sleep(1000)
  }
  return {
    ok: false,
    error:
      'Timed out waiting for the Sysmac compile helper. Confirm the UAC prompt (the build runs elevated), or run the compile manually in Sysmac Studio.',
  }
}

export function cleanupCompileArtifacts() {
  try {
    rmSync(COMPILE_SCREENSHOT_DIR, { recursive: true, force: true })
  } catch {
    // Nothing to clean.
  }
}
