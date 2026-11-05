/** Fixed diagnostics only. Never include input excerpts or underlying exceptions. */
export class LumenTransferError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'LumenTransferError'
    this.code = code
  }
}
export function fail(code: string): never {
  throw new LumenTransferError(code)
}
export function scalarString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}
