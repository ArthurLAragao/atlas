import {
  CST,
  Lexer,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Scalar,
} from 'yaml'
import { fail, scalarString } from './errors'
import { maxFrontmatterBytes, utf8 } from './hashes'

export const lumenFields = [
  'lumen_schema',
  'title',
  'type',
  'topic',
  'tags',
  'source',
  'created',
  'status',
  'lumen_export',
  'atlas_action',
  'atlas_task_id',
  'atlas_goal_id',
] as const
const sections = [
  'Resumo',
  'Explica\u00e7\u00e3o',
  'Exemplos e aplica\u00e7\u00e3o',
  'Revis\u00e3o',
  'Fontes',
  'Registro pessoal',
]
/* eslint-disable no-control-regex -- Match Python whitespace for Lumen scalar/body validation. */
const pythonSpace =
  /^[\x09-\x0d\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/u
/* eslint-enable no-control-regex */
const bool =
  /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/u
const integer =
  /^[-+]?(?:0b[01_]+|0[0-7_]+|(?:0|[1-9][0-9_]*)|0x[0-9a-fA-F_]+|[1-9][0-9_]*(?::[0-5]?[0-9])+)$/u
const float =
  /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/u
type Value = {
  kind: 'string' | 'integer' | 'float' | 'boolean' | 'null'
  value: unknown
}
function resolve(node: Scalar): Value {
  if (node.value === null) return { kind: 'null', value: null }
  if (!scalarString(node.value)) fail('invalid_yaml_scalar')
  const text = node.value
  if (node.type !== 'PLAIN') return { kind: 'string', value: text }
  if (text === '=') fail('invalid_yaml_scalar')
  if (bool.test(text))
    return { kind: 'boolean', value: /^(?:yes|true|on)$/iu.test(text) }
  if (/^(?:~|null|Null|NULL|)$/u.test(text))
    return { kind: 'null', value: null }
  if (integer.test(text)) {
    const clean = text.replaceAll('_', '')
    const sign = clean.startsWith('-') ? -1n : 1n
    const digits = clean.replace(/^[-+]/u, '')
    if (/^(?:0|[1-9][0-9]*)$/u.test(digits) && digits.length > 4300)
      fail('invalid_yaml_scalar')
    let value: bigint
    try {
      if (digits.includes(':'))
        value = digits
          .split(':')
          .reduce((sum, part) => sum * 60n + BigInt(part), 0n)
      else
        value = BigInt(
          /^0[0-7]+$/u.test(digits) ? '0o' + digits.slice(1) : digits,
        )
    } catch {
      return fail('invalid_yaml_scalar')
    }
    return { kind: 'integer', value: sign * value }
  }
  if (float.test(text)) return { kind: 'float', value: text }
  return { kind: 'string', value: text }
}
export interface CheckedFrontmatter {
  metadata: Readonly<Record<string, unknown>>
  warnings: readonly string[]
}
/** Flat scalar/list profile with PyYAML-compatible resolution; never reserializes Markdown. */
export function checkFrontmatter(markdown: string): CheckedFrontmatter {
  if (markdown.includes('\0')) fail('nul_byte')
  const clean = markdown.startsWith('\ufeff') ? markdown.slice(1) : markdown
  /* eslint-disable no-control-regex -- Python splitlines recognizes these separators; retain their bytes. */
  const lines =
    clean
      .match(
        /[^\n\r\v\f\x1c-\x1e\x85\u2028\u2029]*(?:\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]|$)/gu,
      )
      ?.filter(Boolean) ?? []
  /* eslint-enable no-control-regex */
  if (lines[0]?.replace(/[\r\n]+$/u, '') !== '---') fail('missing_frontmatter')
  let size = 0
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.replace(/[\r\n]+$/u, '') === '---') {
      end = i
      break
    }
    size += utf8(lines[i]!).length
    if (size > maxFrontmatterBytes) fail('frontmatter_too_large')
  }
  if (end < 0) fail('unclosed_frontmatter')
  const frontmatter = lines.slice(1, end).join('')
  const body = lines.slice(end + 1).join('')
  if (pythonSpace.test(body)) fail('empty_body')
  // This lexical pass rejects features even in otherwise unused metadata.
  for (const token of new Lexer().lex(frontmatter)) {
    const type = CST.tokenType(token)
    if (
      type &&
      [
        'anchor',
        'alias',
        'tag',
        'directive-line',
        'doc-start',
        'doc-end',
      ].includes(type)
    )
      fail('yaml_feature_forbidden')
  }
  const document = parseDocument(frontmatter, {
    schema: 'failsafe',
    merge: false,
    uniqueKeys: true,
    prettyErrors: false,
    logLevel: 'silent',
    resolveKnownTags: false,
    keepSourceTokens: true,
  })
  if (document.errors.length) fail('invalid_yaml')
  if (!isMap(document.contents)) fail('frontmatter_not_mapping')
  const metadata: Record<string, unknown> = Object.create(null)
  let tokens =
    4 +
    (document.contents.flow
      ? Math.max(0, document.contents.items.length - 1)
      : 0) // stream + mapping boundaries
  const seen = new Set<string>()
  for (const pair of document.contents.items) {
    if (!isScalar(pair.key)) fail('invalid_yaml_key')
    const key = resolve(pair.key)
    if (key.kind !== 'string') fail('invalid_yaml_key')
    const name = key.value as string
    if (name === '<<') fail('yaml_merge_forbidden')
    if (seen.has(name)) fail('duplicate_yaml_key')
    seen.add(name)
    const hasColon =
      pair.srcToken?.sep?.some((token) => token.type === 'map-value-ind') ??
      false
    const explicitKey =
      pair.srcToken?.start.some((token) => token.type === 'explicit-key-ind') ??
      false
    tokens +=
      1 +
      (!document.contents.flow || hasColon || explicitKey ? 1 : 0) +
      (hasColon ? 1 : 0)
    if (isSeq(pair.value)) {
      const values: string[] = []
      tokens +=
        2 +
        pair.value.items.length +
        (pair.value.flow
          ? Math.max(0, pair.value.items.length - 1)
          : pair.value.items.length)
      for (const node of pair.value.items) {
        if (!isScalar(node)) fail('unsupported_yaml_structure')
        const item = resolve(node)
        if (item.kind !== 'string') fail('unsupported_yaml_structure')
        values.push(item.value as string)
      }
      metadata[name] = values
    } else if (pair.value === null) metadata[name] = null
    else if (isScalar(pair.value)) {
      if (pair.value.type !== 'PLAIN' || pair.value.source !== '') tokens++
      const item = resolve(pair.value)
      if (name === 'lumen_schema' && item.kind !== 'integer')
        fail('invalid_lumen_schema')
      metadata[name] = item.value
    } else fail('unsupported_yaml_structure')
  }
  if (tokens > 4096) fail('yaml_too_complex')
  if (lumenFields.some((name) => !seen.has(name))) fail('required_yaml_field')
  if (metadata.lumen_schema !== 1n) fail('invalid_lumen_schema')
  metadata.lumen_schema = 1
  for (const name of ['title', 'source'])
    if (!scalarString(metadata[name]) || pythonSpace.test(metadata[name]))
      fail('invalid_yaml_metadata')
  if (
    metadata.type !== 'research' ||
    metadata.status !== 'reviewed' ||
    metadata.lumen_export !== true ||
    metadata.atlas_task_id !== '' ||
    metadata.atlas_goal_id !== '' ||
    !['none', 'suggest'].includes(metadata.atlas_action as string)
  )
    fail('ineligible_lifecycle')
  if (
    !scalarString(metadata.topic) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(metadata.topic)
  )
    fail('invalid_topic')
  if (!Array.isArray(metadata.tags) || !metadata.tags.every(scalarString))
    fail('invalid_yaml_tags')
  if (!scalarString(metadata.created) || !validDate(metadata.created))
    fail('invalid_created')
  const warnings: string[] = []
  if (
    [...seen].some(
      (name) => !lumenFields.includes(name as (typeof lumenFields)[number]),
    )
  )
    warnings.push('unknown_yaml_properties')
  const headings: string[] = []
  const found = new Set<string>()
  let fence: { char: string; length: number } | null = null
  // eslint-disable-next-line no-control-regex -- Match Python splitlines in editorial heading checks.
  for (const line of body.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/u)?.[1]
    if (marker) {
      if (!fence) fence = { char: marker[0]!, length: marker.length }
      else if (marker[0] === fence.char && marker.length >= fence.length)
        fence = null
      continue
    }
    if (fence) continue
    if (line.startsWith('# ')) headings.push(line.slice(2).trim())
    if (line.startsWith('## ')) found.add(line.slice(3).trim())
  }
  if (headings[0] !== metadata.title) warnings.push('title_heading')
  for (let i = 0; i < sections.length; i++)
    if (!found.has(sections[i]!)) warnings.push('missing_section_' + i)
  return { metadata, warnings }
}
export function validDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return (
    day <=
    [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
  )
}
