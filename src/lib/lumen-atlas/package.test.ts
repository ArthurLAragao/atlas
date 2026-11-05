import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import vectors from './fixtures/hash-vectors.json'
import {
  comparisonBytes,
  comparisonHash,
  maxPackageBytes,
  sha256,
  utf8,
} from './hashes'
import { decodeLumenPackage } from './package'
import { strictJson } from './strict-json'
import { checkFrontmatter } from './frontmatter'
import {
  changedPackage,
  decodeSample,
  packageBytes,
  payload,
  sampleText,
  setupCrypto,
} from './test-fixtures'

beforeEach(setupCrypto)
afterEach(() => vi.unstubAllGlobals())
describe('Python/TypeScript framing and preservation', () => {
  it.each(vectors)('verifies the Python vector $name', async (vector) => {
    expect(Buffer.from(utf8(vector.markdown)).toString('hex')).toBe(
      vector.source_utf8_hex,
    )
    expect(vector.markdown.length).toBe(vector.markdown_utf16_units)
    expect(await sha256(utf8(vector.markdown))).toBe(vector.source_sha256)
    expect(
      Buffer.from(
        comparisonBytes(vector.title, vector.tags, vector.markdown),
      ).toString('hex'),
    ).toBe(vector.comparison_preimage_hex)
    expect(
      await comparisonHash(vector.title, vector.tags, vector.markdown),
    ).toBe(vector.comparison_sha256)
  })
  it('validates the Python package and preserves full source/YAML', async () => {
    const pkg = await decodeSample()
    expect(pkg.source_sha256).toBe(
      'f57f8ac5e245538b6701c364d4be0de714dc23b5e13849f6dca9ad495efb904c',
    )
    expect(pkg.comparison_sha256).toBe(
      '61ca7ac6faa0fe425595dcce7195881956a02320e96cd221a91025ea4b9d1f94',
    )
    expect(pkg.markdown).toBe(payload().markdown)
    expect(pkg.markdown.startsWith('---\n')).toBe(true)
    expect(pkg.origin.status).toBe('reviewed')
    expect(Object.isFrozen(pkg.tags)).toBe(true)
  })
  it('preserves BOM/CRLF, decomposed Unicode, astral characters, code and links', async () => {
    const bytes = await changedPackage({
      title: 'Unicode \u00e1 A\u0301 \ud83d\ude00',
      tags: ['\ud83d\ude00'],
      bom: true,
      crlf: true,
      text: '<script>never()</script>\n[[path|alias]]\n```sh\nexit 99\n```\n',
    })
    const before = new Uint8Array(bytes)
    const pkg = await decodeLumenPackage(bytes)
    expect(pkg.markdown.startsWith('\ufeff---\r\n')).toBe(true)
    expect(pkg.markdown).toContain('A\u0301')
    expect(pkg.markdown).toContain('[[path|alias]]')
    expect(
      createHash('sha256').update(pkg.markdown, 'utf8').digest('hex'),
    ).toBe(pkg.source_sha256)
    expect(Array.from(bytes)).toEqual(Array.from(before))
  })
  it('owns its input copy across asynchronous verification', async () => {
    const bytes = await changedPackage()
    const task = decodeLumenPackage(bytes)
    bytes.fill(0)
    expect((await task).title).toBe(payload().title)
  })
})
describe('strict package validation', () => {
  it.each([
    '{',
    '{"x":NaN}',
    '{"x":Infinity}',
    '{"x":1e999}',
    '{"x":1.0}',
    '{"x":true,}',
    '[1,]',
    '{"x":"\\q"}',
    '{"x":"\\ud800"}',
    '\ufeff{}',
  ])('rejects invalid JSON %s', (text) => {
    expect(() => strictJson(text)).toThrow()
  })
  it.each([
    '{"title":"a","title":"b"}',
    '{"title":1,"ti\\u0074le":2}',
    '{"origin":{"x":1,"x":2}}',
    '{"__proto__":1,"__proto__":2}',
  ])('rejects duplicate keys before overwrite', (text) => {
    expect(() => strictJson(text)).toThrow('duplicate_json_key')
  })
  it('rejects package-level duplicates and deeply nested JSON without excerpts', async () => {
    await expect(
      decodeLumenPackage(
        utf8(sampleText.replace('"version": 1', '"version": 1, "version": 1')),
      ),
    ).rejects.toThrow('duplicate_json_key')
    await expect(
      decodeLumenPackage(utf8('['.repeat(1000) + '0' + ']'.repeat(1000))),
    ).rejects.toThrow('json_complexity')
  })
  it('rejects malformed UTF-8 and a JSON-level BOM', async () => {
    await expect(decodeLumenPackage(new Uint8Array([0xff]))).rejects.toThrow(
      'invalid_utf8',
    )
    await expect(
      decodeLumenPackage(utf8('\ufeff' + sampleText)),
    ).rejects.toThrow('json_bom')
  })
  it('enforces exactly 2 MiB of encoded JSON, not characters', async () => {
    const source = utf8(sampleText)
    const exact = new Uint8Array(maxPackageBytes).fill(32)
    exact.set(source)
    await expect(decodeLumenPackage(exact)).resolves.toHaveProperty(
      'title',
      payload().title,
    )
    await expect(
      decodeLumenPackage(new Uint8Array(maxPackageBytes + 1)),
    ).rejects.toThrow('package_size')
  })
  it.each([
    { unexpected: true },
    { version: 2 },
    { version: true },
    { title: 123 },
    { title: ' title ' },
    { title: '[[' },
    { title: '\ud800' },
    { tags: [true] },
    { tags: [''] },
    { tags: [' x '] },
    { integration_id: 'other' },
    { baseline_sha256: 'A'.repeat(64) },
    { source_sha256: false },
    { origin: { ...(payload().origin as object), extra: true } },
    { origin: { ...(payload().origin as object), lumen_export: 'true' } },
    { origin: { ...(payload().origin as object), created: '2026-02-30' } },
  ])('rejects wrong fields/types/limits', async (change) => {
    await expect(
      decodeLumenPackage(utf8(JSON.stringify({ ...payload(), ...change }))),
    ).rejects.toThrow()
  })
  it.each(['none', 'suggest'])(
    'accepts passive atlas_action %s',
    async (action) => {
      const base = payload()
      const markdown = (base.markdown as string).replace(
        'atlas_action: none',
        'atlas_action: ' + action,
      )
      const origin = { ...(base.origin as object), atlas_action: action }
      await expect(
        decodeLumenPackage(await packageBytes({ markdown, origin })),
      ).resolves.toHaveProperty('origin.atlas_action', action)
    },
  )
  it('rejects mismatched YAML metadata and independently wrong hashes', async () => {
    await expect(
      decodeLumenPackage(await packageBytes({ title: 'Wrong title' })),
    ).rejects.toThrow('metadata_mismatch')
    for (const field of ['source_sha256', 'comparison_sha256']) {
      await expect(
        decodeLumenPackage(
          utf8(JSON.stringify({ ...payload(), [field]: '0'.repeat(64) })),
        ),
      ).rejects.toThrow('hash_mismatch')
    }
  })
  it('counts UTF-16 at title/tag/content bounds including YAML and BOM', async () => {
    await expect(
      decodeLumenPackage(
        await changedPackage({
          title: '\ud83d\ude00'.repeat(120),
          tags: ['\ud83d\ude00'.repeat(30)],
        }),
      ),
    ).resolves.toHaveProperty('title')
    await expect(
      decodeLumenPackage(
        await changedPackage({ title: '\ud83d\ude00'.repeat(121) }),
      ),
    ).rejects.toThrow()
    await expect(
      decodeLumenPackage(
        await changedPackage({ tags: ['\ud83d\ude00'.repeat(31)] }),
      ),
    ).rejects.toThrow()
    const data = JSON.parse(
      new TextDecoder().decode(await changedPackage()),
    ) as Record<string, unknown>
    const markdown = data.markdown as string
    const exact = markdown + 'x'.repeat(500_000 - markdown.length)
    await expect(
      decodeLumenPackage(await packageBytes({ ...data, markdown: exact })),
    ).resolves.toHaveProperty('markdown', exact)
    await expect(
      decodeLumenPackage(
        await packageBytes({ ...data, markdown: exact + 'x' }),
      ),
    ).rejects.toThrow()
  })
  it('keeps diagnostics free of note content and emits editorial warnings', async () => {
    const marker = 'PRIVATE_FICTIONAL_MARKER'
    try {
      await decodeLumenPackage(utf8('{"' + marker + '":NaN}'))
      throw new Error('Expected rejection')
    } catch (error) {
      expect(String(error)).not.toContain(marker)
    }
    const pkg = await decodeLumenPackage(
      await changedPackage({ yaml: 'extra: preserved\n' }),
    )
    expect(pkg.warnings).toContain('unknown_yaml_properties')
    expect(pkg.warnings).toContain('missing_section_0')
  })
})
describe('restricted YAML coherence without rewriting', () => {
  it.each([
    'title: &anchor value\n',
    'title: *anchor\n',
    'title: !!str value\n',
    'title: value\n',
    'extra: {nested: value}\n',
    'extra: [1]\n',
    '<<: value\n',
    '%YAML 1.1\n',
    'extra: !!python/object value\n',
  ])('rejects forbidden/duplicate structure', async (yaml) => {
    await expect(
      decodeLumenPackage(await changedPackage({ yaml })),
    ).rejects.toThrow()
  })
  it('accepts comments, single quotes, block strings and block lists consistently', async () => {
    const bytes = await changedPackage()
    const base = JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >
    let markdown = base.markdown as string
    markdown = markdown
      .replace(
        'title: "Fictional Atlas transfer"',
        "title: 'Fictional Atlas transfer' # comment",
      )
      .replace('source: "fictional-test"', 'source: >-\n  fictional-test')
      .replace('tags: ["fictional","teste"]', 'tags:\n - fictional\n - teste')
    const pkg = await decodeLumenPackage(
      await packageBytes({ ...base, markdown }),
    )
    expect(pkg.markdown).toBe(markdown)
  })
  it('uses PyYAML booleans, rejects a float schema and retains date strings', async () => {
    const base = JSON.parse(
      new TextDecoder().decode(await changedPackage()),
    ) as Record<string, unknown>
    const markdown = base.markdown as string
    await expect(
      decodeLumenPackage(
        await packageBytes({
          ...base,
          markdown: markdown.replace('lumen_export: true', 'lumen_export: YES'),
        }),
      ),
    ).resolves.toHaveProperty('origin.lumen_export', true)
    for (const replacement of ['1.0', 'true', '"1"'])
      await expect(
        decodeLumenPackage(
          await packageBytes({
            ...base,
            markdown: markdown.replace(
              'lumen_schema: 1',
              'lumen_schema: ' + replacement,
            ),
          }),
        ),
      ).rejects.toThrow()
    expect(() =>
      checkFrontmatter(
        markdown.replace('lumen_export: true', 'lumen_export: y'),
      ),
    ).toThrow('ineligible_lifecycle')
  })
  it('enforces 64 KiB of frontmatter in bytes and a nonempty body', async () => {
    const base = payload()
    await expect(
      decodeLumenPackage(
        await packageBytes({
          markdown: (base.markdown as string).replace(
            '---\n',
            '---\n#' + 'a'.repeat(65536) + '\n',
          ),
        }),
      ),
    ).rejects.toThrow('frontmatter_too_large')
    const source = base.markdown as string
    expect(() =>
      checkFrontmatter(source.slice(0, source.indexOf('\n---\n') + 5)),
    ).toThrow('empty_body')
  })
})
