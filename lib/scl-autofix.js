/**
 * Opt-in repair of SCL external sources for TIA import.
 *
 * Experiment on this machine: TIA's SCL importer reports Success and skips a block when the
 * source has a *trailing* `//` comment on a code line (`Start : Bool;   // start`), while the
 * same code with full-line `//` comments, `(* *)` block comments and Chinese identifiers
 * imports and compiles. This module removes only those trailing comments into temporary
 * copies; the original files stay untouched, and the caller imports the copies and reports
 * which blocks were skipped.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const DECLARATION = /^[ \t]*(FUNCTION_BLOCK|FUNCTION|PROGRAM|DATA_BLOCK|ORGANIZATION_BLOCK)[ \t]+(?:"([^"]+)"|([A-Za-z0-9_\u4e00-\u9fff]+))/gim

/** Block names declared in an SCL source, used to notice blocks TIA silently skipped. */
export function declaredBlockNames(text) {
  const names = []
  let match
  DECLARATION.lastIndex = 0
  while ((match = DECLARATION.exec(String(text ?? ''))) !== null) names.push(match[2] ?? match[3])
  return names
}

/** Remove `//` comments that follow code on the same line; keep full-line comments. */
export function stripTrailingComments(text) {
  const source = String(text ?? '')
  // Blank strings so a "//" inside a literal is not treated as a comment.
  const masked = source.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, (literal) => ' '.repeat(literal.length))
  const ranges = []
  const pattern = /\/\/[^\n\r]*/g
  let match
  while ((match = pattern.exec(masked)) !== null) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1
    if (source.slice(lineStart, match.index).trim() === '') continue // full-line comment: keep
    ranges.push([match.index, match.index + match[0].length])
  }
  let output = source
  for (const [start, end] of ranges.reverse()) output = output.slice(0, start) + output.slice(end)
  return { text: output, comments: ranges.length }
}

/**
 * Repair SCL source files into a temp directory by removing trailing line comments.
 * Returns the repaired paths, the comment count, the declared blocks and the temp directory.
 */
export function repairSclSources(files) {
  const directory = mkdtempSync(join(tmpdir(), 'agentplc-scl-'))
  const repaired = []
  const declaredBlocks = []
  let comments = 0
  for (const file of files) {
    const original = readFileSync(file, 'utf8')
    const stripped = stripTrailingComments(original)
    const target = join(directory, basename(file))
    writeFileSync(target, stripped.text, 'utf8')
    repaired.push(target)
    comments += stripped.comments
    declaredBlocks.push(...declaredBlockNames(stripped.text))
  }
  return { files: repaired, directory, comments, declaredBlocks }
}
