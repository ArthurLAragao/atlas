import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import { buildSeed } from '../../data/seed'
import type { Goal, Project, Snapshot } from '../../data/models'
import { useDirections } from './direction-store'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error | DOMException) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}
const confirmedGoal = (goal: Goal): Goal => ({
  ...goal,
  title: 'Meta normalizada',
  weekly: true,
  isExample: false,
  updatedAt: '2026-10-02T13:00:00.000Z',
})
const confirmedProject = (project: Project): Project => ({
  ...project,
  title: 'Projeto normalizado',
  status: 'active',
  isExample: false,
  updatedAt: '2026-10-02T13:00:00.000Z',
})
const undoInfo = {
  type: 'goals' as const,
  id: 'example-goal',
  label: 'Arquivar meta',
}

beforeEach(() => {
  useData.setState({
    data: buildSeed(new Date('2026-10-02T12:00:00.000Z')),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useDirections.setState({
    message: '',
    error: null,
    undoInfo: null,
    restored: null,
  })
})
afterEach(() => vi.restoreAllMocks())

describe('salvamento confirmado de metas e projetos', () => {
  it('mostra meta otimista e troca todo o snapshot pela confirmação autoritativa', async () => {
    const before = useData.getState().data
    const original = before.goals[0]!
    const draft = { ...original, title: '  Minha intenção  ' }
    const saved = confirmedGoal(draft)
    const request = deferred<{ data: Snapshot; saved: Goal }>()
    const operation = vi
      .spyOn(repository, 'saveDirection')
      .mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(undoInfo)
    const snapshot = vi.spyOn(repository, 'snapshot')
    const pending = useDirections.getState().saveGoal(draft, original.updatedAt)
    expect(useData.getState().data.goals).toContainEqual({
      ...draft,
      isExample: false,
    })
    expect(useData.getState().busy).toBe(true)
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      'goals',
      draft,
      original.updatedAt,
    )
    const authoritative = {
      ...before,
      goals: [saved],
      notes: before.notes.map((note) => ({
        ...note,
        content: 'Atualização de outra aba já considerada pela transação.',
      })),
    }
    request.resolve({ data: authoritative, saved })
    expect(await pending).toEqual(saved)
    expect(useData.getState().data).toEqual(authoritative)
    expect(useData.getState().busy).toBe(false)
    expect(useDirections.getState()).toMatchObject({
      message: 'Meta salva.',
      error: null,
      undoInfo,
      restored: null,
    })
    expect(snapshot).not.toHaveBeenCalled()
  })
  it('salva projeto com a entidade normalizada, sem perder relações ou dados de outras coleções', async () => {
    const before = useData.getState().data
    const original = before.projects[0]!
    const draft = { ...original, description: 'Nova descrição' }
    const saved = {
      ...confirmedProject(draft),
      links: [{ type: 'notes' as const, id: before.notes[0]!.id }],
    }
    const data = {
      ...before,
      projects: before.projects.map((project) =>
        project.id === saved.id ? saved : project,
      ),
    }
    const operation = vi
      .spyOn(repository, 'saveDirection')
      .mockResolvedValueOnce({ data, saved })
    vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(null)
    expect(
      await useDirections.getState().saveProject(draft, original.updatedAt),
    ).toEqual(saved)
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      'projects',
      draft,
      original.updatedAt,
    )
    expect(useData.getState().data).toEqual(data)
    expect(useDirections.getState().message).toBe('Projeto salvo.')
  })
  it('não transforma falha de leitura do histórico em falha de gravação confirmada', async () => {
    const before = useData.getState().data
    const original = before.goals[0]!
    const saved = confirmedGoal(original)
    const data = { ...before, goals: [saved] }
    vi.spyOn(repository, 'saveDirection').mockResolvedValueOnce({ data, saved })
    vi.spyOn(repository, 'getDirectionUndo').mockRejectedValueOnce(
      new Error('Histórico indisponível'),
    )
    const snapshot = vi
      .spyOn(repository, 'snapshot')
      .mockRejectedValue(new Error('Leitura indisponível'))
    useDirections.setState({ undoInfo })
    expect(
      await useDirections.getState().saveGoal(original, original.updatedAt),
    ).toEqual(saved)
    expect(useData.getState().data).toEqual(data)
    expect(snapshot).not.toHaveBeenCalled()
    expect(useDirections.getState()).toMatchObject({
      message: 'Meta salva.',
      error: null,
      undoInfo,
    })
    expect(useData.getState().busy).toBe(false)
  })
  it('falha de criação remove o registro otimista e informa como recuperar armazenamento cheio', async () => {
    const before = useData.getState().data
    const draft = {
      ...before.projects[0]!,
      id: 'new-project',
      title: 'Novo projeto',
    }
    const request = deferred<{ data: Snapshot; saved: Project }>()
    vi.spyOn(repository, 'saveDirection').mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    const pending = useDirections.getState().saveProject(draft, null)
    expect(useData.getState().data.projects).toHaveLength(
      before.projects.length + 1,
    )
    request.reject(new DOMException('full', 'QuotaExceededError'))
    expect(await pending).toBeNull()
    expect(useData.getState().data).toEqual(before)
    expect(useDirections.getState().error).toContain('armazenamento está cheio')
    expect(useDirections.getState().message).toBe('')
    expect(useData.getState().busy).toBe(false)
  })
  it('conflito recupera versão atual do banco e preserva o erro que orienta reabrir', async () => {
    const before = useData.getState().data
    const original = before.goals[0]!
    const current = { ...before, goals: [confirmedGoal(original)] }
    vi.spyOn(repository, 'saveDirection').mockRejectedValueOnce(
      new Error(
        'Este registro mudou em outra aba. Reabra a versão salva antes de continuar.',
      ),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(current)
    useDirections.setState({ undoInfo })
    expect(
      await useDirections
        .getState()
        .saveGoal({ ...original, title: 'Rascunho' }, original.updatedAt),
    ).toBeNull()
    expect(useData.getState().data).toEqual(current)
    expect(useDirections.getState()).toMatchObject({
      message: '',
      error: expect.stringContaining('Reabra a versão salva'),
      undoInfo,
      restored: null,
    })
  })
  it('se a releitura também falhar, volta ao snapshot anterior sem fingir sucesso', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'saveDirection').mockRejectedValueOnce(
      new Error('Falha ao salvar. Tente novamente.'),
    )
    vi.spyOn(repository, 'snapshot').mockRejectedValueOnce(
      new Error('Banco indisponível'),
    )
    expect(
      await useDirections
        .getState()
        .saveProject(
          { ...before.projects[0]!, title: 'Rascunho' },
          before.projects[0]!.updatedAt,
        ),
    ).toBeNull()
    expect(useData.getState().data).toEqual(before)
    expect(useDirections.getState().error).toContain('Tente novamente')
    expect(useData.getState().busy).toBe(false)
  })
})

