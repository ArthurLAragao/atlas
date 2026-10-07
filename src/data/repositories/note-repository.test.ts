import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { emptySnapshot, type Note, type Task } from '../models'
import { DexieAtlasRepository } from './dexie-repository'
import { validateSnapshot } from '../../lib/data-integrity'

let repository: DexieAtlasRepository
const originalTime = '2020-01-01T00:00:00Z'
const note = (id = 'aws', title = 'AWS'): Note => ({
  id,
  title,
  content: '# Conhecimento\n\nConteúdo da nota.',
  tags: ['cloud', 'faculdade'],
  links: [],
  isExample: true,
  createdAt: originalTime,
  updatedAt: originalTime,
})
const task = (id = 'study'): Task => ({
  id,
  title: 'Estudar AWS',
  status: 'todo',
  priority: 'high',
  dueDate: null,
  dueTime: null,
  context: 'Faculdade',
  subtasks: [],
  repeat: null,
  focusMinutes: 0,
  tags: ['cloud'],
  links: [],
  isExample: false,
  createdAt: originalTime,
  updatedAt: originalTime,
})
async function insert(notes: Note[], tasks: Task[] = []) {
  const data = validateSnapshot({ ...emptySnapshot(), notes, tasks })
  await repository.database.transaction(
    'rw',
    repository.database.tables,
    async () => {
      await repository.database.table('notes').bulkPut(data.notes)
      await repository.database.table('tasks').bulkPut(data.tasks)
    },
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 9, 2, 12))
  repository = new DexieAtlasRepository(
    createDatabase(`atlas-notes-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await repository.database.delete()
})

describe('gravação de notas e conflitos entre abas', () => {
  it('cria e edita conteúdo sem perder metadados nem sobrescrever a data de criação', async () => {
    await insert([], [task()])
    const input = {
      ...note(),
      links: [{ type: 'tasks' as const, id: 'study' }],
      archivedAt: null,
    }
    const created = await repository.saveNote(input, null)
    expect(created.saved).toEqual({
      ...input,
      isExample: false,
      updatedAt: new Date().toISOString(),
    })
    expect(created.data.notes).toEqual([created.saved])
    vi.setSystemTime(new Date(2026, 9, 2, 13))
    const edited = await repository.saveNote(
      {
        ...created.saved,
        createdAt: '2025-01-01T00:00:00Z',
        content: '# Revisão\n\nUma mudança.',
      },
      created.saved.updatedAt,
    )
    expect(edited.saved).toEqual({
      ...created.saved,
      content: '# Revisão\n\nUma mudança.',
      updatedAt: new Date().toISOString(),
    })
    expect(await repository.snapshot()).toEqual(edited.data)
    repository.database.close()
    await repository.database.open()
    expect(await repository.get('notes', input.id)).toEqual(edited.saved)
  })

  it('rejeita uma versão obsoleta e a criação que reutiliza ID existente, preservando tudo', async () => {
    await insert([note(), note('other', 'Outra nota')])
    const saved = (await repository.saveNote(note(), originalTime)).saved
    const before = await repository.snapshot()
    await expect(
      repository.saveNote(
        { ...note(), content: 'Rascunho antigo' },
        originalTime,
      ),
    ).rejects.toThrow(/outra aba/)
    await expect(
      repository.saveNote({ ...saved, content: 'Colisão de ID' }, null),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.snapshot()).toEqual(before)
  })

  it('serializa duas gravações do mesmo rascunho sem perder a primeira alteração', async () => {
    await insert([note()])
    const results = await Promise.allSettled([
      repository.saveNote(
        { ...note(), content: 'Primeira alteração' },
        originalTime,
      ),
      repository.saveNote(
        { ...note(), content: 'Segunda alteração' },
        originalTime,
      ),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    const fulfilled = results.find((result) => result.status === 'fulfilled')
    if (fulfilled?.status !== 'fulfilled')
      throw new Error('Gravação esperada ausente')
    expect(await repository.get('notes', 'aws')).toEqual(fulfilled.value.saved)
  })

  it('mantém o token de versão distinto mesmo em duas edições no mesmo milissegundo', async () => {
    const created = (await repository.saveNote(note(), null)).saved
    const first = await repository.saveNote(
      { ...created, content: 'Primeira edição.' },
      created.updatedAt,
    )
    expect(first.saved.updatedAt).not.toBe(created.updatedAt)
    await expect(
      repository.saveNote(
        { ...created, content: 'Versão obsoleta de outra aba.' },
        created.updatedAt,
      ),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.get('notes', created.id)).toEqual(first.saved)
  })

  it.each(['Título [[reservado]]', 'Nome ]] inválido', 'Linha\nseguinte'])(
    'recusa um título incompatível com links sem modificar os registros: %s',
    async (title) => {
      await insert([note()])
      const before = await repository.snapshot()
      await expect(
        repository.saveNote({ ...note(), title }, originalTime),
      ).rejects.toThrow(/título/)
      expect(await repository.snapshot()).toEqual(before)
    },
  )
})

describe('renomeação transacional de links internos', () => {
  it('atualiza todos os links resolvidos, inclusive o próprio texto, e mantém Markdown literal e metadados', async () => {
    const linked = {
      ...note('linked', 'Resumo'),
      content:
        'Leia [[ aws ]] e [[AWS]].\n\n`[[AWS]]`\n\n```md\n[[AWS]]\n```\n\n\\[[AWS]]\n\n[site](https://example.com/[[AWS]])',
      links: [{ type: 'tasks' as const, id: 'study' }],
      archivedAt: '2026-09-30T12:00:00Z',
    }
    const unrelated = note('unrelated', 'Livro')
    await insert(
      [{ ...note(), content: 'Voltar a [[AWS]].' }, linked, unrelated],
      [task()],
    )
    const result = await repository.saveNote(
      { ...note(), title: 'Amazon Web Services', content: 'Voltar a [[AWS]].' },
      originalTime,
    )
    expect(result.saved.content).toBe('Voltar a [[Amazon Web Services]].')
    const rewritten = result.data.notes.find((item) => item.id === 'linked')!
    expect(rewritten).toEqual({
      ...linked,
      content:
        'Leia [[Amazon Web Services]] e [[Amazon Web Services]].\n\n`[[AWS]]`\n\n```md\n[[AWS]]\n```\n\n\\[[AWS]]\n\n[site](https://example.com/[[AWS]])',
      isExample: false,
      updatedAt: rewritten.updatedAt,
    })
    expect(Date.parse(rewritten.updatedAt)).toBeGreaterThan(
      Date.parse(linked.updatedAt),
    )
    expect(Date.parse(rewritten.updatedAt)).toBeGreaterThanOrEqual(Date.now())
    expect(result.data.notes.find((item) => item.id === unrelated.id)).toEqual(
      unrelated,
    )
    expect(result.data.tasks).toEqual([task()])
    expect(await repository.snapshot()).toEqual({
      ...result.data,
      notes: result.data.notes.toSorted((a, b) => a.id.localeCompare(b.id)),
    })
  })

  it('não escolhe uma das notas de título duplicado ao renomear um alvo ambíguo', async () => {
    const linked = { ...note('linked', 'Resumo'), content: 'Leia [[ AWS ]].' }
    await insert([note(), note('duplicate', ' aws '), linked])
    const result = await repository.saveNote(
      { ...note(), title: 'Cloud' },
      originalTime,
    )
    expect(result.data.notes.find((item) => item.id === 'linked')).toEqual(
      linked,
    )
    expect(
      result.data.notes.find((item) => item.id === 'duplicate')?.title,
    ).toBe('aws')
    expect(result.saved.title).toBe('Cloud')
  })

  it('invalida também a versão de outra nota reescrita pelo rename no mesmo milissegundo', async () => {
    const linked = {
      ...note('linked', 'Resumo'),
      content: 'Leia [[AWS]].',
      updatedAt: new Date().toISOString(),
    }
    await insert([note(), linked])
    const result = await repository.saveNote(
      { ...note(), title: 'Cloud' },
      originalTime,
    )
    const rewritten = result.data.notes.find((item) => item.id === linked.id)!
    expect(rewritten.updatedAt).not.toBe(linked.updatedAt)
    await expect(
      repository.saveNote(
        { ...linked, content: 'Rascunho antigo ainda usa [[AWS]].' },
        linked.updatedAt,
      ),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.get('notes', linked.id)).toEqual(rewritten)
  })

  it('permite importar e criar títulos duplicados sem inventar vínculos por ID', async () => {
    await insert([note()])
    const duplicate = await repository.saveNote(note('duplicate', 'AWS'), null)
    expect(duplicate.data.notes).toHaveLength(2)
    expect(duplicate.data.notes.map((item) => item.links)).toEqual([[], []])
  })

  it('bloqueia rename que tornaria ambíguo um título único, inclusive variantes de caixa e espaços', async () => {
    await insert([note(), note('other', 'Cloud')])
    const before = await repository.snapshot()
    await expect(
      repository.saveNote({ ...note(), title: ' cloud ' }, originalTime),
    ).rejects.toThrow(/Já existe/)
    expect(await repository.snapshot()).toEqual(before)
  })

  it('reverte a nota e todos os links se a escrita transacional de renomeação falhar', async () => {
    await insert([note(), { ...note('linked', 'Resumo'), content: '[[AWS]]' }])
    const before = await repository.snapshot()
    vi.spyOn(
      repository.database.table('notes'),
      'bulkPut',
    ).mockRejectedValueOnce(new Error('Falha na gravação'))
    await expect(
      repository.saveNote({ ...note(), title: 'Cloud' }, originalTime),
    ).rejects.toThrow('Falha na gravação')
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(false)
  })
})

describe('arquivar e excluir notas com histórico persistente', () => {
  it('desfaz várias ações após reabrir o banco e recupera cada snapshot exato', async () => {
    await insert([note(), note('other', 'Outra nota')], [task()])
    const original = await repository.snapshot()
    const archived = await repository.archiveNote('aws', true)
    expect(archived.notes.find((item) => item.id === 'aws')).toEqual({
      ...note(),
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExample: false,
    })
    vi.setSystemTime(new Date(2026, 9, 2, 13))
    const removed = await repository.removeNote('other')
    expect(removed.notes).toHaveLength(1)
    expect(removed.tasks).toEqual(original.tasks)
    repository.database.close()
    await repository.database.open()
    expect(await repository.canUndoNoteChange()).toBe(true)
    expect(await repository.undoNoteChange()).toEqual(archived)
    expect(await repository.canUndoNoteChange()).toBe(true)
    const restored = await repository.undoNoteChange()
    expect({
      ...restored,
      notes: restored.notes.toSorted((a, b) => a.id.localeCompare(b.id)),
    }).toEqual(original)
    expect(await repository.canUndoNoteChange()).toBe(false)
    expect(await repository.undoNoteChange()).toEqual(original)
  })

  it('desarquiva uma nota sem perder dados e desfaz preservando a data de arquivamento', async () => {
    const input = { ...note(), archivedAt: '2026-09-30T12:00:00Z' }
    await insert([input])
    const before = await repository.snapshot()
    const restored = await repository.archiveNote('aws', false)
    expect(restored.notes[0]).toMatchObject({
      archivedAt: null,
      isExample: false,
    })
    expect(await repository.undoNoteChange()).toEqual(before)
  })

  it('arquivar invalida um editor aberto mesmo quando o relógio não avançou', async () => {
    const created = (await repository.saveNote(note(), null)).saved
    const archived = await repository.archiveNote(created.id, true)
    const current = archived.notes.find((item) => item.id === created.id)!
    expect(current.updatedAt).not.toBe(created.updatedAt)
    await expect(
      repository.saveNote(
        { ...created, content: 'Rascunho anterior ao arquivamento.' },
        created.updatedAt,
      ),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.get('notes', created.id)).toEqual(current)
    expect((await repository.undoNoteChange()).notes).toEqual([created])
  })

  it.each(['archive', 'remove'] as const)(
    'reverte %s integralmente quando não consegue guardar o histórico',
    async (operation) => {
      await insert([note()])
      const before = await repository.snapshot()
      vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
        new Error('Sem espaço para histórico'),
      )
      await expect(
        operation === 'archive'
          ? repository.archiveNote('aws', true)
          : repository.removeNote('aws'),
      ).rejects.toThrow('Sem espaço para histórico')
      expect(await repository.snapshot()).toEqual(before)
      expect(await repository.canUndoNoteChange()).toBe(false)
    },
  )

  it('protege vínculos explícitos recebidos, permite arquivar e conserva o desfazer anterior', async () => {
    await insert(
      [note(), note('other', 'Outra nota')],
      [{ ...task(), links: [{ type: 'notes', id: 'aws' }] }],
    )
    await repository.removeNote('other')
    const before = await repository.snapshot()
    await expect(repository.removeNote('aws')).rejects.toThrow(/vínculos/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
    expect(
      (await repository.archiveNote('aws', true)).notes[0]?.archivedAt,
    ).toBeTruthy()
    expect(await repository.undoNoteChange()).toEqual(before)
    expect((await repository.undoNoteChange()).notes).toHaveLength(2)
  })

  it('permite excluir um alvo de wikilink textual sem apagar nem alterar a nota que o referencia', async () => {
    const linked = {
      ...note('linked', 'Resumo'),
      content: 'Consultar [[AWS]].',
    }
    await insert([note(), linked])
    const remaining = await repository.removeNote('aws')
    expect(remaining.notes).toEqual([linked])
    expect((await repository.undoNoteChange()).notes).toHaveLength(2)
  })

  it('recusa desfazer um arquivamento sobre uma edição posterior, sem perder o histórico', async () => {
    await insert([note()])
    const archived = (await repository.archiveNote('aws', true)).notes[0]!
    vi.setSystemTime(new Date(2026, 9, 2, 13))
    await repository.saveNote(
      { ...archived, content: 'Conteúdo mais recente' },
      archived.updatedAt,
    )
    const before = await repository.snapshot()
    await expect(repository.undoNoteChange()).rejects.toThrow(/mudou depois/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
  })

  it('recusa desfazer exclusão sobre um ID recriado e preserva os novos dados', async () => {
    await insert([note()])
    await repository.removeNote('aws')
    await repository.saveNote(
      { ...note(), content: 'Nova nota no mesmo ID' },
      null,
    )
    const before = await repository.snapshot()
    await expect(repository.undoNoteChange()).rejects.toThrow(/mudou depois/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
  })

  it('recusa desfazer com ID ocupado por outro módulo, preservando a transação e o histórico', async () => {
    await insert([note()])
    await repository.removeNote('aws')
    await repository.save('tasks', task('aws'))
    const before = await repository.snapshot()
    await expect(repository.undoNoteChange()).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
  })

  it('mantém o histórico quando um vínculo necessário para recuperar a nota deixou de existir', async () => {
    await insert(
      [{ ...note(), links: [{ type: 'tasks', id: 'study' }] }],
      [task()],
    )
    await repository.removeNote('aws')
    await repository.remove('tasks', 'study')
    const before = await repository.snapshot()
    await expect(repository.undoNoteChange()).rejects.toThrow(/vínculos/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
  })

  it('reverte a recuperação se não consegue remover o item do histórico', async () => {
    await insert([note()])
    await repository.removeNote('aws')
    const before = await repository.snapshot()
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('Histórico indisponível'),
    )
    await expect(repository.undoNoteChange()).rejects.toThrow(
      'Histórico indisponível',
    )
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
    expect((await repository.undoNoteChange()).notes).toEqual([note()])
  })

  it('não apaga o histórico anterior ao pedir uma ação sobre uma nota ausente', async () => {
    await insert([note()])
    await repository.removeNote('aws')
    const before = await repository.snapshot()
    await expect(repository.removeNote('missing')).rejects.toThrow(
      /não encontrada/,
    )
    await expect(repository.archiveNote('missing', true)).rejects.toThrow(
      /não encontrada/,
    )
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoNoteChange()).toBe(true)
    expect((await repository.undoNoteChange()).notes).toEqual([note()])
  })
})
