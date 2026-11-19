import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertSt } from '../lib/st.js'
import { buildSysmacProject } from '../lib/smc2-write.js'
import { addPousToProject } from '../lib/smc2-add-pou.js'
import { parseSysmacProject } from '../lib/smc2.js'
import { verifySysmacProject } from '../lib/sysmac-verify.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
let failures = 0

function pass(label, detail = '') {
  console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`)
}
function fail(label, error) {
  failures += 1
  console.error(`FAIL ${label} — ${error instanceof Error ? error.message : error}`)
}

function runScript(name) {
  try {
    execFileSync(node, [join(root, 'scripts', name)], { stdio: 'inherit' })
    pass(name)
  } catch (error) {
    fail(name, error)
  }
}

runScript('check-tool-schemas.mjs')
runScript('check-client.mjs')

const workDir = mkdtempSync(join(tmpdir(), 'agentplc-smoke-'))
try {
  const demo = join(root, 'examples', 'demo.st')
  for (const format of ['iec61131-10', 'plcopen']) {
    try {
      const output = join(workDir, `demo.${format}.xml`)
      const result = await convertSt({ inputs: [demo], output, format, name: 'SmokeDemo' })
      if (!result.ok) throw new Error(result.error ?? 'converter failed')
      const size = statSync(output).size
      if (size < 100) throw new Error(`output too small: ${size}`)
      pass(`ST → XML (${format})`, `${size} bytes`)
    } catch (error) {
      fail(`ST → XML (${format})`, error)
    }
  }

  const demoProject = join(root, 'examples', 'AgentPLC_Demo.smc2')
  let template = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
  if (!template && existsSync(demoProject)) template = demoProject
  if (!template) {
    console.log('SKIP .smc2 pipeline — pass a template path as the first argument to exercise create/verify/add-POU')
  } else {
    const output = join(workDir, 'smoke.smc2')
    try {
      const created = buildSysmacProject({
        template,
        output,
        projectName: 'AgentPLC_Smoke',
        variablesMode: 'keep',
        pous: [{ name: 'PRG_Smoke', stText: 'RETURN;' }],
        overwrite: true,
      })
      pass('create .smc2', `${(created.sizeBytes / 1024).toFixed(0)} KB`)
      const verified = verifySysmacProject(output)
      pass('static verify', `${verified.errors} error(s), ${verified.warnings} warning(s)`)

      const added = addPousToProject({ template: output, output, pous: [{ name: 'PRG_Smoke2', stText: 'RETURN;' }] })
      const parsed = parseSysmacProject(output)
      if (!parsed.pous.some((pou) => pou.name === 'PRG_Smoke2')) throw new Error('new POU missing after add')
      pass('add POU', added.added.map((item) => item.name).join(', '))
      const after = verifySysmacProject(output)
      pass('static verify after add', `${after.errors} error(s), ${after.warnings} warning(s)`)
    } catch (error) {
      fail('.smc2 pipeline', error)
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

const readme = readFileSync(join(root, 'README.md'), 'utf8')
if (!readme.includes('部署到你的 DSH agent')) fail('README deployment section', 'missing')
else pass('README deployment section')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall smoke checks passed')