describe('arquivo, exclusão, relacionamentos e filhos de projeto', () => {
  it.each([true, false])(
    'confirma arquivado=%s somente depois da transação',
    async (archived) => {
      const before = useData.getState().data
      const request = deferred<Snapshot>()
      const operation = vi
        .spyOn(repository, 'archiveDirection')
        .mockReturnValueOnce(request.promise)
      vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(undoInfo)
      const pending = useDirections
        .getState()
        .archive('goals', 'example-goal', archived)
      expect(useData.getState().data).toEqual(before)
      expect(useData.getState().busy).toBe(true)
      const data = {
        ...before,
        goals: before.goals.map((goal) => ({
          ...goal,
          status: archived ? ('archived' as const) : ('active' as const),
          weekly: false,
        })),
      }
      request.resolve(data)
      expect(await pending).toBe(true)
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        'goals',
        'example-goal',
        archived,
      )
      expect(useData.getState().data).toEqual(data)
      expect(useDirections.getState()).toMatchObject({
        error: null,
        undoInfo,
        message: archived
          ? 'Registro arquivado. Você pode desfazer.'
          : 'Registro desarquivado. Você pode desfazer.',
      })
    },
  )
  it('exclusão otimista recebe o delta autoritativo de referências sem apagar dados não afetados', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    const operation = vi
      .spyOn(repository, 'removeDirection')
      .mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(undoInfo)
    const pending = useDirections.getState().remove('goals', 'example-goal')
    expect(useData.getState().data.goals).toEqual([])
    expect(useData.getState().data.tasks).toEqual(before.tasks)
    const data = {
      ...before,
      goals: [],
      tasks: before.tasks.map((task) => ({
        ...task,
        links: task.links.filter((link) => link.type !== 'goals'),
      })),
    }
    request.resolve(data)
    expect(await pending).toBe(true)
    expect(operation).toHaveBeenCalledExactlyOnceWith('goals', 'example-goal')
    expect(useData.getState().data).toEqual(data)
    expect(useDirections.getState().message).toContain('vínculos removidos')
    expect(useData.getState().busy).toBe(false)
  })
  it('falha na exclusão recarrega registros e preserva histórico anterior', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    vi.spyOn(repository, 'removeDirection').mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    useDirections.setState({ undoInfo })
    const pending = useDirections
      .getState()
      .remove('projects', 'example-project')
    expect(
      useData
        .getState()
        .data.projects.some((project) => project.id === 'example-project'),
    ).toBe(false)
    request.reject(new Error('Falha ao excluir. Tente novamente.'))
    expect(await pending).toBe(false)
    expect(useData.getState().data).toEqual(before)
    expect(useDirections.getState()).toMatchObject({
      undoInfo,
      error: expect.stringContaining('Tente novamente'),
      message: '',
    })
  })
  it.each([true, false])(
    'vínculo ligado=%s preserva medidas manuais e usa dados confirmados',
    async (linked) => {
      const before = useData.getState().data
      const data = {
        ...before,
        goals: before.goals.map((goal) => ({
          ...goal,
          links: linked
            ? [{ type: 'tasks' as const, id: 'example-task-0' }]
            : [],
        })),
      }
      const operation = vi
        .spyOn(repository, 'linkDirection')
        .mockResolvedValueOnce(data)
      vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(null)
      expect(
        await useDirections
          .getState()
          .link('goals', 'example-goal', 'tasks', 'example-task-0', linked),
      ).toBe(true)
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        'goals',
        'example-goal',
        'tasks',
        'example-task-0',
        linked,
      )
      expect(useData.getState().data).toEqual(data)
      expect(useData.getState().data.goals[0]?.keyResults).toEqual(
        before.goals[0]?.keyResults,
      )
      expect(useDirections.getState().message).toBe(
        linked ? 'Vínculo adicionado.' : 'Vínculo removido.',
      )
    },
  )
  it.each(['tasks', 'notes'] as const)(
    'criar %s dentro do projeto retorna o filho confirmado e não duplica por leitura posterior',
    async (type) => {
      const before = useData.getState().data
      const item =
        type === 'tasks'
          ? { ...before.tasks[0]!, id: 'new-task' }
          : { ...before.notes[0]!, id: 'new-note' }
      const created = {
        ...item,
        isExample: false,
        links: [{ type: 'projects' as const, id: 'example-project' }],
        updatedAt: '2026-10-02T13:00:00.000Z',
      }
      const data = { ...before, [type]: [...before[type], created] }
      const operation = vi
        .spyOn(repository, 'createProjectItem')
        .mockResolvedValueOnce({ data, created })
      vi.spyOn(repository, 'getDirectionUndo').mockRejectedValueOnce(
        new Error('Histórico indisponível'),
      )
      const snapshot = vi
        .spyOn(repository, 'snapshot')
        .mockRejectedValue(new Error('Leitura indisponível'))
      expect(
        await useDirections
          .getState()
          .createItem('example-project', type, item),
      ).toEqual(created)
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        'example-project',
        type,
        item,
      )
      expect(useData.getState().data).toEqual(data)
      expect(useData.getState().data[type]).toHaveLength(
        before[type].length + 1,
      )
      expect(snapshot).not.toHaveBeenCalled()
      expect(useDirections.getState().error).toBeNull()
      expect(useDirections.getState().message).toBe(
        type === 'tasks'
          ? 'Tarefa criada e vinculada.'
          : 'Nota criada e vinculada.',
      )
    },
  )
  it('falha criando filho não mantém registro não confirmado e informa como desarquivar', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'createProjectItem').mockRejectedValueOnce(
      new Error(
        'Este projeto está arquivado. Desarquive antes de criar registros.',
      ),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    expect(
      await useDirections
        .getState()
        .createItem('example-project', 'notes', before.notes[0]!),
    ).toBeNull()
    expect(useData.getState().data).toEqual(before)
    expect(useDirections.getState().error).toContain('Desarquive')
  })
})

