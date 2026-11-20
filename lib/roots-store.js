import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** User-level store shared by every DSH profile on this machine. */
export function rootsStorePath() {
  const base = process.env.APPDATA || join(process.env.USERPROFILE || '.', 'AppData', 'Roaming')
  return join(base, 'dsh-agentplc', 'roots.json')
}

export function loadUserRoots() {
  try {
    const parsed = JSON.parse(readFileSync(rootsStorePath(), 'utf8'))
    if (!Array.isArray(parsed?.roots)) return []
    return parsed.roots.filter((value) => typeof value === 'string' && value.trim() !== '')
  } catch {
    return []
  }
}

export function saveUserRoots(roots) {
  const unique = [...new Set((Array.isArray(roots) ? roots : []).map((value) => String(value).trim()).filter(Boolean))]
  const file = rootsStorePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ roots: unique }, null, 2)}\n`, 'utf8')
  return unique
}

export function addUserRoot(root) {
  const value = String(root ?? '').trim()
  if (!value) return loadUserRoots()
  const list = loadUserRoots()
  if (!list.some((item) => item.toLowerCase() === value.toLowerCase())) list.push(value)
  return saveUserRoots(list)
}

export function removeUserRoot(root) {
  const value = String(root ?? '').trim().toLowerCase()
  return saveUserRoots(loadUserRoots().filter((item) => item.toLowerCase() !== value))
}
