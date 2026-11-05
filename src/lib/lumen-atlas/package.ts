import { z } from 'zod'
import { checkFrontmatter, validDate } from './frontmatter'
import { fail, LumenTransferError } from './errors'
import { comparisonHash, maxPackageBytes, sha256, utf8 } from './hashes'
import { strictJson } from './strict-json'

export const hexHash = z.string().regex(/^[0-9a-f]{64}$/u)
const trimmed = (min: number, max: number) =>
  z.string().refine((s) => s.length >= min && s.length <= max && s.trim() === s)
const originSchema = z
  .object({
    lumen_schema: z.literal(1),
    type: z.literal('research'),
    topic: z
      .string()
      .max(240)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    source: z
      .string()
      .refine(
        (s) => s.length <= 4096 && (s.trim().length > 0 || /\x85/u.test(s)),
      ),
    created: z.string().refine(validDate),
    status: z.literal('reviewed'),
    lumen_export: z.literal(true),
    atlas_action: z.enum(['none', 'suggest']),
  })
  .strict()
const packageSchema = z
  .object({
    format: z.literal('lumen-atlas-note'),
    version: z.literal(1),
    integration_id: z.string().regex(/^lumen_[0-9a-f]{32}$/u),
    title: trimmed(1, 240).refine((s) => !/\[\[|\]\]|[\r\n]/u.test(s)),
    tags: z.array(trimmed(1, 60)).max(50),
    markdown: z.string().refine((s) => s.length <= 500_000),
    origin: originSchema,
    source_sha256: hexHash,
    comparison_sha256: hexHash,
    baseline_sha256: hexHash.nullable(),
  })
  .strict()
export type LumenPackage = Readonly<z.infer<typeof packageSchema>> & {
  readonly warnings: readonly string[]
  readonly package_sha256: string
}
const validated = new WeakSet<object>()
export function assertPackage(value: LumenPackage): void {
  if (!validated.has(value)) fail('unvalidated_package')
}
export async function decodeLumenPackage(
  input: Uint8Array,
): Promise<LumenPackage> {
  if (
    !ArrayBuffer.isView(input) ||
    Object.prototype.toString.call(input) !== '[object Uint8Array]' ||
    input.byteLength > maxPackageBytes
  )
    fail('package_size')
  // Own copy avoids caller mutation during asynchronous hash computation.
  const bytes = new Uint8Array(input)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    fail('json_bom')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    )
  } catch {
    return fail('invalid_utf8')
  }
  try {
    const parsed = packageSchema.safeParse(strictJson(text))
    if (!parsed.success) fail('invalid_package_fields')
    const value = parsed.data
    const checked = checkFrontmatter(value.markdown)
    const metadata = checked.metadata
    if (
      metadata.title !== value.title ||
      JSON.stringify(metadata.tags) !== JSON.stringify(value.tags) ||
      Object.entries(value.origin).some(([key, val]) => metadata[key] !== val)
    )
      fail('metadata_mismatch')
    if (
      (await sha256(utf8(value.markdown))) !== value.source_sha256 ||
      (await comparisonHash(value.title, value.tags, value.markdown)) !==
        value.comparison_sha256
    )
      fail('hash_mismatch')
    const result = Object.freeze({
      ...value,
      tags: Object.freeze(value.tags) as unknown as string[],
      origin: Object.freeze(value.origin),
      warnings: Object.freeze([...checked.warnings]),
      package_sha256: await sha256(bytes),
    })
    validated.add(result)
    return result
  } catch (error) {
    if (error instanceof LumenTransferError) throw error
    return fail('invalid_package')
  }
}
