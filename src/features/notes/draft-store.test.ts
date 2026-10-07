import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDraft } from './draft-store'

const key = 'atlas.note-drafts.v1'
const draft = (title = 'Anotação'): NoteDraft => ({
  title,
  content: '# Conteúdo\n\nIdeias ainda não salvas em [[AWS]].',
  tags: 'cloud, faculdade',
  basedOn: '2026-10-02T12:00:00Z',
})
const loadStore = async () => (await import('./draft-store')).useDrafts

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('rascunhos recuperáveis de notas', () => {
  it('persiste todos os campos sem modificar o Markdown e os recupera após reload', async () => {
    const useDrafts = await loadStore()
    const first = draft()
    const second = { ...draft('Outra nota'), content: 'Uma segunda anotação.' }
    useDrafts.getState().put('first', first)
    useDrafts.getState().put('second', second)
    expect(useDrafts.getState()).toMatchObject({
      drafts: { first, second },
      error: false,
    })
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ first, second })
    vi.resetModules()
    const reloaded = await loadStore()
    expect(reloaded.getState()).toMatchObject({
      drafts: { first, second },
      error: false,
    })
  })

  it('mantém o texto mais recente em memória quando a escrita falha e permite repetir', async () => {
    const useDrafts = await loadStore()
    const before = draft()
    useDrafts.getState().put('first', before)
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
    const latest = {
      ...before,
      content: 'Texto longo que continua disponível para copiar.',
    }
    expect(() => useDrafts.getState().put('first', latest)).not.toThrow()
    expect(useDrafts.getState()).toMatchObject({
      drafts: { first: latest },
      error: true,
    })
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ first: before })
    write.mockRestore()
    useDrafts.getState().put('first', latest)
    expect(useDrafts.getState().error).toBe(false)
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ first: latest })
  })

  it('limpa apenas o rascunho solicitado e conserva outro rascunho já presente', async () => {
    const first = draft()
    const second = draft('Outra anotação')
    localStorage.setItem(key, JSON.stringify({ first, second }))
    const useDrafts = await loadStore()
    useDrafts.getState().clear('first')
    expect(useDrafts.getState()).toMatchObject({
      drafts: { second },
      error: false,
    })
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ second })
    vi.resetModules()
    expect((await loadStore()).getState().drafts).toEqual({ second })
  })

  it('não apaga um rascunho de outra aba ao limpar uma nota local', async () => {
    const first = draft()
    localStorage.setItem(key, JSON.stringify({ first }))
    const useDrafts = await loadStore()
    const external = draft('Rascunho em outra aba')
    localStorage.setItem(key, JSON.stringify({ first, external }))
    useDrafts.getState().clear('first')
    expect(useDrafts.getState().drafts).toEqual({})
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ external })
    vi.resetModules()
    expect((await loadStore()).getState().drafts).toEqual({ external })
  })

  it('preserva a edição mais recente de outro ID quando grava seu próprio rascunho', async () => {
    const first = draft()
    const staleExternal = draft('Versão antiga')
    localStorage.setItem(
      key,
      JSON.stringify({ first, external: staleExternal }),
    )
    const useDrafts = await loadStore()
    const external = {
      ...staleExternal,
      content: 'Alteração feita em outra aba.',
    }
    localStorage.setItem(key, JSON.stringify({ first, external }))
    const local = { ...first, content: 'Alteração local.' }
    useDrafts.getState().put('first', local)
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      first: local,
      external,
    })
  })

  it('uma leitura negada não interrompe a edição e uma escrita negada mantém o rascunho', async () => {
    const read = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
    const useDrafts = await loadStore()
    expect(useDrafts.getState().drafts).toEqual({})
    const latest = draft()
    expect(() => useDrafts.getState().put('first', latest)).not.toThrow()
    expect(useDrafts.getState()).toMatchObject({
      drafts: { first: latest },
      error: true,
    })
    read.mockRestore()
  })

  it.each([
    { label: 'JSON inválido', stored: 'not JSON' },
    { label: 'array', stored: '[]' },
    { label: 'null', stored: 'null' },
    {
      label: 'título numérico',
      stored: JSON.stringify({ first: { ...draft(), title: 123 } }),
    },
    {
      label: 'conteúdo acima do limite',
      stored: JSON.stringify({
        first: { ...draft(), content: 'x'.repeat(500_001) },
      }),
    },
    {
      label: 'título acima do limite',
      stored: JSON.stringify({ first: { ...draft(), title: 'x'.repeat(241) } }),
    },
    {
      label: 'tags acima do limite',
      stored: JSON.stringify({ first: { ...draft(), tags: 'x'.repeat(4001) } }),
    },
  ])(
    'ignora estrutura inválida sem sobrescrever o valor original: $label',
    async ({ stored }) => {
      localStorage.setItem(key, stored)
      const useDrafts = await loadStore()
      expect(useDrafts.getState().drafts).toEqual({})
      expect(localStorage.getItem(key)).toBe(stored)
      const latest = draft()
      useDrafts.getState().put('first', latest)
      expect(useDrafts.getState()).toMatchObject({
        drafts: { first: latest },
        error: true,
      })
      expect(localStorage.getItem(key)).toBe(stored)
    },
  )
})
