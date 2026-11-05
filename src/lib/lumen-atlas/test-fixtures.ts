/// <reference types="node" />
import { createHash, webcrypto } from 'node:crypto'
import { vi } from 'vitest'
import example from './fixtures/example.lumen-atlas.json?raw'
import { comparisonHash, utf8 } from './hashes'
import { decodeLumenPackage } from './package'

export const sampleText = example
export const id = 'lumen_' + 'a'.repeat(32)
export const setupCrypto = () => vi.stubGlobal('crypto', webcrypto)
export function payload(): Record<string, unknown> {
  return JSON.parse(example) as Record<string, unknown>
}
export async function packageBytes(
  overrides: Record<string, unknown> = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const data = { ...payload(), ...overrides }
  data.source_sha256 = createHash('sha256')
    .update(data.markdown as string, 'utf8')
    .digest('hex')
  data.comparison_sha256 = await comparisonHash(
    data.title as string,
    data.tags as string[],
    data.markdown as string,
  )
  return utf8(JSON.stringify(data))
}
export async function changedPackage(
  options: {
    id?: string
    title?: string
    tags?: string[]
    text?: string
    baseline?: string | null
    bom?: boolean
    crlf?: boolean
    yaml?: string
  } = {},
) {
  const base = payload()
  const title = options.title ?? (base.title as string)
  const tags = options.tags ?? (base.tags as string[])
  const metadata = {
    ...(base.origin as Record<string, unknown>),
    title,
    tags,
    atlas_task_id: '',
    atlas_goal_id: '',
  }
  let markdown =
    '---\n' +
    Object.entries(metadata)
      .map(([key, value]) => key + ': ' + JSON.stringify(value))
      .join('\n') +
    '\n---\n# ' +
    title +
    '\n\n' +
    (options.text ??
      'Fictional body. [[Knowledge/Example|Alias]]\n\n```js\nthrow new Error("INERT");\n```\n')
  if (options.yaml) markdown = markdown.replace('---\n', '---\n' + options.yaml)
  if (options.crlf) markdown = markdown.replaceAll('\n', '\r\n')
  if (options.bom) markdown = '\ufeff' + markdown
  return packageBytes({
    integration_id: options.id ?? id,
    title,
    tags,
    markdown,
    baseline_sha256: options.baseline ?? null,
  })
}
export const decodeSample = () => decodeLumenPackage(utf8(example))
