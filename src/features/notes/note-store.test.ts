import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { emptySnapshot, type Note, type Snapshot } from '../../data/models'
import { buildSeed } from '../../data/seed'
import { repository } from '../../data/service'
import { useNotes } from './note-store'

const savedNote = (note: Note): Note => ({
  ...note,
  content: 'Conteúdo salvo pelo repository.',
  isExample: false,
  updatedAt: '2026-10-02T13:00:00Z',
})
function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error | DOMException) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  useData.setState({
    data: buildSeed(new Date('2026-10-02T12:00:00Z')),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useNotes.setState({ message: '', error: null, canUndo: false })
})
afterEach(() => vi.restoreAllMocks())

describe('gravação otimista de notas', () => {
  it('mostra o rascunho imediatamente, bloqueia gravações concorrentes e usa o snapshot confirmado', async () => {
    const before = useData.getState().data
    const original = before.notes[0]!
    const draft = { ...original, content: 'Rascunho em edição.' }
    const confirmed = savedNote(draft)
    const expected = original.updatedAt
    const request = deferred<{ data: Snapshot; saved: Note }>()
    const save = vi
      .spyOn(repository, 'saveNote')
      .mockReturnValueOnce(request.promise)
    const archive = vi.spyOn(repository, 'archiveNote')
    const remove = vi.spyOn(repository, 'removeNote')
    vi.spyOn(repository, 'canUndoNoteChange').mockResolvedValue(false)
    const pending = useNotes.getState().save(draft, expected)
    expect(useData.getState().busy).toBe(true)
    expect(
      useData.getState().data.notes.find((note) => note.id === draft.id),
    ).toEqual({ ...draft, isExample: false })
    expect(await useNotes.getState().save(draft, expected)).toBeNull()
    expect(await useNotes.getState().archive(draft.id, true)).toBe(false)
    expect(await useNotes.getState().remove(draft.id)).toBe(false)
    expect(save).toHaveBeenCalledExactlyOnceWith(draft, expected)
    expect(archive).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    const result = {
      ...before,
      notes: before.notes.map((note) =>
        note.id === confirmed.id ? confirmed : note,
      ),
    }
    request.resolve({ saved: confirmed, data: result })
    expect(await pending).toEqual(confirmed)
    expect(useData.getState().data).toEqual(result)
    expect(useData.getState().busy).toBe(false)
    expect(useNotes.getState().message).toBe('Nota salva.')
    expect(useNotes.getState().error).toBeNull()
  })

  it('restaura o snapshot anterior quando uma gravação falha e a releitura também falha', async () => {
    const before = useData.getState().data
    const original = before.notes[0]!
    const request = deferred<{ data: Snapshot; saved: Note }>()
    vi.spyOn(repository, 'saveNote').mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'snapshot').mockRejectedValueOnce(
      new Error('Leitura indisponível'),
    )
    useNotes.setState({ canUndo: true, message: 'Uma ação anterior.' })
    const pending = useNotes
      .getState()
      .save(
        { ...original, content: 'Alteração não salva.' },
        original.updatedAt,
      )
    expect(
      useData.getState().data.notes.find((note) => note.id === original.id)
        ?.content,
    ).toBe('Alteração não salva.')
    request.reject(new DOMException('full', 'QuotaExceededError'))
    expect(await pending).toBeNull()
    expect(useData.getState().data).toEqual(before)
    expect(useData.getState().busy).toBe(false)
    expect(useNotes.getState().canUndo).toBe(true)
    expect(useNotes.getState().message).toBe('')
    expect(useNotes.getState().error).toContain('armazenamento está cheio')
  })

  it('recarrega a versão atual após conflito e mantém o erro que permite recuperar o rascunho', async () => {
    const before = useData.getState().data
    const original = before.notes[0]!
    const current = {
      ...before,
      notes: before.notes.map((note) =>
        note.id === original.id ? savedNote(note) : note,
      ),
    }
    vi.spyOn(repository, 'saveNote').mockRejectedValueOnce(
      new Error(
        'Esta nota mudou em outra aba. Copie seu rascunho e reabra a versão salva.',
      ),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(current)
    expect(
      await useNotes
        .getState()
        .save({ ...original, content: 'Rascunho local.' }, original.updatedAt),
    ).toBeNull()
    expect(useData.getState().data).toEqual(current)
    expect(useNotes.getState().error).toContain('Copie seu rascunho')
    expect(useData.getState().busy).toBe(false)
  })

  it('confirma uma gravação persistida mesmo com leitura posterior de metadados indisponível', async () => {
    const before = useData.getState().data
    const original = before.notes[0]!
    const confirmed = savedNote(original)
    const data = {
      ...before,
      notes: before.notes.map((note) =>
        note.id === original.id ? confirmed : note,
      ),
    }
    vi.spyOn(repository, 'saveNote').mockResolvedValueOnce({
      data,
      saved: confirmed,
    })
    vi.spyOn(repository, 'canUndoNoteChange').mockRejectedValueOnce(
      new Error('Metadados indisponíveis'),
    )
    const snapshot = vi
      .spyOn(repository, 'snapshot')
      .mockRejectedValue(new Error('Leitura posterior indisponível'))
    useNotes.setState({ canUndo: true })
    expect(
      await useNotes.getState().save(original, original.updatedAt),
    ).toEqual(confirmed)
    expect(useData.getState().data).toEqual(data)
    expect(snapshot).not.toHaveBeenCalled()
    expect(useNotes.getState()).toMatchObject({
      message: 'Nota salva.',
      error: null,
      canUndo: true,
    })
    expect(useData.getState().busy).toBe(false)
  })

  it('adiciona uma nova nota de forma otimista e remove a criação quando a persistência falha', async () => {
    const before = useData.getState().data
    const draft = { ...before.notes[0]!, id: 'new-note', title: 'Nova nota' }
    const request = deferred<{ data: Snapshot; saved: Note }>()
    const save = vi
      .spyOn(repository, 'saveNote')
      .mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    const pending = useNotes.getState().save(draft, null)
    expect(useData.getState().data.notes).toHaveLength(before.notes.length + 1)
    expect(save).toHaveBeenCalledExactlyOnceWith(draft, null)
    request.reject(new Error('Não foi possível salvar. Tente novamente.'))
    expect(await pending).toBeNull()
    expect(useData.getState().data).toEqual(before)
    expect(useNotes.getState().message).toBe('')
    expect(useNotes.getState().error).toContain('Tente novamente')
  })
})

