/**
 * Opt-in repair and always-on encoding normalization for SCL external sources.
 *
 * Two practical findings from this machine:
 * 1. TIA reads a BOM-less .scl file as ANSI, so Chinese tag names in the source become
 *    mojibake and the import fails with "Tag ... not defined". Importing a UTF-8 BOM copy
 *    fixes that; this module always writes BOM copies.
 * 2. TIA reports Success and silently skips a block whose code lines carry a trailing `//`
 *    comment (full-line comments, `(* *)` blocks and Chinese identifiers are fine).
 *    With `stripComments`, those trailing comments are removed from the copy only.
 * The original files are never modified.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const DECLARATION = /^[ \t]*(FUNCTION_BLOCK|FUNCTION|PROGRAM|DATA_BLOCK|ORGANIZATION_BLOCK)[ \t]+(?:"([^"]+)"|([A-Za-z0-9_\u4e00-\u9fff]+))/gim
const BOM = '\uFEFF'

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
 * Copy the sources into a temp directory as UTF-8 BOM files, optionally stripping trailing
 * line comments. Returns the copy paths, the per-source findings and the declared blocks.
 */
export function prepareSclSources({ files, stripComments = false }) {
  const directory = mkdtempSync(join(tmpdir(), 'agentplc-scl-'))
  const prepared = []
  const declaredBlocks = []
  let comments = 0
  let encodingFixed = 0
  for (const file of files) {
    const buffer = readFileSync(file)
    const hadBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
    let text = buffer.toString('utf8')
    if (text.startsWith(BOM)) text = text.slice(1)
    if (!hadBom) encodingFixed += 1
    if (stripComments) {
      const stripped = stripTrailingComments(text)
      text = stripped.text
      comments += stripped.comments
    }
    const target = join(directory, basename(file))
    writeFileSync(target, `${BOM}${text}`, 'utf8')
    prepared.push(target)
    declaredBlocks.push(...declaredBlockNames(text))
  }
  return { files: prepared, directory, comments, encodingFixed, declaredBlocks }
}

/** Backwards-compatible wrapper that always strips trailing comments. */
export function repairSclSources(files) {
  return prepareSclSources({ files, stripComments: true })
}
