/**
 * Design review for ST POUs, distilled from the local `plc-skill` checklists
 * (alarm/interlock patterns, code-review checklists, scan-cycle ownership).
 *
 * These are heuristics, not a compiler: they point at patterns that repeatedly
 * caused real defects in the reviewed projects. Findings carry severity,
 * POU, line, the offending snippet and a concrete suggestion.
 */

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

function snippetAt(text, index, length = 120) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  const lineEnd = text.indexOf('\n', index)
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim()
  return line.length > length ? `${line.slice(0, length)}…` : line
}

function addFinding(findings, key, finding) {
  if (findings.some((item) => item.key === key)) return
  findings.push({ key, ...finding })
}

export function reviewStSources(sources = []) {
  const findings = []
  for (const source of sources) {
    const name = source.name ?? '?'
    const text = String(source.stText ?? '')
    if (text.trim() === '') continue

    // 1. A timer's Q output is a level: counting inside `IF t.Q THEN` adds one per scan.
    const timerIf = /IF\s+([A-Za-z_][\w.]*\.Q)\s+THEN([\s\S]*?)END_IF\s*;/gi
    let match
    while ((match = timerIf.exec(text)) !== null) {
      const condition = match[1]
      const body = match[2]
      const increment = /([A-Za-z_][\w.]*)\s*:=\s*\1\s*\+\s*1\b/.test(body) || /\.Count\s*:=\s*[^;]*\+\s*1\b/i.test(body)
      if (!increment) continue
      addFinding(findings, `level-count:${name}:${condition}:${match.index}`, {
        severity: 'P1',
        rule: 'level-triggered-counter',
        pou: name,
        line: lineAt(text, match.index),
        code: snippetAt(text, match.index),
        title: `${condition} 是电平，计数每个扫描周期加 1`,
        detail:
          '定时器的 Q 在条件持续期间一直为 TRUE，把 Count + 1 放在 `IF t.Q THEN` 里会按扫描周期累加，几秒钟就上万。',
        suggestion:
          '用 R_TRIG 取 t.Q 的上升沿再计数，或用锁存位做门闩（例如 IF t.Q AND NOT ALM.Latched THEN Count+1; Latched:=TRUE; END_IF;）。',
      })
    }

    // 2. An interlock that only gates the start request stops protecting a running machine.
    if (/oStartAllow\s*:=/i.test(text) && /\biInterlock\b/.test(text)) {
      const started = /Sys\.Started\s*:=\s*([^;]+);/i.exec(text)
      if (started && !/\biInterlock\b/i.test(started[1]) && !/IF\s+NOT\s+iInterlock/i.test(text)) {
        addFinding(findings, `interlock-start-only:${name}`, {
          severity: 'P1',
          rule: 'interlock-dropped-after-start',
          pou: name,
          line: lineAt(text, started.index),
          code: snippetAt(text, started.index),
          title: 'iInterlock 只参与启动允许，运行中失效不会停机',
          detail:
            '门被打开或气源丢失时 oStartAllow 变 FALSE，但 bRunning/Sys.Started 仍保持，设备继续动作。',
          suggestion:
            '增加 `IF NOT iInterlock THEN bRunning := FALSE; END_IF;`，并在 `Sys.Started := ...` 条件里加 `AND iInterlock`。',
        })
      }
    }

    // 3. Single-coil mode with no close sensor: the close timeout condition excludes itself.
    const closeTimer = /tTmoClose\s*\(\s*IN\s*:=\s*([\s\S]*?)\r?\n\s*PT\s*:=/i.exec(text)
    if (closeTimer && /NoCloseSen/i.test(closeTimer[1])) {
      addFinding(findings, `close-timeout-disabled:${name}`, {
        severity: 'P1',
        rule: 'close-timeout-disabled',
        pou: name,
        line: lineAt(text, closeTimer.index),
        code: snippetAt(text, closeTimer.index),
        title: '无关闭到位开关时，关超时条件被排除，关不动也不会报警',
        detail:
          '单线圈模式下 oClose 恒为 FALSE，`NOT NoCloseSen` 又把无传感器模式排除，整个关超时条件恒为 FALSE。',
        suggestion:
          '确认这是否是有意设计；若需要检测，改用 TravelTime 模拟判据或补装关到位传感器，并把这层限制写进注释。',
      })
    }

    // 4. Edge instances that are clocked but whose Q is never read are dead logic.
    const edgeCall = /([A-Za-z_]\w*)\s*\(\s*CLK\s*:=/g
    while ((match = edgeCall.exec(text)) !== null) {
      const instance = match[1]
      const read = new RegExp(`\\b${instance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.Q\\b`)
      if (read.test(text)) continue
      addFinding(findings, `unused-edge:${name}:${instance}`, {
        severity: 'P2',
        rule: 'unused-edge-instance',
        pou: name,
        line: lineAt(text, match.index),
        code: snippetAt(text, match.index),
        title: `边沿实例 ${instance} 只更新，从未读取 .Q`,
        detail: '调用 R_TRIG/F_TRIG 会更新状态，但代码里没有任何地方使用它的 .Q，冲突检测或触发逻辑可能没生效。',
        suggestion: '删除这个实例，或把冲突/触发判断改成真正读取它 .Q；不要只保留调用。',
      })
    }

    // 5. The same target assigned twice in a row is usually a merge leftover.
    const lines = text.split(/\r?\n/)
    let previous = null
    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim()
      if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('(*') || trimmed.startsWith('*')) continue
      const assignment = /^([A-Za-z_][\w.]*)\s*:=\s*[^;]+;\s*$/.exec(trimmed)
      if (!assignment) {
        previous = null
        continue
      }
      if (previous && previous.target === assignment[1]) {
        addFinding(findings, `duplicate-assignment:${name}:${index}`, {
          severity: 'P2',
          rule: 'duplicate-assignment',
          pou: name,
          line: index + 1,
          code: trimmed,
          title: `${assignment[1]} 连续赋值两次`,
          detail: '相邻两行写同一个目标，第一行永远被覆盖，通常是合并/调试残留。',
          suggestion: '删掉多余的一行，或确认两次赋值之间确实缺少了条件分支。',
        })
      }
      previous = { target: assignment[1], line: index + 1 }
    }

    // 6. Self-referential latch (`x := (cond OR x) AND NOT reset`) works only by scan semantics.
    const latch = /([A-Za-z_][\w.]*)\s*:=\s*\(([^;]*?)\b\1\b([^;]*?)\)\s*AND\s*NOT\s*([^;]+);/i.exec(text)
    if (latch) {
      addFinding(findings, `self-latch:${name}:${latch[1]}`, {
        severity: 'P3',
        rule: 'self-referential-latch',
        pou: name,
        line: lineAt(text, latch.index),
        code: snippetAt(text, latch.index),
        title: `${latch[1]} 用自引用锁存，依赖读旧值的扫描语义`,
        detail: '`x := (cond OR x) AND NOT reset` 能跑，但阅读和在线排障都更困难，也难以看出复位优先级。',
        suggestion: '拆成显式置位/复位：`IF cond THEN x := TRUE; END_IF; IF reset THEN x := FALSE; END_IF;`',
      })
    }
  }

  const rank = { P1: 1, P2: 2, P3: 3 }
  findings.sort((left, right) => rank[left.severity] - rank[right.severity] || left.pou.localeCompare(right.pou) || left.line - right.line)
  return findings
}
