import { fail, scalarString } from './errors'

/** Duplicate-aware parser: keys are checked before building any object. */
export function strictJson(text: string): unknown {
  let offset = 0
  let tokens = 0
  const whitespace = () => {
    while (/[\x20\t\r\n]/u.test(text[offset] ?? '\0')) offset++
  }
  function string(): string {
    const start = offset++
    while (offset < text.length) {
      const char = text[offset++]!
      if (char === '\\') {
        offset++
      } else if (char === '"') {
        let value: unknown
        try {
          value = JSON.parse(text.slice(start, offset))
        } catch {
          fail('invalid_json')
        }
        if (!scalarString(value)) fail('invalid_unicode')
        return value
      }
    }
    return fail('invalid_json')
  }
  function value(depth: number): unknown {
    if (++tokens > 4096 || depth > 16) fail('json_complexity')
    whitespace()
    const char = text[offset]
    if (char === '"') return string()
    if (char === '{') {
      offset++
      const result: Record<string, unknown> = Object.create(null)
      const keys = new Set<string>()
      whitespace()
      if (text[offset] === '}') {
        offset++
        return result
      }
      while (true) {
        whitespace()
        if (text[offset] !== '"') fail('invalid_json')
        const key = string()
        if (keys.has(key)) fail('duplicate_json_key')
        keys.add(key)
        whitespace()
        if (text[offset++] !== ':') fail('invalid_json')
        result[key] = value(depth + 1)
        whitespace()
        const separator = text[offset++]
        if (separator === '}') return result
        if (separator !== ',') fail('invalid_json')
      }
    }
    if (char === '[') {
      offset++
      const result: unknown[] = []
      whitespace()
      if (text[offset] === ']') {
        offset++
        return result
      }
      while (true) {
        result.push(value(depth + 1))
        whitespace()
        const separator = text[offset++]
        if (separator === ']') return result
        if (separator !== ',') fail('invalid_json')
      }
    }
    for (const [literal, result] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length
        return result
      }
    }
    const number = text
      .slice(offset)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0]
    if (!number || /[.eE]/u.test(number)) fail('invalid_json_number')
    offset += number.length
    const result = Number(number)
    if (!Number.isSafeInteger(result)) fail('invalid_json_number')
    return result
  }
  const result = value(0)
  whitespace()
  if (offset !== text.length) fail('invalid_json')
  return result
}
