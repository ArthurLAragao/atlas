import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { emptySnapshot, type Snapshot } from '../../data/models'
import { buildSeed } from '../../data/seed'
import { repository } from '../../data/service'
import { studyChange, useStudy } from './study-store'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const undoInfo = {
  type: 'subjects' as const,
  id: 'example-subject-structures',
  label: 'Excluir disciplina',
}

beforeEach(() => {
  useData.setState({
    data: buildSeed(new Date('2026-10-02T12:00:00Z')),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useStudy.setState({ error: null, message: '', undoInfo: null })
  vi.spyOn(repository, 'getStudyUndo').mockResolvedValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('gravações confirmadas e recuperação de Estudos', () => {
  it('mostra remoção otimista e só confirma o snapshot devolvido pela transação', async () => {
    const before = useData.getState().data
    const optimistic = { ...before, subjects: [] }
    const authoritative = {
      ...optimistic,
      notes: before.notes.map((item) => ({
        ...item,
        content: 'Mudança concorrente incluída pela transação.',
      })),
    }
    const request = deferred<Snapshot>()
    const operation = vi.fn().mockReturnValueOnce(request.promise)
    const reading = vi.spyOn(repository, 'snapshot')
    useStudy.setState({ error: 'Erro anterior', message: 'Mensagem anterior' })
    const pending = studyChange(operation, 'Disciplina excluída.', optimistic)
    expect(useData.getState()).toMatchObject({ busy: true, data: optimistic })
    expect(useStudy.getState()).toMatchObject({ error: null, message: '' })
    expect(operation).toHaveBeenCalledTimes(1)
    request.resolve(authoritative)
    expect(await pending).toBe(true)
    expect(useData.getState()).toMatchObject({
      busy: false,
      data: authoritative,
    })
    expect(useStudy.getState()).toMatchObject({
      error: null,
      message: 'Disciplina excluída.',
    })
    expect(reading).not.toHaveBeenCalled()
  })

  it('não modifica registros sem snapshot otimista enquanto espera uma gravação', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    const pending = studyChange(() => request.promise, 'Salvo.')
    expect(useData.getState().data).toBe(before)
    expect(useData.getState().busy).toBe(true)
    request.resolve(emptySnapshot())
    expect(await pending).toBe(true)
    expect(useData.getState()).toMatchObject({
      data: emptySnapshot(),
      busy: false,
    })
  })

  it('mantém confirmação de gravação se apenas a consulta do histórico falhar', async () => {
    const before = useData.getState().data
    useStudy.setState({ undoInfo })
    vi.mocked(repository.getStudyUndo).mockRejectedValueOnce(
      new Error('Histórico indisponível'),
    )
    const snapshot = vi.spyOn(repository, 'snapshot')
    expect(await studyChange(async () => before, 'Registro salvo.')).toBe(true)
    expect(useStudy.getState()).toMatchObject({
      error: null,
      message: 'Registro salvo.',
      undoInfo,
    })
    expect(useData.getState()).toMatchObject({ data: before, busy: false })
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('recupera o snapshot atual do banco em uma falha de escrita, preservando alterações de outra aba', async () => {
    const before = useData.getState().data
    const current = {
      ...before,
      subjects: before.subjects.map((item) => ({
        ...item,
        title: 'Confirmado em outra aba',
      })),
    }
    const request = deferred<Snapshot>()
    const snapshot = vi
      .spyOn(repository, 'snapshot')
      .mockResolvedValueOnce(current)
    const pending = studyChange(() => request.promise, 'Não confirmado.', {
      ...before,
      subjects: [],
    })
    request.reject(new Error('Não foi possível guardar. Tente novamente.'))
    expect(await pending).toBe(false)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(useData.getState()).toMatchObject({ data: current, busy: false })
    expect(useStudy.getState()).toMatchObject({
      message: '',
      error: 'Não foi possível guardar. Tente novamente.',
    })
  })

  it('restaura o último snapshot seguro quando escrita e leitura falham', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'snapshot').mockRejectedValueOnce(
      new Error('Banco indisponível'),
    )
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Sem acesso', 'SecurityError'))
    expect(await studyChange(operation, 'Não salvo.', emptySnapshot())).toBe(
      false,
    )
    expect(useData.getState()).toMatchObject({ data: before, busy: false })
    expect(useStudy.getState().error).toContain('Permita o armazenamento')
    expect(useStudy.getState().message).toBe('')
  })

  it('orienta como recuperar armazenamento cheio e não confirma o rascunho', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new DOMException('Sem espaço', 'QuotaExceededError'),
      )
    expect(await studyChange(operation, 'Salvo.', emptySnapshot())).toBe(false)
    expect(useStudy.getState().error).toContain(
      'Exporte uma cópia e libere espaço',
    )
    expect(useData.getState()).toMatchObject({ data: before, busy: false })
  })

  it('bloqueia uma segunda operação sem substituir dados ou feedback da primeira', async () => {
    const before = useData.getState().data
    const request = deferred<Snapshot>()
    const pending = studyChange(
      () => request.promise,
      'Primeira operação concluída.',
    )
    const second = vi.fn().mockResolvedValue(emptySnapshot())
    useStudy.setState({ message: 'A primeira está em andamento.' })
    expect(
      await studyChange(second, 'Segunda concluída.', emptySnapshot()),
    ).toBe(false)
    expect(second).not.toHaveBeenCalled()
    expect(useData.getState()).toMatchObject({ data: before, busy: true })
    expect(useStudy.getState().message).toBe('A primeira está em andamento.')
    request.resolve(before)
    expect(await pending).toBe(true)
    expect(useData.getState().busy).toBe(false)
    expect(useStudy.getState().message).toBe('Primeira operação concluída.')
  })

  it('bloqueia operação quando outro módulo está gravando sem consultar o histórico', async () => {
    const before = useData.getState().data
    useData.setState({ busy: true })
    useStudy.setState({ message: 'Anterior', error: 'Anterior', undoInfo })
    const operation = vi.fn().mockResolvedValue(emptySnapshot())
    expect(await studyChange(operation, 'Salvo.', emptySnapshot())).toBe(false)
    expect(operation).not.toHaveBeenCalled()
    expect(repository.getStudyUndo).not.toHaveBeenCalled()
    expect(useData.getState()).toMatchObject({ data: before, busy: true })
    expect(useStudy.getState()).toMatchObject({
      message: 'Anterior',
      error: 'Anterior',
      undoInfo,
    })
  })

  it('atualiza a ação disponível para desfazer, inclusive quando o histórico fica vazio', async () => {
    vi.mocked(repository.getStudyUndo)
      .mockResolvedValueOnce(undoInfo)
      .mockResolvedValueOnce(null)
    await useStudy.getState().refreshUndo()
    expect(useStudy.getState().undoInfo).toEqual(undoInfo)
    await useStudy.getState().refreshUndo()
    expect(useStudy.getState().undoInfo).toBeNull()
  })

  it('dispensa feedback transitório sem perder a ação de desfazer', () => {
    useStudy.setState({ error: 'Erro', message: 'Mensagem', undoInfo })
    useStudy.getState().dismiss()
    expect(useStudy.getState()).toMatchObject({
      error: null,
      message: '',
      undoInfo,
    })
  })
})
