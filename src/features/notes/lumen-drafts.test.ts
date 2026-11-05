import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  noteDraftStorageKey,
  readLumenDraftStatus,
  useDrafts,
} from './draft-store'
const draft = {
  title: 'Fictional',
  content: 'Pending',
  tags: '',
  basedOn: 'before',
}
beforeEach(() => {
  localStorage.clear()
  useDrafts.setState({ drafts: {}, error: false })
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  useDrafts.setState({ drafts: {}, error: false })
})
it('reads persistent and memory union without saving or clearing either source', () => {
  localStorage.setItem(noteDraftStorageKey, JSON.stringify({ disk: draft }))
  useDrafts.setState({ drafts: { memory: draft } })
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const clear = vi.spyOn(Storage.prototype, 'removeItem')
  expect(readLumenDraftStatus()).toEqual({
    checked: true,
    ids: ['memory', 'disk'],
  })
  expect(write).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
})
it.each(['{broken', '{"invalid":{}}', 'null'])(
  'fails closed on corrupt storage: %s',
  (value) => {
    localStorage.setItem(noteDraftStorageKey, value)
    expect(readLumenDraftStatus().checked).toBe(false)
  },
)
it('fails closed on denied storage and failed persistence', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('Denied')
  })
  expect(readLumenDraftStatus().checked).toBe(false)
  read.mockRestore()
  useDrafts.setState({ error: true })
  expect(readLumenDraftStatus().checked).toBe(false)
})
