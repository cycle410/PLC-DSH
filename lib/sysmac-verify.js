import { parseSysmacProject } from './smc2.js'

/** IEC 61131-3 keywords plus common Sysmac Studio system variables and function blocks. */
const KEYWORDS = new Set(
  [
    'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'OF', 'END_CASE', 'FOR', 'TO', 'BY', 'DO', 'END_FOR',
    'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT', 'RETURN', 'EXIT', 'CONTINUE', 'EXIT_WHILE',
    'AND', 'OR', 'XOR', 'NOT', 'MOD', 'TRUE', 'FALSE', 'NULL', 'VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT',
    'VAR_GLOBAL', 'VAR_TEMP', 'VAR_EXTERNAL', 'END_VAR', 'RETAIN', 'PERSISTENT', 'CONSTANT', 'AT', 'TON',
    'TOF', 'TP', 'CTU', 'CTD', 'CTUD', 'R_TRIG', 'F_TRIG', 'SR', 'RS', 'SEMA', 'RTC',
    'BOOL', 'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT', 'REAL', 'LREAL',
    'TIME', 'DATE', 'DT', 'TOD', 'BYTE', 'WORD', 'DWORD', 'LWORD', 'STRING', 'WSTRING', 'ARRAY',
    'STRUCT', 'END_STRUCT', 'TYPE', 'END_TYPE', 'FUNCTION', 'FUNCTION_BLOCK', 'PROGRAM', 'END_FUNCTION',
    'END_FUNCTION_BLOCK', 'END_PROGRAM', 'METHOD', 'END_METHOD', 'PROPERTY', 'END_PROPERTY', 'INTERFACE',
    'END_INTERFACE', 'NAMESPACE', 'END_NAMESPACE', 'EXTENDS', 'IMPLEMENTS', 'THIS', 'SUPER', 'P_First_Run',
    'P_FirstRun', 'P_Always', 'P_On', 'P_Off', 'P_CycleTime', 'P_Now', 'P_IsSimulation', 'P_IsSimulationMode',
  ].map((word) => word.toUpperCase()),
)
const LITERAL = /^(?:[TtDd]#[0-9A-Za-z_:#.+\-]+|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|16#[0-9A-Fa-f_]+|2#[01_]+|8#[0-7_]+)$/

/**
 * ST bodies written by hand often carry their own VAR...END_VAR block. Its names are
 * local declarations, not references, so collect them and blank the block out before linting.
 */
function extractBodyDeclarations(text) {
  const names = new Set()
  const blanked = text.replace(
    /^[ \t]*VAR(?:_INPUT|_OUTPUT|_IN_OUT|_TEMP|_EXTERNAL|_GLOBAL)?\b[\s\S]*?^[ \t]*END_VAR\b/im,
    (block) => {
      for (const line of block.split('\n')) {
        const match = /^\s*([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)\s*(?:AT\s+[^:]+)?\s*:/.exec(line)
        if (match) names.add(match[1])
      }
      return block.replace(/[^\n]/g, ' ')
    },
  )
  return { names, text: blanked }
}

/** Strip comments and string literals so their contents never look like identifiers. */
function normalizeSource(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\(\*[\s\S]*?\*\)/g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (line) => ' '.repeat(line.length))
    .replace(/'(?:[^']|'')*'/g, (literal) => ` ${' '.repeat(Math.max(0, literal.length - 2))} `)
    .replace(/"(?:[^"]|"")*"/g, (literal) => ` ${' '.repeat(Math.max(0, literal.length - 2))} `)
}

function countBalance(text, open, close) {
  const openCount = (text.match(open) || []).length
  const closeCount = (text.match(close) || []).length
  return openCount - closeCount
}

function splitMembers(name) {
  return name.split('.')
}

/**
 * Offline lint for a generated OMRON project: undeclared identifiers, duplicate names,
 * duplicate AT addresses and unbalanced control blocks. It is not the vendor compiler,
 * but it catches the mistakes generation tends to make without starting Sysmac Studio.
 */
