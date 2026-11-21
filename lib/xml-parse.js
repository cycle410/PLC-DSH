/**
 * Small, dependency-free XML reader for Simatic ML exports.
 *
 * The plugin only needs to walk element trees (no schema validation, no namespaces beyond
 * the literal prefixed names TIA writes), so this keeps a full DOM out of the bundle.
 * A node is `{ name, attributes, children, text, parent }`; tag names are kept verbatim
 * (`SW.Blocks.FB` stays dotted).
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[body] ?? match
  })
}

function parseAttributes(source) {
  const attributes = {}
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3] ?? '')
  }
  return attributes
}

/** Parse an XML document and return its root node. Throws on a malformed document. */
export function parseXml(xml) {
  const text = String(xml ?? '')
  const root = { name: '#document', attributes: {}, children: [], text: '', parent: null }
  let current = root
  let index = 0
  while (index < text.length) {
    const open = text.indexOf('<', index)
    if (open < 0) {
      current.text += decodeEntities(text.slice(index))
      break
    }
    if (open > index) current.text += decodeEntities(text.slice(index, open))
    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open + 4)
      if (end < 0) throw new Error('Unterminated XML comment.')
      index = end + 3
      continue
    }
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open + 9)
      if (end < 0) throw new Error('Unterminated CDATA section.')
      current.text += text.slice(open + 9, end)
      index = end + 3
      continue
    }
    if (text.startsWith('<?', open) || text.startsWith('<!', open)) {
      const end = text.indexOf('>', open)
      if (end < 0) throw new Error('Unterminated processing instruction.')
      index = end + 1
      continue
    }
    const close = text.indexOf('>', open)
    if (close < 0) throw new Error('Unterminated XML tag.')
    const body = text.slice(open + 1, close)
    if (body.startsWith('/')) {
      const name = body.slice(1).trim()
      if (current.name !== name && current.name !== '#document') {
        throw new Error(`Mismatched closing tag: </${name}> while inside <${current.name}>.`)
      }
      current = current.parent ?? root
      index = close + 1
      continue
    }
    const selfClosing = body.endsWith('/')
    const inner = selfClosing ? body.slice(0, -1) : body
    const space = inner.search(/\s/)
    const name = (space < 0 ? inner : inner.slice(0, space)).trim()
    const node = {
      name,
      attributes: space < 0 ? {} : parseAttributes(inner.slice(space)),
      children: [],
      text: '',
      parent: current,
    }
    current.children.push(node)
    if (!selfClosing) current = node
    index = close + 1
  }
  return root
}

/** Depth-first search for the first descendant with this tag name. */
export function findNode(node, name) {
  if (!node) return undefined
  if (node.name === name) return node
  for (const child of node.children) {
    const found = findNode(child, name)
    if (found) return found
  }
  return undefined
}

/** Depth-first search for every descendant with this tag name. */
export function findNodes(node, name, found = []) {
  if (!node) return found
  for (const child of node.children) {
    if (child.name === name) found.push(child)
    findNodes(child, name, found)
  }
  return found
}

/** Concatenated text of a node and its descendants. */
export function textOf(node) {
  if (!node) return ''
  let text = node.text
  for (const child of node.children) text += textOf(child)
  return text.trim()
}
