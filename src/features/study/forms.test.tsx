import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { buildSeed } from '../../data/seed'
import type { Snapshot, StudyPath, Subject } from '../../data/models'
import { repository } from '../../data/service'
import { StudyEditor } from './StudyEditors'
import { AssessmentForm } from './AssessmentForm'
import { StepEventForm } from './StepEventForm'
import { Field, StudyForm } from './StudyForm'
import { useStudy } from './study-store'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}
function submit(name: string) {
  const form = screen.getByRole('button', { name }).closest('form')
  if (!form) throw new Error('Formulário não encontrado.')
  fireEvent.submit(form)
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

describe('edição de Estudos com gravação pendente', () => {
  it.each(['subjects', 'studyPaths'] as const)(
    'persiste %s uma vez sem navegar nem fechar outro contexto após desmontar',
    async (kind) => {
      const before = useData.getState().data
      const request = deferred<{ data: Snapshot; saved: Subject | StudyPath }>()
      const operation = vi
        .spyOn(repository, 'saveStudy')
        .mockReturnValueOnce(request.promise)
      const onSaved = vi.fn()
      const onClose = vi.fn()
      const view = render(
        <StudyEditor kind={kind} onSaved={onSaved} onClose={onClose} />,
      )
      fireEvent.change(
        screen.getByLabelText(
          kind === 'subjects' ? 'Nome da disciplina' : 'Título da trilha',
        ),
        { target: { value: 'Meu estudo' } },
      )
      submit(kind === 'subjects' ? 'Salvar disciplina' : 'Salvar trilha')
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        kind,
        expect.objectContaining({ title: 'Meu estudo' }),
        null,
      )
      view.unmount()
      const saved =
        kind === 'subjects' ? before.subjects[0]! : before.studyPaths[0]!
      await act(async () => request.resolve({ data: before, saved }))
      expect(operation).toHaveBeenCalledTimes(1)
      expect(onSaved).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
      expect(useData.getState().busy).toBe(false)
    },
  )

  it('mantém o rascunho e explica uma falha de banco sem fechar ou navegar', async () => {
    const before = useData.getState().data
    vi.spyOn(repository, 'saveStudy').mockRejectedValueOnce(
      new Error('Não foi possível guardar. Tente novamente.'),
    )
    vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(before)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<StudyEditor kind="subjects" onSaved={onSaved} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Nome da disciplina'), {
      target: { value: 'Rascunho de Redes' },
    })
    await act(async () => submit('Salvar disciplina'))
    expect(screen.getByLabelText('Nome da disciplina')).toHaveValue(
      'Rascunho de Redes',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Tente novamente.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(useData.getState().data).toEqual(before)
  })

  it('evita gravações duplicadas, desabilita campos durante a operação e mantém saída por Cancelar', async () => {
    const before = useData.getState().data
    const request = deferred<{ data: Snapshot; saved: Subject }>()
    const operation = vi
      .spyOn(repository, 'saveStudy')
      .mockReturnValueOnce(request.promise)
    render(<StudyEditor kind="subjects" onSaved={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome da disciplina'), {
      target: { value: 'Redes' },
    })
    await act(async () => {
      submit('Salvar disciplina')
      submit('Salvar disciplina')
    })
    expect(operation).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Nome da disciplina')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Salvar disciplina' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    await act(async () =>
      request.resolve({ data: before, saved: before.subjects[0]! }),
    )
    expect(screen.getByLabelText('Nome da disciplina')).toBeEnabled()
  })

  it('preserva avaliações, eventos, faltas e relações ao editar os campos básicos', async () => {
    const before = useData.getState().data
    const original: Subject = {
      ...before.subjects[0]!,
      absences: 3,
      status: 'completed',
      tags: ['faculdade', 'dados'],
      notes: 'Observação útil',
      links: [{ type: 'tasks', id: before.tasks[0]!.id }],
    }
    const operation = vi
      .spyOn(repository, 'saveStudy')
      .mockResolvedValueOnce({ data: before, saved: original })
    const onSaved = vi.fn()
    render(
      <StudyEditor
        kind="subjects"
        subject={original}
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Nome da disciplina'), {
      target: { value: 'Estruturas revisadas' },
    })
    await act(async () => submit('Salvar disciplina'))
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      'subjects',
      expect.objectContaining({
        title: 'Estruturas revisadas',
        assessments: original.assessments,
        events: original.events,
        absences: 3,
        status: 'completed',
        tags: original.tags,
        notes: original.notes,
        links: original.links,
      }),
      original.updatedAt,
    )
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(original.id)
  })
})