export function verifySysmacProject(projectPath) {
  const project = parseSysmacProject(projectPath, { maxVariables: 8000 })
  const issues = []
  const declared = new Map()
  const duplicates = new Map()
  const addresses = new Map()
  for (const table of project.tables) {
    const seenInTable = new Set()
    for (const variable of table.variables) {
      if (seenInTable.has(variable.name)) {
        duplicates.set(variable.name, (duplicates.get(variable.name) ?? 1) + 1)
      }
      seenInTable.add(variable.name)
      declared.set(variable.name, variable)
      if (variable.address) {
        const list = addresses.get(variable.address) ?? []
        list.push(variable.name)
        addresses.set(variable.address, list)
      }
    }
  }
  const pouNames = new Set(project.pous.map((pou) => pou.name.toUpperCase()))
  for (const pou of project.pous) {
    for (const section of pou.sections) {
      if (section.language !== 'ST' || typeof section.stText !== 'string') continue
      const scoped = extractBodyDeclarations(section.stText)
      const normalized = normalizeSource(scoped.text)
      const lines = normalized.split('\n')

      for (const word of ['IF', 'CASE', 'FOR', 'WHILE']) {
        const open = new RegExp(`\\b${word}\\b`, 'g')
        const close = new RegExp(`\\bEND_${word}\\b`, 'g')
        const delta = countBalance(normalized, open, close)
        if (delta !== 0) {
          issues.push({
            severity: delta > 0 ? 'error' : 'warning',
            code: 'unbalanced-block',
            pou: pou.name,
            line: null,
            message: `${word} 块不配平（${delta > 0 ? '缺少' : '多出'} END_${word}，差值 ${delta}）`,
          })
        }
      }

      // No \b boundaries: JavaScript treats CJK identifiers as non-word characters,
      // so \b would never match a name such as 未声明变量A.
      const pattern = /[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*/g
      lines.forEach((line, index) => {
        const lineNumber = index + 1
        let match
        pattern.lastIndex = 0
        while ((match = pattern.exec(line)) !== null) {
          const word = match[0]
          const upper = word.toUpperCase()
          const before = match.index > 0 ? line[match.index - 1] : ''
          const after = match.index + word.length < line.length ? line[match.index + word.length] : ''
          if (before === '.') continue // member access: only the root is a real reference
          if (after === ':') continue // declaration syntax
          if (KEYWORDS.has(upper) || LITERAL.test(word)) continue
          if (/^(?:T|DT|TIME|DATE|TOD)#/i.test(word)) continue
          if (scoped.names.has(word) || declared.has(word)) continue
          if (pouNames.has(upper)) continue
          if (/^[A-Z][A-Z0-9_]*$/.test(word)) continue // constants such as P_First_Run, MAX_SPEED
          issues.push({
            severity: 'error',
            code: 'undeclared-identifier',
            pou: pou.name,
            line: lineNumber,
            identifier: word,
            message: `未声明标识符 ${word}（第 ${lineNumber} 行）`,
          })
        }
      })
    }
  }

  for (const [name, count] of duplicates) {
    issues.push({
      severity: 'error',
      code: 'duplicate-variable',
      variable: name,
      message: `变量 ${name} 在变量表中定义了 ${count} 次`,
    })
  }
  for (const [address, names] of addresses) {
    const unique = [...new Set(names)]
    if (unique.length > 1) {
      issues.push({
        severity: 'warning',
        code: 'duplicate-address',
        variable: unique[0],
        message: `地址 ${address} 被多个变量使用：${unique.join(', ')}`,
      })
    }
  }

  const uniqueIssues = []
  const seen = new Set()
  for (const issue of issues) {
    const key = `${issue.pou ?? ''}|${issue.line ?? ''}|${issue.code}|${issue.identifier ?? issue.variable ?? ''}|${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueIssues.push(issue)
  }
  const errors = uniqueIssues.filter((issue) => issue.severity === 'error').length
  const warnings = uniqueIssues.filter((issue) => issue.severity === 'warning').length
  return {
    ok: errors === 0,
    project: project.name,
    path: project.path,
    stats: {
      pous: project.pous.length,
      stSections: project.pous.reduce((total, pou) => total + pou.sections.filter((section) => section.language === 'ST').length, 0),
      variables: declared.size,
      tables: project.tables.length,
    },
    errors,
    warnings,
    issues: uniqueIssues.slice(0, 200),
    truncated: uniqueIssues.length > 200,
  }
}