describe('histórico seguro e exclusão mútua entre módulos', () => {
  it('desfaz com confirmação e fornece destino recuperado mesmo quando o histórico ficou vazio', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    const operation = vi
      .spyOn(repository, 'undoDirectionChange')
      .mockReturnValueOnce(request.promise)
    vi.spyOn(repository, 'getDirectionUndo').mockResolvedValueOnce(null)
    useDirections.setState({ undoInfo })
    const pending = useDirections.getState().undo()
    expect(useData.getState().busy).toBe(true)
    expect(useDirections.getState().restored).toBeNull()
    expect(await useDirections.getState().undo()).toBe(false)
    expect(operation).toHaveBeenCalledTimes(1)
    request.resolve(before)
    expect(await pending).toBe(true)
    expect(useData.getState().data).toEqual(before)
    expect(useDirections.getState()).toMatchObject({
      undoInfo: null,
      restored: { type: 'goals', id: 'example-goal' },
      error: null,
      message: 'Ação desfeita. Registro e vínculos recuperados.',
    })
  })
  it('falha de metadados após undo confirmado mantém recuperação e não anuncia erro de gravação', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'undoDirectionChange').mockResolvedValueOnce(before)
    vi.spyOn(repository, 'getDirectionUndo').mockRejectedValueOnce(
      new Error('Histórico indisponível'),
    )
    const snapshot = vi.spyOn(repository, 'snapshot')
    useDirections.setState({ undoInfo })
    expect(await useDirections.getState().undo()).toBe(true)
    expect(useDirections.getState()).toMatchObject({
      undoInfo,
      restored: { type: 'goals', id: 'example-goal' },
      error: null,
      message: 'Ação desfeita. Registro e vínculos recuperados.',
    })
    expect(snapshot).not.toHaveBeenCalled()
    expect(useData.getState().busy).toBe(false)
  })
  it('undo bloqueado por concorrência não restaura links nem informa recuperação', async () => {
    const before = useData.getState().data
    const current = {
      ...before,
      tasks: before.tasks.map((task) => ({ ...task, status: 'done' as const })),
    }
    vi.spyOn(repository, 'undoDirectionChange').mockRejectedValueOnce(
      new Error(
        'Um registro mudou depois desta ação. A versão atual foi preservada.',
      ),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(current)
    useDirections.setState({
      undoInfo,
      restored: { type: 'projects', id: 'old' },
    })
    expect(await useDirections.getState().undo()).toBe(false)
    expect(useData.getState().data).toEqual(current)
    expect(useDirections.getState()).toMatchObject({
      undoInfo,
      restored: null,
      message: '',
      error: expect.stringContaining('versão atual foi preservada'),
    })
  })
  it('busy de outro módulo bloqueia todos os caminhos sem alterar mensagens nem estado', async () => {
    const before = useData.getState().data
    useData.setState({ busy: true })
    useDirections.setState({ message: 'Uma ação anterior.', undoInfo })
    const save = vi.spyOn(repository, 'saveDirection')
    const archive = vi.spyOn(repository, 'archiveDirection')
    const remove = vi.spyOn(repository, 'removeDirection')
    const link = vi.spyOn(repository, 'linkDirection')
    const create = vi.spyOn(repository, 'createProjectItem')
    const undo = vi.spyOn(repository, 'undoDirectionChange')
    expect(
      await useDirections.getState().saveGoal(before.goals[0]!, null),
    ).toBeNull()
    expect(
      await useDirections.getState().saveProject(before.projects[0]!, null),
    ).toBeNull()
    expect(
      await useDirections.getState().archive('goals', 'example-goal', true),
    ).toBe(false)
    expect(
      await useDirections.getState().remove('projects', 'example-project'),
    ).toBe(false)
    expect(
      await useDirections
        .getState()
        .link('projects', 'example-project', 'notes', 'example-note-0', true),
    ).toBe(false)
    expect(
      await useDirections
        .getState()
        .createItem('example-project', 'tasks', before.tasks[0]!),
    ).toBeNull()
    expect(await useDirections.getState().undo()).toBe(false)
    for (const operation of [save, archive, remove, link, create, undo])
      expect(operation).not.toHaveBeenCalled()
    expect(useData.getState().data).toEqual(before)
    expect(useData.getState().busy).toBe(true)
    expect(useDirections.getState()).toMatchObject({
      message: 'Uma ação anterior.',
      undoInfo,
    })
  })
  it('refreshUndo e dismiss preservam conteúdo e disponibilidade do histórico', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'getDirectionUndo')
      .mockResolvedValueOnce(undoInfo)
      .mockRejectedValueOnce(new Error('Falha'))
    await useDirections.getState().refreshUndo()
    await useDirections.getState().refreshUndo()
    expect(useDirections.getState().undoInfo).toEqual(undoInfo)
    useDirections.setState({
      error: 'Erro anterior.',
      message: 'Confirmação anterior.',
      restored: { type: 'goals', id: 'example-goal' },
    })
    useDirections.getState().dismiss()
    expect(useDirections.getState()).toMatchObject({
      error: null,
      message: '',
      restored: null,
      undoInfo,
    })
    expect(useData.getState().data).toEqual(before)
  })
})