describe('validação e teclado dos formulários de estudo', () => {
  it('leva foco para o título e mantém sequência de teclado e Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<StudyEditor kind="subjects" onSaved={vi.fn()} onClose={onClose} />)
    await waitFor(() =>
      expect(screen.getByLabelText('Nome da disciplina')).toHaveFocus(),
    )
    await user.tab()
    expect(screen.getByLabelText('Estado')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('não permite salvar um título vazio mesmo quando o submit é disparado diretamente', async () => {
    const operation = vi.spyOn(repository, 'saveStudy')
    render(<StudyEditor kind="subjects" onSaved={vi.fn()} onClose={vi.fn()} />)
    await act(async () => submit('Salvar disciplina'))
    expect(operation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.getByLabelText('Nome da disciplina')).toHaveValue('')
  })

  it('rejeita nota acima do máximo sem perder avaliação nem rascunho', async () => {
    const original = useData.getState().data.subjects[0]!
    const operation = vi.spyOn(repository, 'saveStudy')
    const onClose = vi.fn()
    render(<AssessmentForm subject={original} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Nome da avaliação'), {
      target: { value: 'Prova final' },
    })
    fireEvent.change(screen.getByLabelText('Nota obtida'), {
      target: { value: '11' },
    })
    await act(async () => submit('Salvar'))
    expect(operation).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nome da avaliação')).toHaveValue(
      'Prova final',
    )
    expect(screen.getByLabelText('Nota obtida')).toHaveValue(11)
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement()
    expect(onClose).not.toHaveBeenCalled()
    expect(useData.getState().data.subjects[0]).toEqual(original)
  })

  it('rejeita URL de etapa com protocolo inseguro antes de enviar ao repository', async () => {
    const original = useData.getState().data.studyPaths[0]!
    const operation = vi.spyOn(repository, 'saveStudy')
    render(<StepEventForm path={original} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Título da etapa'), {
      target: { value: 'Ler documentação' },
    })
    fireEvent.change(screen.getByLabelText('Link'), {
      target: { value: 'javascript:alert(1)' },
    })
    await act(async () => submit('Salvar'))
    expect(operation).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Link')).toHaveValue('javascript:alert(1)')
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement()
  })

  it('uma confirmação tardia genérica não fecha a sheet substituta', async () => {
    const request = deferred<boolean>()
    const onClose = vi.fn()
    const view = render(
      <StudyForm
        title="Salvar registro"
        onClose={onClose}
        onSubmit={() => request.promise}
      >
        <Field label="Nome" name="title" value="Meu estudo" />
      </StudyForm>,
    )
    submit('Salvar')
    view.unmount()
    await act(async () => request.resolve(true))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('uma rejeição tardia não comunica erro dentro de uma sheet nova', async () => {
    const request = deferred<boolean>()
    const view = render(
      <StudyForm
        title="Primeira edição"
        onClose={vi.fn()}
        onSubmit={() => request.promise}
      >
        <Field label="Nome" name="title" value="Rascunho" />
      </StudyForm>,
    )
    submit('Salvar')
    view.unmount()
    render(
      <StudyForm
        title="Outra edição"
        onClose={vi.fn()}
        onSubmit={async () => true}
      >
        <Field label="Outro nome" name="title" />
      </StudyForm>,
    )
    await act(async () => request.reject(new Error('Campos inválidos')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Outra edição' }),
    ).toBeInTheDocument()
  })
})
