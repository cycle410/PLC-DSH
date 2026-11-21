/**
 * Extract an interface from a Simatic ML block export.
 *
 * TIA writes the interface as an `<Interface><Sections>` element with Openness
 * Interface v4/v5 markup:
 *   <Section Name="Input">
 *     <Member Name="StartButton" Datatype="Bool">
 *       <Comment><MultiLanguageText Lang="en-US">start</MultiLanguageText></Comment>
 *     </Member>
 *   </Section>
 * Struct members nest further `<Member>` elements, which become "a.b" names here.
 */
import { findNode, findNodes, parseXml, textOf } from './xml-parse.js'

export function parseBlockInterface(xmlText) {
  let root
  try {
    root = parseXml(xmlText)
  } catch (error) {
    return { sections: [], error: error instanceof Error ? error.message : String(error) }
  }
  const interfaceNode = findNode(root, 'Interface')
  if (!interfaceNode) return { sections: [], error: 'The exported XML has no Interface element.' }
  const sectionsNode = findNode(interfaceNode, 'Sections')
  if (!sectionsNode) return { sections: [], error: 'The Interface has no Sections element.' }
  const sections = []
  for (const section of sectionsNode.children) {
    if (section.name !== 'Section') continue
    sections.push({ name: section.attributes?.Name ?? '', members: collectMembers(section, '', 0) })
  }
  return { sections }
}

function collectMembers(node, prefix, depth) {
  const members = []
  for (const child of node.children ?? []) {
    if (child.name !== 'Member') continue
    const name = child.attributes?.Name ?? ''
    const full = prefix ? `${prefix}.${name}` : name
    members.push({
      name: full,
      dataType: child.attributes?.Datatype ?? '',
      startValue: child.attributes?.StartValue ?? '',
      comment: memberComment(child),
    })
    if (depth < 2) members.push(...collectMembers(child, full, depth + 1))
  }
  return members
}

function memberComment(memberNode) {
  const commentNode = findNode(memberNode, 'Comment')
  if (!commentNode) return ''
  const candidates = [...findNodes(commentNode, 'MultiLanguageText'), ...findNodes(commentNode, 'Text')]
  for (const node of candidates) {
    const text = textOf(node)
    if (text !== '') return text
  }
  return ''
}
