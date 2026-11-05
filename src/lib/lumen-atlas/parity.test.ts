import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import cases from './fixtures/python-package-cases.json'
import { decodeLumenPackage } from './package'
import { utf8 } from './hashes'
import { setupCrypto } from './test-fixtures'
beforeEach(setupCrypto)
afterEach(() => vi.unstubAllGlobals())
it.each(cases)(
  'matches the executed Python package result: $name',
  async (test) => {
    if (test.accepted)
      await expect(
        decodeLumenPackage(utf8(test.package)),
      ).resolves.toHaveProperty('format', 'lumen-atlas-note')
    else await expect(decodeLumenPackage(utf8(test.package))).rejects.toThrow()
  },
)
