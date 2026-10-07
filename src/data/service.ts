import { DexieAtlasRepository } from './repositories/dexie-repository'
import type { AtlasRepository } from './repositories/atlas-repository'

// Single composition root: feature code depends only on the repository contract.
export const repository: AtlasRepository = new DexieAtlasRepository()
