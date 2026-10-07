import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { buildSeed } from '../../data/seed'
import type { Goal, Note, Project, Task } from '../../data/models'
import { GoalForm } from './GoalForm'
import { ProjectForm } from './ProjectForm'
import { ProjectCaptureForm } from './ProjectCaptureForm'
import { RelationForm } from './RelationForm'
import { useDirections } from './direction-store'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}
function submit(name: string) {
  const form = screen.getByRole('button', { name }).closest('form')
  if (!form) throw new Error('Formulário não encontrado.')
  fireEvent.submit(form)
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
    error: null,
    message: '',
    undoInfo: null,
    restored: null,
  })
})
afterEach(() => vi.restoreAllMocks())

describe('formulários fechados durante uma gravação', () => {
  it('confirma a meta uma vez sem navegar ou fechar outro contexto depois de desmontar', async () => {
    const request = deferred<Goal | null>()
    const operation = vi
      .spyOn(useDirections.getState(), 'saveGoal')
      .mockReturnValueOnce(request.promise)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const view = render(<GoalForm onSaved={onSaved} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Título da meta'), {
      target: { value: 'Concluir trilha AWS' },
    })
    submit('Salvar meta')
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'Concluir trilha AWS' }),
      null,
    )
    view.unmount()
    await act(async () => request.resolve(useData.getState().data.goals[0]!))
    expect(operation).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirma o projeto uma vez sem reabrir seu detalhe após desmontar', async () => {
    const request = deferred<Project | null>()
    const operation = vi
      .spyOn(useDirections.getState(), 'saveProject')
      .mockReturnValueOnce(request.promise)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const view = render(<ProjectForm onSaved={onSaved} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Título do projeto'), {
      target: { value: 'Meu software' },
    })
    submit('Salvar projeto')
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: 'Meu software' }),
      null,
    )
    view.unmount()
    await act(async () => request.resolve(useData.getState().data.projects[0]!))
    expect(operation).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each(['task', 'note'] as const)(
    'cria %s uma vez sem capturar navegação ou foco após desmontar',
    async (kind) => {
      const request = deferred<Task | Note | null>()
      const operation = vi
        .spyOn(useDirections.getState(), 'createItem')
        .mockReturnValueOnce(request.promise)
      const onCreated = vi.fn()
      const onClose = vi.fn()
      const view = render(
        <ProjectCaptureForm
          projectId="example-project"
          kind={kind}
          onCreated={onCreated}
          onClose={onClose}
        />,
      )
      const noun = kind === 'task' ? 'tarefa' : 'nota'
      fireEvent.change(screen.getByLabelText(`Título da ${noun}`), {
        target: { value: 'Próximo passo #cloud' },
      })
      submit(`Criar ${noun}`)
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        'example-project',
        kind === 'task' ? 'tasks' : 'notes',
        expect.objectContaining({ title: 'Próximo passo', tags: ['cloud'] }),
      )
      view.unmount()
      const data = useData.getState().data
      await act(async () =>
        request.resolve(kind === 'task' ? data.tasks[0]! : data.notes[0]!),
      )
      expect(operation).toHaveBeenCalledTimes(1)
      expect(onCreated).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    },
  )

  it('persiste o vínculo sem fechar uma sheet nova depois que a original foi desmontada', async () => {
    const request = deferred<boolean>()
    const operation = vi
      .spyOn(useDirections.getState(), 'link')
      .mockReturnValueOnce(request.promise)
    const onClose = vi.fn()
    const view = render(
      <RelationForm
        type="projects"
        id="example-project-learning"
        targetType="tasks"
        onClose={onClose}
      />,
    )
    const task = useData.getState().data.tasks[0]!
    fireEvent.change(screen.getByLabelText('Escolher tarefa'), {
      target: { value: task.id },
    })
    submit('Vincular')
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      'projects',
      'example-project-learning',
      'tasks',
      task.id,
      true,
    )
    view.unmount()
    await act(async () => request.resolve(true))
    expect(operation).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('confirmação e recuperação enquanto o formulário continua aberto', () => {
  it('preserva campos e medidas manuais e entrega a meta normalizada ao destino', async () => {
    const old = useData.getState().data.goals[0]!
    const goal: Goal = {
      ...old,
      description: 'Fundamentos e prática.',
      status: 'completed',
      weekly: true,
      deadline: null,
      tags: ['cloud'],
      links: [{ type: 'projects', id: 'example-project' }],
    }
    const saved: Goal = {
      ...goal,
      title: 'Nome atualizado',
      isExample: false,
      updatedAt: '2026-10-02T13:00:00Z',
    }
    const operation = vi
      .spyOn(useDirections.getState(), 'saveGoal')
      .mockResolvedValueOnce(saved)
    const onSaved = vi.fn()
    render(<GoalForm goal={goal} onSaved={onSaved} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Título da meta'), {
      target: { value: saved.title },
    })
    await act(async () => submit('Salvar meta'))
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: saved.title,
        description: goal.description,
        status: goal.status,
        weekly: goal.weekly,
        deadline: null,
        tags: goal.tags,
        links: goal.links,
        keyResults: goal.keyResults.map((result) => ({
          ...result,
          unit: result.unit ?? '',
        })),
      }),
      goal.updatedAt,
    )
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(saved)
  })

  it('preserva estado, descrição, URLs e relações ao salvar um projeto aberto', async () => {
    const original: Project = {
      ...useData.getState().data.projects[0]!,
      status: 'paused',
      description: 'Passos pequenos.',
      repositoryUrl: 'https://example.com/atlas',
      urls: [{ title: 'Documentação', url: 'https://example.com/docs' }],
      links: [{ type: 'goals', id: 'example-goal' }],
    }
    const saved = { ...original, title: 'Atlas pessoal', isExample: false }
    const operation = vi
      .spyOn(useDirections.getState(), 'saveProject')
      .mockResolvedValueOnce(saved)
    const onSaved = vi.fn()
    render(
      <ProjectForm project={original} onSaved={onSaved} onClose={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Título do projeto'), {
      target: { value: saved.title },
    })
    await act(async () => submit('Salvar projeto'))
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ ...saved }),
      original.updatedAt,
    )
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(saved)
  })

  it('mantém o texto e explica como corrigir uma falha sem encerrar o formulário', async () => {
    useDirections.setState({
      error: 'Não foi possível guardar. Tente novamente.',
    })
    const operation = vi
      .spyOn(useDirections.getState(), 'saveGoal')
      .mockResolvedValueOnce(null)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<GoalForm onSaved={onSaved} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Título da meta'), {
      target: { value: 'Meu rascunho preservado' },
    })
    await act(async () => submit('Salvar meta'))
    expect(operation).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Título da meta')).toHaveValue(
      'Meu rascunho preservado',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Tente novamente.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
