import { inflateRawSync } from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 0x10000 - 22)
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset
  }
  return -1
}

/**
 * Minimal read-only ZIP reader for the archive formats Sysmac Studio and TIA
 * Portal produce: stored and deflate entries, no ZIP64 and no encryption.
 */
export class ZipArchive {
  constructor(buffer) {
    this.buffer = buffer
    this.entries = new Map()
    this.notes = []
    this.#readCentralDirectory()
  }

  #readCentralDirectory() {
    const buffer = this.buffer
    const eocd = findEndOfCentralDirectory(buffer)
    if (eocd < 0) throw new Error('Not a ZIP archive: no end-of-central-directory record')
    const count = buffer.readUInt16LE(eocd + 10)
    const directorySize = buffer.readUInt32LE(eocd + 12)
    const directoryOffset = buffer.readUInt32LE(eocd + 16)
    if (directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
      throw new Error('ZIP64 archives are not supported')
    }
    let cursor = directoryOffset
    for (let index = 0; index < count; index += 1) {
      if (cursor + 46 > buffer.length) break
      if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
        this.notes.push('Central directory ended early; later entries were ignored.')
        break
      }
      const flags = buffer.readUInt16LE(cursor + 8)
      const method = buffer.readUInt16LE(cursor + 10)
      const compressedSize = buffer.readUInt32LE(cursor + 20)
      const uncompressedSize = buffer.readUInt32LE(cursor + 24)
      const nameLength = buffer.readUInt16LE(cursor + 28)
      const extraLength = buffer.readUInt16LE(cursor + 30)
      const commentLength = buffer.readUInt16LE(cursor + 32)
      const localOffset = buffer.readUInt32LE(cursor + 42)
      const name = buffer
        .subarray(cursor + 46, cursor + 46 + nameLength)
        .toString('utf8')
        .replace(/\\/g, '/')
      this.entries.set(name, {
        name,
        method,
        compressedSize,
        uncompressedSize,
        localOffset,
        encrypted: (flags & 0x1) === 1,
      })
      cursor += 46 + nameLength + extraLength + commentLength
    }
  }

  names() {
    return [...this.entries.keys()]
  }

  has(name) {
    return this.entries.has(name)
  }

  /** Decompress one entry; returns undefined when the entry is absent or unreadable. */
  read(name) {
    const entry = this.entries.get(name)
    if (!entry) return undefined
    if (entry.encrypted) {
      this.notes.push(`${name} is encrypted and was skipped.`)
      return undefined
    }
    const buffer = this.buffer
    const local = entry.localOffset
    if (local + 30 > buffer.length) return undefined
    const nameLength = buffer.readUInt16LE(local + 26)
    const extraLength = buffer.readUInt16LE(local + 28)
    const start = local + 30 + nameLength + extraLength
    const end = start + entry.compressedSize
    if (start > buffer.length || end > buffer.length) return undefined
    const compressed = buffer.subarray(start, Math.min(end, buffer.length))
    if (entry.method === 0) return compressed
    if (entry.method === 8) {
      try {
        return inflateRawSync(compressed)
      } catch {
        this.notes.push(`${name} could not be inflated.`)
        return undefined
      }
    }
    this.notes.push(`${name} uses unsupported compression method ${entry.method}.`)
    return undefined
  }

  text(name) {
    const bytes = this.read(name)
    if (!bytes) return undefined
    const decoded = bytes.toString('utf8')
    return decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded
  }
}