describe('ações destrutivas e desfazer de notas', () => {
  it.each([true, false])(
    'atualiza o arquivo otimista, preserva outros registros e confirma arquivado=%s',
    async (archived) => {
      const before = useData.getState().data
      const original = before.notes[0]!
      const request = deferred<Snapshot>()
      const archive = vi
        .spyOn(repository, 'archiveNote')
        .mockReturnValueOnce(request.promise)
      vi.spyOn(repository, 'canUndoNoteChange').mockResolvedValue(true)
      const pending = useNotes.getState().archive(original.id, archived)
      const optimistic = useData.getState().data
      const target = optimistic.notes.find((note) => note.id === original.id)!
      expect(target.archivedAt).toEqual(archived ? expect.any(String) : null)
      expect({ ...target, archivedAt: undefined }).toEqual({
        ...original,
        archivedAt: undefined,
      })
      expect(optimistic.tasks).toEqual(before.tasks)
      expect(
        optimistic.notes.filter((note) => note.id !== original.id),
      ).toEqual(before.notes.filter((note) => note.id !== original.id))
      expect(archive).toHaveBeenCalledExactlyOnceWith(original.id, archived)
      request.resolve(optimistic)
      expect(await pending).toBe(true)
      expect(useNotes.getState().canUndo).toBe(true)
      expect(useNotes.getState().message).toContain(
        archived ? 'Nota arquivada.' : 'Nota desarquivada.',
      )
      expect(useData.getState().busy).toBe(false)
    },
  )

  it('reverte exclusão otimista protegida por vínculos sem apagar o histórico anterior', async () => {
    const before = useData.getState().data
    const original = before.notes[0]!
    const request = deferred<Snapshot>()
    vi.spyOn(repository, 'removeNote').mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    useNotes.setState({ canUndo: true })
    const pending = useNotes.getState().remove(original.id)
    expect(
      useData.getState().data.notes.some((note) => note.id === original.id),
    ).toBe(false)
    expect(useData.getState().data.tasks).toEqual(before.tasks)
    expect(useData.getState().busy).toBe(true)
    request.reject(
      new Error('Esta nota tem vínculos em outros registros. Arquive a nota.'),
    )
    expect(await pending).toBe(false)
    expect(useData.getState().data).toEqual(before)
    expect(useNotes.getState()).toMatchObject({
      canUndo: true,
      message: '',
      error: expect.stringContaining('Arquive a nota'),
    })
    expect(useData.getState().busy).toBe(false)
  })

  it('desfaz somente após confirmação e respeita o histórico restante de várias ações', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    const undo = vi
      .spyOn(repository, 'undoNoteChange')
      .mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'canUndoNoteChange')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    useNotes.setState({ canUndo: true })
    const pending = useNotes.getState().undo()
    expect(useData.getState().data).toEqual(before)
    expect(useData.getState().busy).toBe(true)
    expect(await useNotes.getState().undo()).toBe(false)
    expect(undo).toHaveBeenCalledTimes(1)
    request.resolve(before)
    expect(await pending).toBe(true)
    expect(useNotes.getState()).toMatchObject({
      canUndo: true,
      error: null,
      message: 'Ação desfeita. Nota recuperada.',
    })
    undo.mockResolvedValueOnce(before)
    expect(await useNotes.getState().undo()).toBe(true)
    expect(useNotes.getState().canUndo).toBe(false)
    expect(useData.getState().busy).toBe(false)
  })

  it('mantém disponível o desfazer quando um registro alterado bloqueia a recuperação', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'undoNoteChange').mockRejectedValueOnce(
      new Error(
        'A nota mudou depois desta ação. A versão atual foi preservada.',
      ),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    useNotes.setState({ canUndo: true })
    expect(await useNotes.getState().undo()).toBe(false)
    expect(useData.getState().data).toEqual(before)
    expect(useNotes.getState()).toMatchObject({
      canUndo: true,
      message: '',
      error: expect.stringContaining('versão atual foi preservada'),
    })
    expect(useData.getState().busy).toBe(false)
  })

  it('não começa uma operação enquanto outro módulo grava no repository', async () => {
    useData.setState({ busy: true })
    const before = useData.getState().data
    const save = vi.spyOn(repository, 'saveNote')
    const archive = vi.spyOn(repository, 'archiveNote')
    const remove = vi.spyOn(repository, 'removeNote')
    const undo = vi.spyOn(repository, 'undoNoteChange')
    expect(await useNotes.getState().save(before.notes[0]!, null)).toBeNull()
    expect(await useNotes.getState().archive(before.notes[0]!.id, true)).toBe(
      false,
    )
    expect(await useNotes.getState().remove(before.notes[0]!.id)).toBe(false)
    expect(await useNotes.getState().undo()).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(archive).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
    expect(useData.getState().data).toEqual(before)
    expect(useData.getState().busy).toBe(true)
  })

  it('atualiza disponibilidade do histórico sem alterar o conteúdo e fecha somente mensagens', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'canUndoNoteChange').mockResolvedValueOnce(true)
    await useNotes.getState().refreshUndo()
    expect(useNotes.getState().canUndo).toBe(true)
    expect(useData.getState().data).toEqual(before)
    useNotes.setState({ message: 'Nota arquivada.', error: 'Falha anterior.' })
    useNotes.getState().dismiss()
    expect(useNotes.getState()).toMatchObject({
      canUndo: true,
      message: '',
      error: null,
    })
    expect(useData.getState().data).toEqual(before)
    expect(useData.getState().data).not.toEqual(emptySnapshot())
  })
})
