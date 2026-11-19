import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const clientPath = join(root, '..', 'client.js')
const source = readFileSync(clientPath, 'utf8')

// client.js is loaded through the shell's module loader, not as an ES module;
// compiling it with Function catches syntax errors without importing it.
try {
  new Function(source)
} catch (error) {
  console.error(`client.js syntax error: ${error.message}`)
  process.exit(1)
}

const requiredKeys = ['create.title', 'create.submit', 'verify.run', 'nav.label']
for (const key of requiredKeys) {
  if (!source.includes(`'${key}'`)) {
    console.error(`client.js is missing dictionary key: ${key}`)
    process.exit(1)
  }
}

console.log(`client.js OK (${source.length} chars, dictionary keys present)`)
