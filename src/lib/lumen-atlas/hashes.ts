import { fail, scalarString } from './errors'

const encoder = new TextEncoder()
export const maxPackageBytes = 2 * 1024 * 1024
export const maxFrontmatterBytes = 64 * 1024

export function utf8(value: string): Uint8Array<ArrayBuffer> {
  if (!scalarString(value)) fail('invalid_unicode')
  return encoder.encode(value)
}
export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  try {
    const result = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(result), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return fail('hash_unavailable')
  }
}
export function comparisonBytes(
  title: string,
  tags: readonly string[],
  markdown: string,
): Uint8Array<ArrayBuffer> {
  const prefix = utf8('LUMEN-ATLAS-COMPARE\x00\x01')
  const encoded = [utf8(title), ...tags.map(utf8), utf8(markdown)]
  const bytes = new Uint8Array(
    prefix.length + 4 + encoded.reduce((sum, part) => sum + 4 + part.length, 0),
  )
  const view = new DataView(bytes.buffer)
  let offset = prefix.length
  bytes.set(prefix)
  function write(part: Uint8Array) {
    view.setUint32(offset, part.length, false)
    offset += 4
    bytes.set(part, offset)
    offset += part.length
  }
  write(encoded[0]!)
  view.setUint32(offset, tags.length, false)
  offset += 4
  encoded.slice(1).forEach(write)
  return bytes
}
export function comparisonHash(
  title: string,
  tags: readonly string[],
  markdown: string,
): Promise<string> {
  return sha256(comparisonBytes(title, tags, markdown))
}
/** Fingerprint complete local records; different from the transfer comparison hash. */
export function recordHash(value: unknown): Promise<string> {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical)
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, val]) => [key, canonical(val)]),
      )
    return item
  }
  return sha256(utf8(JSON.stringify(canonical(value))))
}
