import { DexieAtlasRepository } from './repositories/dexie-repository'
import type { AtlasRepository } from './repositories/atlas-repository'
import { createDatabase } from './database'
import { activeLumenTestSession } from '../lib/lumen-test-environment'

// Single composition root: feature code depends only on the repository contract.
export const database = createDatabase(
  activeLumenTestSession
    ? 'atlas-lumen-test-' + activeLumenTestSession
    : undefined,
)
export const repository: AtlasRepository = new DexieAtlasRepository(database)
