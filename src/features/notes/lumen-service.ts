import { database, repository } from '../../data/service'
import { LumenAtlasRepository } from '../../data/repositories/lumen-atlas-repository'
import { readLumenDraftStatus } from './draft-store'
import { LumenTransferSession } from './lumen-session'

export function createLumenSession() {
  return new LumenTransferSession(
    new LumenAtlasRepository(database, readLumenDraftStatus),
    repository,
  )
}
