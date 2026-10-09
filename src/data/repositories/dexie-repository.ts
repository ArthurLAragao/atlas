import { readProfileData, recordActivity } from './profile-repository'
import { RepositoryConflictError } from '../conflict-error'
import {
  profileSchema,
  defaultProfile,
  type ProfilePreferences,
  type PinnedItem,
} from '../profile-models'
import { awardExperience, readExperience } from './experience-repository'
import Dexie, { liveQuery, type Table } from 'dexie'
import { z } from 'zod'
import { createDatabase } from '../database'
import {
  collections,
  emptySnapshot,
  habitLogSchema,
  habitSchema,
  snapshotSchema,
  taskSchema,
  noteSchema,
  type Note,
  type Collection,
  type EntityMap,
  type Entity,
  type HabitLog,
  type Snapshot,
  type Task,
} from '../models'
import { buildSeed } from '../seed'
import {
  mergeSnapshots,
  recordCount,
  references,
  replaceCollection,
  subtractSnapshot,
  validateSnapshot,
} from '../../lib/data-records'
import type { AtlasRepository, HabitLogInput } from './atlas-repository'
import type { MergeResult } from '../../lib/data-records'
import { dateKey } from '../../lib/habits'
import {
  routineConfigSchema,
  type RoutineConfig,
  type RoutineMapping,
} from '../routine-models'
import { applyRoutinePlan, editHabitSchedule } from '../../lib/routine'
import { noteKey, resolveNote } from '../../lib/note-identity'
import { nextOccurrence } from '../../lib/tasks'
import { LearningRepository } from './learning-repository'
import type { StartFocusInput } from './atlas-repository'
import type { Flashcard } from '../models'
import type { FocusAction } from '../../lib/focus'
import {
  planMarkdownImport,
  type DuplicatePolicy,
} from '../../lib/markdown-import'

interface Metadata {
  key: string
  value: unknown
}

const noteTimestamp = (note: Note) =>
  new Date(
    Math.max(
      Date.now(),
      Date.parse(note.updatedAt) + 1,
      Date.parse(note.createdAt),
    ),
  ).toISOString()

type Direction = 'goals' | 'projects'
type Study = 'subjects' | 'studyPaths'
type RelatedCollection = 'tasks' | 'notes' | 'goals' | 'projects'
const recordTimestamp = (record: Entity) =>
  new Date(
    Math.max(
      Date.now(),
      Date.parse(record.updatedAt) + 1,
      Date.parse(record.createdAt),
    ),
  ).toISOString()
const directionHistorySchema = z.array(
  z.object({
    type: z.enum(['goals', 'projects']),
    id: z.string(),
    label: z.string(),
    before: snapshotSchema,
    after: snapshotSchema,
  }),
)
const equalRecord = (a: Entity | null, b: Entity | null) =>
  JSON.stringify(a) === JSON.stringify(b)
const studyHistorySchema = z.array(
  z.object({
    type: z.enum(['subjects', 'studyPaths']),
    id: z.string(),
    label: z.string(),
    before: snapshotSchema,
    after: snapshotSchema,
  }),
)

function directionDelta(before: Snapshot, after: Snapshot) {
  let oldRecords = emptySnapshot()
  let newRecords = emptySnapshot()
  for (const name of collections) {
    const oldById = new Map(before[name].map((record) => [record.id, record]))
    const newById = new Map(after[name].map((record) => [record.id, record]))
    const changed = new Set(
      [...oldById.keys(), ...newById.keys()].filter(
        (id) => !equalRecord(oldById.get(id) ?? null, newById.get(id) ?? null),
      ),
    )
    oldRecords = replaceCollection(
      oldRecords,
      name,
      before[name].filter((record) => changed.has(record.id)),
    )
    newRecords = replaceCollection(
      newRecords,
      name,
      after[name].filter((record) => changed.has(record.id)),
    )
  }
  return { before: oldRecords, after: newRecords }
}

function selectWeeklyGoal(data: Snapshot, id: string): Snapshot {
  return {
    ...data,
    goals: data.goals.map((goal) =>
      goal.id !== id && goal.weekly
        ? {
            ...goal,
            weekly: false,
            updatedAt: recordTimestamp(goal),
            isExample: false,
          }
        : goal,
    ),
  }
}

export class DexieAtlasRepository implements AtlasRepository {
  async applyRoutine(
    input: RoutineConfig,
    mapping: RoutineMapping[],
    expectedRoutine: string | null,
  ): Promise<Snapshot> {
    const config = routineConfigSchema.parse(input)
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      if (
        (data.routine?.updatedAt ?? null) !== expectedRoutine ||
        mapping.some(
          (m) =>
            m.habitId &&
            (data.habits.find((h) => h.id === m.habitId)?.updatedAt ?? null) !==
              m.expectedUpdatedAt,
        )
      )
        throw new RepositoryConflictError(
          'A rotina ou um hábito mudou em outra aba. Feche e revise a configuração novamente; nenhum dado foi alterado.',
        )
      const now = new Date().toISOString()
      const next = validateSnapshot(
        applyRoutinePlan(
          data,
          config,
          mapping,
          dateKey(new Date()),
          data.routine
            ? new Date(
                Math.max(
                  Date.parse(now),
                  Date.parse(data.routine.updatedAt) + 1,
                ),
              ).toISOString()
            : now,
          config.habits.map(() => crypto.randomUUID()),
        ),
      )
      await this.table('habits').bulkPut(next.habits)
      await this.meta().put({ key: 'weeklyRoutine', value: next.routine })
      return this.readSnapshot()
    })
  }
  async saveProfile(
    profile: ProfilePreferences,
    expected?: ProfilePreferences,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const { profile: current } = await readProfileData(this.database)
      const details = [
        'name',
        'handle',
        'bio',
        'avatarStyle',
        'avatar',
      ] as const
      if (
        expected &&
        details.some(
          (key) => (current ?? defaultProfile())[key] !== expected[key],
        )
      )
        throw new RepositoryConflictError(
          'O perfil mudou em outra aba. Seu rascunho foi mantido; reabra a versão salva antes de editar.',
        )
      await this.meta().put({
        key: 'profile',
        // Pins have their own transactional action and are not edited by this form.
        value: profileSchema.parse({
          ...profile,
          pinned: current?.pinned ?? profile.pinned,
        }),
      })
      return this.readSnapshot()
    })
  }
  async togglePinned(
    item: PinnedItem,
    expectedPinned?: boolean,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const profile = data.profile ?? defaultProfile()
      const exists = profile.pinned.some(
        (pin) => pin.type === item.type && pin.id === item.id,
      )
      if (expectedPinned !== undefined && exists !== expectedPinned)
        throw new RepositoryConflictError(
          'A fixação mudou em outra aba. O estado atual foi mantido; confira e tente novamente.',
        )
      if (!exists && !data[item.type].some((record) => record.id === item.id))
        throw new Error('Este item não está mais disponível.')
      if (!exists && profile.pinned.length >= 3)
        throw new Error(
          'Seu perfil reúne até três itens. Desafixe um antes de adicionar outro.',
        )
      const pinned = exists
        ? profile.pinned.filter(
            (pin) => pin.type !== item.type || pin.id !== item.id,
          )
        : [...profile.pinned, item]
      await this.meta().put({
        key: 'profile',
        value: profileSchema.parse({ ...profile, pinned }),
      })
      return this.readSnapshot()
    })
  }
  async clearAll(): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      for (const table of this.database.tables) await table.clear()
      await this.meta().bulkPut([
        { key: 'initialized', value: true },
        { key: 'projectExamplesVersion', value: 2 },
        { key: 'studyExamplesVersion', value: 1 },
      ])
      return emptySnapshot()
    })
  }
  private learning() {
    return new LearningRepository(this.database)
  }
  saveFlashcard(item: Flashcard, version: string | null) {
    return this.learning().saveFlashcard(item, version)
  }
  reviewFlashcard(id: string, quality: number, version: string) {
    return this.learning().reviewFlashcard(id, quality, version)
  }
  removeFlashcard(id: string) {
    return this.learning().removeFlashcard(id)
  }
  canUndoFlashcard() {
    return this.learning().canUndoFlashcard()
  }
  undoFlashcard() {
    return this.learning().undoFlashcard()
  }
  startFocus(input: StartFocusInput) {
    return this.learning().startFocus(input)
  }
  changeFocus(id: string, action: FocusAction, version: string) {
    return this.learning().changeFocus(id, action, version)
  }
  unlinkFocusTask(id: string, version: string) {
    return this.learning().unlinkFocusTask(id, version)
  }
  canUndoFocusTask() {
    return this.learning().canUndoFocusTask()
  }
  undoFocusTask() {
    return this.learning().undoFocusTask()
  }
  private async studyHistory() {
    return studyHistorySchema.parse(
      (await this.meta().get('studyHistory'))?.value ?? [],
    )
  }
  private async persistStudyChange(
    data: Snapshot,
    next: Snapshot,
    type: Study,
    id: string,
    label: string,
  ) {
    const validated = validateSnapshot(next)
    const delta = await this.writeDirectionChanges(data, validated)
    await this.meta().put({
      key: 'studyHistory',
      value: [...(await this.studyHistory()), { type, id, label, ...delta }],
    })
    return validated
  }
  async saveStudy<K extends Study>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: EntityMap[K] }> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const previous = data[name].find((record) => record.id === item.id)
      if ((previous?.updatedAt ?? null) !== expectedUpdatedAt)
        throw new Error(
          'Este registro mudou em outra aba. Reabra a versão salva antes de continuar.',
        )
      if (previous?.status === 'archived' || item.status === 'archived')
        throw new Error(
          'Desarquive antes de editar; use Arquivar para guardar com opção de desfazer.',
        )
      const saved = {
        ...item,
        createdAt: previous?.createdAt ?? item.createdAt,
        updatedAt: previous
          ? recordTimestamp(previous)
          : new Date(
              Math.max(Date.now(), Date.parse(item.createdAt)),
            ).toISOString(),
        isExample: false,
      }
      const next = validateSnapshot(
        replaceCollection(data, name, [
          ...data[name].filter((record) => record.id !== item.id),
          saved,
        ]),
      )
      const deletedNested =
        previous &&
        ('events' in previous && 'events' in saved
          ? previous.events.some(
              (event) => !saved.events.some((other) => other.id === event.id),
            ) ||
            previous.assessments.some(
              (assessment) =>
                !saved.assessments.some((other) => other.id === assessment.id),
            )
          : 'steps' in previous &&
            'steps' in saved &&
            previous.steps.some(
              (step) => !saved.steps.some((other) => other.id === step.id),
            ))
      const removedAbsence =
        previous &&
        'absences' in previous &&
        'absences' in saved &&
        saved.absences < previous.absences
      if (deletedNested || removedAbsence)
        await this.persistStudyChange(
          data,
          next,
          name,
          item.id,
          `${removedAbsence ? 'Remover falta' : 'Remover item'} de ${saved.title}`,
        )
      else await this.writeDirectionChanges(data, next)
      if (name === 'studyPaths' && 'steps' in saved) {
        for (const step of saved.steps) {
          const wasDone =
            previous &&
            'steps' in previous &&
            previous.steps.find((item) => item.id === step.id)?.done
          if (step.done && !wasDone)
            next.experience = await awardExperience(
              this.database,
              'step',
              `${saved.id}/${step.id}`,
              dateKey(new Date()),
            )
        }
      }
      return {
        data: next,
        saved: next[name].find(
          (record) => record.id === item.id,
        )! as EntityMap[K],
      }
    })
  }
  async archiveStudy(
    name: Study,
    id: string,
    archived: boolean,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const previous = data[name].find((record) => record.id === id)
      if (!previous)
        throw new Error(
          'Registro não encontrado. Reabra a lista e tente novamente.',
        )
      if ((previous.status === 'archived') === archived) return data
      const { archivedFrom, ...fields } = previous
      const next = {
        ...fields,
        status: archived ? 'archived' : (archivedFrom ?? 'active'),
        ...(archived ? { archivedFrom: previous.status } : {}),
        updatedAt: recordTimestamp(previous),
        isExample: false,
      }
      return this.persistStudyChange(
        data,
        replaceCollection(
          data,
          name,
          data[name].map((record) =>
            record.id === id ? (next as EntityMap[Study]) : record,
          ),
        ),
        name,
        id,
        `${archived ? 'Arquivar' : 'Desarquivar'} ${previous.title}`,
      )
    })
  }
  async removeStudy(name: Study, id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const previous = data[name].find((record) => record.id === id)
      if (!previous)
        throw new Error(
          'Registro não encontrado. Reabra a lista e tente novamente.',
        )
      let next = { ...data }
      for (const collection of collections) {
        next = replaceCollection(
          next,
          collection,
          data[collection]
            .filter((record) => record.id !== id)
            .map((record) =>
              record.links.some((link) => link.type === name && link.id === id)
                ? {
                    ...record,
                    links: record.links.filter(
                      (link) => !(link.type === name && link.id === id),
                    ),
                    updatedAt: recordTimestamp(record),
                  }
                : record,
            ),
        )
      }
      return this.persistStudyChange(
        data,
        next,
        name,
        id,
        `Excluir ${previous.title}`,
      )
    })
  }
  async linkStudy(
    name: Study,
    id: string,
    targetType: 'tasks' | 'notes',
    targetId: string,
    linked: boolean,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const current = data[name].find((record) => record.id === id)
      const target = data[targetType].find((record) => record.id === targetId)
      if (!current || !target)
        throw new Error(
          'Um dos registros não existe mais. Reabra a lista e tente novamente.',
        )
      if (current.status === 'archived')
        throw new Error('Desarquive antes de alterar vínculos.')
      if (linked && 'archivedAt' in target && target.archivedAt)
        throw new Error('Desarquive a nota antes de vincular.')
      const has = current.links.some(
        (link) => link.type === targetType && link.id === targetId,
      )
      const incoming = target.links.some(
        (link) => link.type === name && link.id === id,
      )
      if (linked && (has || incoming)) return data
      let updated: EntityMap[Study] = {
        ...current,
        links: linked
          ? [...current.links, { type: targetType, id: targetId }]
          : current.links.filter(
              (link) => !(link.type === targetType && link.id === targetId),
            ),
        updatedAt: recordTimestamp(current),
        isExample: false,
      }
      if (!linked) {
        updated =
          'events' in updated
            ? {
                ...updated,
                events: updated.events.map((event) =>
                  targetType === 'tasks' && event.taskId === targetId
                    ? { ...event, taskId: null }
                    : event,
                ),
              }
            : {
                ...updated,
                steps: updated.steps.map((step) => ({
                  ...step,
                  taskId:
                    targetType === 'tasks' && step.taskId === targetId
                      ? null
                      : step.taskId,
                  noteId:
                    targetType === 'notes' && step.noteId === targetId
                      ? null
                      : step.noteId,
                })),
              }
      }
      let next = replaceCollection(
        data,
        name,
        data[name].map((record) => (record.id === id ? updated : record)),
      )
      if (!linked && incoming)
        next = replaceCollection(
          next,
          targetType,
          next[targetType].map((record) =>
            record.id === targetId
              ? {
                  ...record,
                  links: record.links.filter(
                    (link) => !(link.type === name && link.id === id),
                  ),
                  updatedAt: recordTimestamp(record),
                  isExample: false,
                }
              : record,
          ),
        )
      next = validateSnapshot(next)
      await this.writeDirectionChanges(data, next)
      return next
    })
  }
  async createStudyTask(
    name: Study,
    id: string,
    item: Task,
    eventId?: string,
    stepId?: string,
  ): Promise<{ data: Snapshot; created: Task }> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const current = data[name].find((record) => record.id === id)
      if (!current || current.status === 'archived')
        throw new Error(
          'Reabra uma disciplina ou trilha ativa antes de criar a tarefa.',
        )
      if (
        collections.some((collection) =>
          data[collection].some((record) => record.id === item.id),
        )
      )
        throw new Error('Este ID já existe. Crie uma nova tarefa.')
      if (
        (eventId &&
          (!('events' in current) ||
            !current.events.some((event) => event.id === eventId))) ||
        (stepId &&
          (!('steps' in current) ||
            !current.steps.some((step) => step.id === stepId)))
      )
        throw new Error(
          'Esta prova, entrega ou etapa não existe mais. Reabra a lista.',
        )
      if (
        eventId &&
        'events' in current &&
        current.events.find((event) => event.id === eventId)?.taskId
      )
        throw new Error(
          'Esta prova ou entrega já tem uma tarefa. Abra a tarefa vinculada.',
        )
      if (
        stepId &&
        'steps' in current &&
        current.steps.find((step) => step.id === stepId)?.taskId
      )
        throw new Error(
          'Esta etapa já tem uma tarefa. Abra a tarefa vinculada.',
        )
      const created: Task = {
        ...item,
        isExample: false,
        updatedAt: new Date(
          Math.max(Date.now(), Date.parse(item.createdAt)),
        ).toISOString(),
        links: [
          ...item.links.filter(
            (link) => !(link.type === name && link.id === id),
          ),
          { type: name, id },
        ],
      }
      let next: Snapshot = { ...data, tasks: [...data.tasks, created] }
      if (eventId || stepId) {
        const updated =
          'events' in current
            ? {
                ...current,
                events: current.events.map((event) =>
                  event.id === eventId
                    ? { ...event, taskId: created.id }
                    : event,
                ),
                updatedAt: recordTimestamp(current),
                isExample: false,
              }
            : {
                ...current,
                steps: current.steps.map((step) =>
                  step.id === stepId ? { ...step, taskId: created.id } : step,
                ),
                updatedAt: recordTimestamp(current),
                isExample: false,
              }
        next = replaceCollection(
          next,
          name,
          data[name].map((record) => (record.id === id ? updated : record)),
        )
      }
      next = validateSnapshot(next)
      await this.writeDirectionChanges(data, next)
      return {
        data: next,
        created: next.tasks.find((task) => task.id === item.id)!,
      }
    })
  }
  async getStudyUndo(): Promise<{
    label: string
    type: Study
    id: string
  } | null> {
    const latest = (await this.studyHistory()).at(-1)
    return latest
      ? { label: latest.label, type: latest.type, id: latest.id }
      : null
  }
  async undoStudyChange(): Promise<Snapshot> {
    return this.undoRecordChange('studyHistory')
  }
  private async directionHistory() {
    return directionHistorySchema.parse(
      (await this.meta().get('directionHistory'))?.value ?? [],
    )
  }
  private async writeDirectionChanges(before: Snapshot, after: Snapshot) {
    const delta = directionDelta(before, after)
    for (const name of collections) {
      const retained = new Set(delta.after[name].map((item) => item.id))
      await this.table(name).bulkDelete(
        delta.before[name]
          .filter((item) => !retained.has(item.id))
          .map((item) => item.id),
      )
      await this.table(name).bulkPut(delta.after[name])
    }
    return delta
  }
  private async persistDirectionChange(
    data: Snapshot,
    next: Snapshot,
    type: Direction,
    id: string,
    label: string,
  ) {
    const validated = validateSnapshot(next)
    const delta = await this.writeDirectionChanges(data, validated)
    await this.meta().put({
      key: 'directionHistory',
      value: [
        ...(await this.directionHistory()),
        { type, id, label, ...delta },
      ],
    })
    return validated
  }
  async saveDirection<K extends Direction>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: EntityMap[K] }> {
    return this.database.transaction('rw', this.database.tables, async () => {
      let data = await this.readSnapshot()
      const previous = data[name].find((record) => record.id === item.id)
      if ((previous?.updatedAt ?? null) !== expectedUpdatedAt)
        throw new Error(
          'Este registro mudou em outra aba. Reabra a versão salva antes de continuar.',
        )
      if (previous?.status === 'archived')
        throw new Error(
          'Este registro está arquivado. Desarquive antes de editar.',
        )
      if (item.status === 'archived')
        throw new Error(
          'Use a ação Arquivar para guardar este registro com opção de desfazer.',
        )
      const saved = {
        ...item,
        createdAt: previous?.createdAt ?? item.createdAt,
        updatedAt: previous
          ? recordTimestamp(previous)
          : new Date(
              Math.max(Date.now(), Date.parse(item.createdAt)),
            ).toISOString(),
        isExample: false,
      }
      const before = data
      if (name === 'goals' && 'weekly' in saved && saved.weekly)
        data = selectWeeklyGoal(data, saved.id)
      const next = validateSnapshot(
        replaceCollection(data, name, [
          ...data[name].filter((record) => record.id !== saved.id),
          saved,
        ]),
      )
      await this.writeDirectionChanges(before, next)
      return {
        data: next,
        saved: next[name].find(
          (record) => record.id === item.id,
        )! as EntityMap[K],
      }
    })
  }
  async archiveDirection(
    name: Direction,
    id: string,
    archived: boolean,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const before = data[name].find((record) => record.id === id)
      if (!before)
        throw new Error(
          'Registro não encontrado. Reabra a lista e tente novamente.',
        )
      if ((before.status === 'archived') === archived) return data
      const { archivedFrom, ...fields } = before
      const status = archived
        ? 'archived'
        : (archivedFrom ?? (name === 'goals' ? 'active' : 'planned'))
      const after = {
        ...fields,
        status,
        ...(archived
          ? {
              archivedFrom:
                before.status ?? (name === 'goals' ? 'active' : 'planned'),
            }
          : {}),
        ...(name === 'goals' && archived ? { weekly: false } : {}),
        updatedAt: recordTimestamp(before),
        isExample: false,
      }
      return this.persistDirectionChange(
        data,
        replaceCollection(
          data,
          name,
          data[name].map((record) =>
            record.id === id ? (after as EntityMap[Direction]) : record,
          ),
        ),
        name,
        id,
        archived ? `Arquivar ${before.title}` : `Desarquivar ${before.title}`,
      )
    })
  }
  async removeDirection(name: Direction, id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const before = data[name].find((record) => record.id === id)
      if (!before)
        throw new Error(
          'Registro não encontrado. Reabra a lista e tente novamente.',
        )
      let next = { ...data }
      for (const collection of collections) {
        next = replaceCollection(
          next,
          collection,
          data[collection]
            .filter((record) => record.id !== id)
            .map((record) =>
              record.links.some((link) => link.type === name && link.id === id)
                ? {
                    ...record,
                    links: record.links.filter(
                      (link) => !(link.type === name && link.id === id),
                    ),
                    updatedAt: recordTimestamp(record),
                  }
                : record,
            ),
        )
      }
      return this.persistDirectionChange(
        data,
        next,
        name,
        id,
        `Excluir ${before.title}`,
      )
    })
  }
  async linkDirection(
    name: Direction,
    id: string,
    targetType: RelatedCollection,
    targetId: string,
    linked: boolean,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const current = data[name].find((record) => record.id === id)
      const target = data[targetType].find((record) => record.id === targetId)
      if (!current || !target)
        throw new Error(
          'Um dos registros não existe mais. Reabra a lista e tente novamente.',
        )
      if (
        id === targetId ||
        !(
          name === 'goals' ? ['tasks', 'projects'] : ['tasks', 'notes', 'goals']
        ).includes(targetType)
      )
        throw new Error(
          'Escolha uma relação válida: metas aceitam tarefas e projetos; projetos aceitam tarefas, notas e metas.',
        )
      if (current.status === 'archived')
        throw new Error(
          'Este registro está arquivado. Desarquive antes de alterar vínculos.',
        )
      if (
        linked &&
        (('status' in target && target.status === 'archived') ||
          ('archivedAt' in target && target.archivedAt))
      )
        throw new Error(
          'O registro escolhido está arquivado. Desarquive antes de vincular.',
        )
      const outgoing = current.links.some(
        (link) => link.type === targetType && link.id === targetId,
      )
      const incoming = target.links.some(
        (link) => link.type === name && link.id === id,
      )
      if (
        (linked && (outgoing || incoming)) ||
        (!linked && !outgoing && !incoming)
      )
        return data
      let next = replaceCollection(
        data,
        name,
        data[name].map((record) =>
          record.id === id
            ? {
                ...record,
                links: linked
                  ? [...record.links, { type: targetType, id: targetId }]
                  : record.links.filter(
                      (link) =>
                        !(link.type === targetType && link.id === targetId),
                    ),
                updatedAt: recordTimestamp(record),
                isExample: false,
              }
            : record,
        ),
      )
      if (!linked && incoming)
        next = replaceCollection(
          next,
          targetType,
          next[targetType].map((record) =>
            record.id === targetId
              ? {
                  ...record,
                  links: record.links.filter(
                    (link) => !(link.type === name && link.id === id),
                  ),
                  updatedAt: recordTimestamp(record),
                  isExample: false,
                }
              : record,
          ),
        )
      next = validateSnapshot(next)
      await this.writeDirectionChanges(data, next)
      return next
    })
  }
  async createProjectItem<K extends 'tasks' | 'notes'>(
    projectId: string,
    name: K,
    item: EntityMap[K],
  ): Promise<{ data: Snapshot; created: EntityMap[K] }> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const project = data.projects.find((record) => record.id === projectId)
      if (!project)
        throw new Error(
          'Projeto não encontrado. Reabra a lista e tente novamente.',
        )
      if (project.status === 'archived')
        throw new Error(
          'Este projeto está arquivado. Desarquive antes de criar registros.',
        )
      if (
        collections.some((collection) =>
          data[collection].some((record) => record.id === item.id),
        )
      )
        throw new Error(
          'Este ID já existe. Crie um novo registro para evitar sobrescrever dados.',
        )
      if (name === 'notes' && /\[\[|\]\]|[\r\n]/u.test(item.title))
        throw new Error(
          'Use um título sem [[, ]] ou quebras de linha para preservar os links internos.',
        )
      const timestamp = new Date(
        Math.max(Date.now(), Date.parse(item.createdAt)),
      ).toISOString()
      const created = {
        ...item,
        updatedAt: timestamp,
        isExample: false,
        links: [
          ...item.links.filter(
            (link) => !(link.type === 'projects' && link.id === projectId),
          ),
          { type: 'projects' as const, id: projectId },
        ],
      }
      const next = validateSnapshot(
        replaceCollection(data, name, [...data[name], created]),
      )
      const validated = next[name].find(
        (record) => record.id === item.id,
      )! as EntityMap[K]
      await this.table(name).put(validated)
      return { data: next, created: validated }
    })
  }
  async getDirectionUndo(): Promise<{
    label: string
    type: Direction
    id: string
  } | null> {
    const latest = (await this.directionHistory()).at(-1)
    return latest
      ? { label: latest.label, type: latest.type, id: latest.id }
      : null
  }
  async undoDirectionChange(): Promise<Snapshot> {
    return this.undoRecordChange('directionHistory')
  }
  private async undoRecordChange(
    historyKey: 'directionHistory' | 'studyHistory',
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const history =
        historyKey === 'directionHistory'
          ? await this.directionHistory()
          : await this.studyHistory()
      const entry = history.at(-1)
      const data = await this.readSnapshot()
      if (!entry) return data
      let next = { ...data }
      for (const name of collections) {
        const affectedIds = new Set(
          [...entry.before[name], ...entry.after[name]].map(
            (record) => record.id,
          ),
        )
        for (const id of affectedIds) {
          const current = data[name].find((record) => record.id === id) ?? null
          const expected =
            entry.after[name].find((record) => record.id === id) ?? null
          if (!equalRecord(current, expected))
            throw new Error(
              'Um registro mudou depois desta ação. A versão atual foi preservada; não é possível desfazer sobre ela.',
            )
        }
        next = replaceCollection(next, name, [
          ...next[name].filter((record) => !affectedIds.has(record.id)),
          ...entry.before[name].map((record) => {
            const current = data[name].find((item) => item.id === record.id)
            return {
              ...record,
              updatedAt: new Date(
                Math.max(
                  Date.now(),
                  Date.parse(record.updatedAt) + 1,
                  Date.parse(current?.updatedAt ?? record.updatedAt) + 1,
                ),
              ).toISOString(),
            }
          }),
        ])
      }
      next = validateSnapshot(next)
      const remaining = history.slice(0, -1)
      // Undo advances version tokens. Keep earlier undo entries compatible only when
      // they expected exactly the state just restored, preserving concurrency guards.
      for (const name of collections) {
        for (const restored of entry.before[name]) {
          for (let index = remaining.length - 1; index >= 0; index--) {
            const earlier = remaining[index]!
            if (
              ![...earlier.before[name], ...earlier.after[name]].some(
                (record) => record.id === restored.id,
              )
            )
              continue
            const expected = earlier.after[name].find(
              (record) => record.id === restored.id,
            )
            if (expected && equalRecord(expected, restored)) {
              earlier.after = replaceCollection(
                earlier.after,
                name,
                earlier.after[name].map((record) =>
                  record.id === restored.id
                    ? next[name].find((item) => item.id === restored.id)!
                    : record,
                ),
              )
            }
            break
          }
        }
      }
      const relatedHistoryKey =
        historyKey === 'studyHistory' ? 'directionHistory' : 'studyHistory'
      const relatedHistory =
        relatedHistoryKey === 'studyHistory'
          ? await this.studyHistory()
          : await this.directionHistory()
      let rebasedRelated = false
      for (const name of collections) {
        for (const restored of entry.before[name]) {
          for (let index = relatedHistory.length - 1; index >= 0; index--) {
            const earlier = relatedHistory[index]!
            if (
              ![...earlier.before[name], ...earlier.after[name]].some(
                (record) => record.id === restored.id,
              )
            )
              continue
            const expected = earlier.after[name].find(
              (record) => record.id === restored.id,
            )
            if (expected && equalRecord(expected, restored)) {
              earlier.after = replaceCollection(
                earlier.after,
                name,
                earlier.after[name].map((record) =>
                  record.id === restored.id
                    ? next[name].find((item) => item.id === restored.id)!
                    : record,
                ),
              )
              rebasedRelated = true
            }
            break
          }
        }
      }
      const noteHistory = await this.noteHistory()
      let rebasedNotes = false
      for (const restored of entry.before.notes) {
        for (let index = noteHistory.length - 1; index >= 0; index--) {
          const earlier = noteHistory[index]!
          if (earlier.before.id !== restored.id) continue
          // Only rebase the version of the exact state restored by this undo.
          // A later real edit (including a version-only save) must still block undo.
          if (earlier.after && equalRecord(earlier.after, restored)) {
            earlier.after = next.notes.find((note) => note.id === restored.id)!
            rebasedNotes = true
          }
          break
        }
      }
      await this.writeDirectionChanges(data, next)
      if (rebasedNotes)
        await this.meta().put({ key: 'noteHistory', value: noteHistory })
      if (rebasedRelated)
        await this.meta().put({ key: relatedHistoryKey, value: relatedHistory })
      await this.meta().put({
        key: historyKey,
        value: remaining,
      })
      return next
    })
  }
  private async noteHistory() {
    const schema = z.array(
      z.object({ before: noteSchema, after: noteSchema.nullable() }),
    )
    return schema.parse((await this.meta().get('noteHistory'))?.value ?? [])
  }
  async saveNote(
    note: Note,
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: Note }> {
    // Resolve external code before opening Dexie's atomic transaction.
    const { renameWikiLinks } = await import('../../lib/note-links')
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const previous = data.notes.find((item) => item.id === note.id)
      if ((previous?.updatedAt ?? null) !== expectedUpdatedAt)
        throw new Error(
          'Esta nota mudou em outra aba. Copie seu rascunho e reabra a versão salva antes de continuar.',
        )
      const saved = noteSchema.parse({
        ...note,
        createdAt: previous?.createdAt ?? note.createdAt,
        updatedAt: previous
          ? noteTimestamp(previous)
          : new Date(
              Math.max(Date.now(), Date.parse(note.createdAt)),
            ).toISOString(),
        isExample: false,
      })
      if (/\[\[|\]\]|[\r\n]/u.test(saved.title))
        throw new Error(
          'Use um título sem [[, ]] ou quebras de linha. Esses sinais são reservados aos links.',
        )
      const rename =
        previous &&
        noteKey(previous.title) !== noteKey(saved.title) &&
        resolveNote(previous.title, data.notes)?.id === previous.id
      if (
        rename &&
        data.notes.some(
          (other) =>
            other.id !== saved.id &&
            noteKey(other.title) === noteKey(saved.title),
        )
      )
        throw new Error(
          'Já existe uma nota com esse título. Escolha outro nome para preservar seus links.',
        )
      const notes = [
        ...data.notes.filter((item) => item.id !== saved.id),
        saved,
      ].map((item) => {
        const content = rename
          ? renameWikiLinks(item.content, previous.title, saved.title)
          : item.content
        return content !== item.content
          ? {
              ...item,
              content,
              updatedAt: noteTimestamp(item),
              isExample: false,
            }
          : item
      })
      const next = validateSnapshot({ ...data, notes })
      await this.table('notes').bulkPut(next.notes)
      return {
        data: next,
        saved: next.notes.find((item) => item.id === saved.id)!,
      }
    })
  }
  async archiveNote(id: string, archived: boolean): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const before = data.notes.find((note) => note.id === id)
      if (!before)
        throw new Error(
          'Nota não encontrada. Reabra a lista e tente novamente.',
        )
      const after = {
        ...before,
        archivedAt: archived ? new Date().toISOString() : null,
        updatedAt: noteTimestamp(before),
        isExample: false,
      }
      const next = validateSnapshot({
        ...data,
        notes: data.notes.map((note) => (note.id === id ? after : note)),
      })
      await this.table('notes').put(after)
      await this.meta().put({
        key: 'noteHistory',
        value: [...(await this.noteHistory()), { before, after }],
      })
      return next
    })
  }
  async removeNote(id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const before = data.notes.find((note) => note.id === id)
      if (!before)
        throw new Error(
          'Nota não encontrada. Reabra a lista e tente novamente.',
        )
      if (
        collections.some((name) =>
          data[name].some(
            (item) => item.id !== id && references(item).includes(id),
          ),
        )
      )
        throw new Error(
          'Esta nota tem vínculos em outros registros. Arquive a nota ou remova esses vínculos antes de excluir.',
        )
      await this.table('notes').delete(id)
      await this.meta().put({
        key: 'noteHistory',
        value: [...(await this.noteHistory()), { before, after: null }],
      })
      return { ...data, notes: data.notes.filter((note) => note.id !== id) }
    })
  }
  async canUndoNoteChange(): Promise<boolean> {
    return (await this.noteHistory()).length > 0
  }
  async undoNoteChange(): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const history = await this.noteHistory()
      const entry = history.at(-1)
      const data = await this.readSnapshot()
      if (!entry) return data
      const current = data.notes.find((note) => note.id === entry.before.id)
      if (JSON.stringify(current ?? null) !== JSON.stringify(entry.after))
        throw new Error(
          'A nota mudou depois desta ação. A versão atual foi preservada; não é possível desfazer sobre ela.',
        )
      const next = validateSnapshot({
        ...data,
        notes: [
          ...data.notes.filter((note) => note.id !== entry.before.id),
          entry.before,
        ],
      })
      await this.table('notes').put(entry.before)
      await this.meta().put({ key: 'noteHistory', value: history.slice(0, -1) })
      return next
    })
  }
  readonly database: Dexie
  constructor(database: Dexie = createDatabase()) {
    this.database = database
  }
  private table<K extends Collection>(name: K): Table<EntityMap[K], string> {
    return this.database.table<EntityMap[K], string>(name)
  }
  private meta() {
    return this.database.table<Metadata, string>('meta')
  }
  private async readSnapshot(): Promise<Snapshot> {
    const data = emptySnapshot()
    const [values, routine] = await Promise.all([
      Promise.all(collections.map((name) => this.table(name).toArray())),
      this.meta().get('weeklyRoutine'),
    ])
    return validateSnapshot({
      ...Object.fromEntries(
        collections.map((name, index) => [name, values[index] ?? data[name]]),
      ),
      experience: await readExperience(this.database),
      ...(routine ? { routine: routine.value } : {}),
      ...(await readProfileData(this.database)),
    })
  }
  private async writeSnapshot(data: Snapshot): Promise<void> {
    await this.meta().put({ key: 'experience', value: data.experience })
    await this.meta().put({ key: 'profile', value: data.profile })
    await this.meta().put({ key: 'activity', value: data.activity })
    if (data.routine)
      await this.meta().put({ key: 'weeklyRoutine', value: data.routine })
    else await this.meta().delete('weeklyRoutine')
    for (const name of collections) {
      await this.table(name).clear()
      await this.table(name).bulkPut(data[name])
    }
  }
  async initialize(): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const initialized = await this.meta().get('initialized')
      if (!initialized && recordCount(data) === 0) {
        await this.writeSnapshot(validateSnapshot(buildSeed()))
        await this.meta().put({ key: 'projectExamplesVersion', value: 2 })
        await this.meta().put({ key: 'studyExamplesVersion', value: 1 })
      } else if (!(await this.meta().get('projectExamplesVersion'))) {
        // Upgrade only existing examples. The marker also prevents deleted examples from returning.
        const oldProject = data.projects.find(
          (project) => project.id === 'example-project' && project.isExample,
        )
        if (
          collections.some((name) =>
            data[name].some((record) => record.isExample),
          ) &&
          !(await this.meta().get('removedExamples'))
        ) {
          const additions = buildSeed().projects
          const atlas = additions.find(
            (project) => project.id === 'example-project',
          )!
          const learning = additions.find(
            (project) => project.id === 'example-project-learning',
          )!
          const projects = data.projects.map((project) =>
            project.id === oldProject?.id &&
            project.title === 'Meu primeiro projeto no Atlas'
              ? {
                  ...project,
                  title: atlas.title,
                  description: atlas.description,
                  status: atlas.status,
                  updatedAt: recordTimestamp(project),
                }
              : project,
          )
          if (
            !collections.some((name) =>
              data[name].some(
                (record) => record.id === 'example-project-learning',
              ),
            )
          )
            projects.push(learning)
          const next = validateSnapshot({ ...data, projects })
          await this.table('projects').bulkPut(next.projects)
        }
        await this.meta().put({ key: 'projectExamplesVersion', value: 2 })
      }
      if (!(await this.meta().get('studyExamplesVersion'))) {
        if (
          collections.some((name) =>
            data[name].some((record) => record.isExample),
          ) &&
          !(await this.meta().get('removedExamples'))
        ) {
          const seed = buildSeed()
          const existingIds = new Set(
            collections.flatMap((name) =>
              data[name].map((record) => record.id),
            ),
          )
          const next = validateSnapshot({
            ...(await this.readSnapshot()),
            subjects: [
              ...data.subjects,
              ...seed.subjects.filter((record) => !existingIds.has(record.id)),
            ],
            studyPaths: [
              ...data.studyPaths,
              ...seed.studyPaths.filter(
                (record) => !existingIds.has(record.id),
              ),
            ],
          })
          await this.table('subjects').bulkPut(next.subjects)
          await this.table('studyPaths').bulkPut(next.studyPaths)
        }
        await this.meta().put({ key: 'studyExamplesVersion', value: 1 })
      }
      if (!initialized)
        await this.meta().put({ key: 'initialized', value: true })
    })
  }
  async list<K extends Collection>(name: K): Promise<EntityMap[K][]> {
    return this.table(name).toArray()
  }
  async get<K extends Collection>(
    name: K,
    id: string,
  ): Promise<EntityMap[K] | undefined> {
    return this.table(name).get(id)
  }
  async snapshot(): Promise<Snapshot> {
    return this.database.transaction('r', this.database.tables, () =>
      this.readSnapshot(),
    )
  }
  async save<K extends Collection>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt?: string | null,
  ): Promise<EntityMap[K]> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const previous = await this.get(name, item.id)
      if (
        expectedUpdatedAt !== undefined &&
        (previous?.updatedAt ?? null) !== expectedUpdatedAt
      )
        throw new RepositoryConflictError(
          'Este registro mudou em outra aba. Seu rascunho foi mantido; reabra a versão salva antes de editar.',
        )
      if (name === 'habits') {
        const habit = habitSchema.parse(item)
        const previousHabit = data.habits.find(
          (record) => record.id === item.id,
        )
        if (
          previousHabit &&
          previousHabit.kind !== habit.kind &&
          data.habitLogs.some((log) => log.habitId === habit.id)
        ) {
          throw new Error(
            'Este hábito já possui registros. Crie outro hábito para usar um tipo diferente.',
          )
        }
      }
      const prepared =
        name === 'habits'
          ? editHabitSchedule(
              data.habits.find((h) => h.id === item.id),
              habitSchema.parse(item),
              dateKey(new Date()),
            )
          : item
      const saved = {
        ...prepared,
        isExample: false,
        createdAt: previous?.createdAt ?? item.createdAt,
        updatedAt:
          (name === 'goals' ||
            name === 'projects' ||
            name === 'tasks' ||
            name === 'habits') &&
          previous
            ? recordTimestamp(previous)
            : new Date().toISOString(),
        ...(name === 'tasks' && previous && 'focusMinutes' in previous
          ? { focusMinutes: previous.focusMinutes }
          : {}),
      }
      const base =
        name === 'goals' &&
        'weekly' in saved &&
        saved.weekly &&
        saved.status !== 'archived'
          ? selectWeeklyGoal(data, saved.id)
          : data
      const next = replaceCollection(base, name, [
        ...base[name].filter((record) => record.id !== item.id),
        saved,
      ])
      const checked = validateSnapshot(next)
      const validated = (checked[name] as EntityMap[K][]).find(
        (record) => record.id === item.id,
      )
      if (!validated) throw new Error('Registro não encontrado após validação.')
      if (name === 'goals') await this.writeDirectionChanges(data, checked)
      else await this.table(name).put(validated)
      if (
        name === 'tasks' &&
        'status' in validated &&
        validated.status === 'done' &&
        (!previous || !('status' in previous) || previous.status !== 'done')
      )
        await awardExperience(
          this.database,
          'task',
          item.id,
          dateKey(new Date()),
        )
      if (
        name === 'tasks' &&
        'status' in validated &&
        validated.status === 'done' &&
        (!previous || !('status' in previous) || previous.status !== 'done')
      )
        await recordActivity(
          this.database,
          'task',
          item.id,
          'title' in validated ? validated.title : 'Tarefa',
          dateKey(new Date()),
        )
      return validated
    })
  }
  async remove(name: Collection, id: string): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      if (
        collections.some((key) =>
          data[key].some(
            (item) => item.id !== id && references(item).includes(id),
          ),
        )
      ) {
        throw new Error(
          'Este registro possui vínculos. Remova os vínculos antes de excluir.',
        )
      }
      await this.table(name).delete(id)
    })
  }
  async importData(input: Snapshot): Promise<MergeResult> {
    const incoming = validateSnapshot(input)
    return this.database.transaction('rw', this.database.tables, async () => {
      const merged = mergeSnapshots(await this.readSnapshot(), incoming)
      await this.writeSnapshot(merged.data)
      await this.meta().put({ key: 'initialized', value: true })
      return merged
    })
  }
  async importMarkdownNotes(input: Note[], policy: DuplicatePolicy) {
    const notes = z.array(noteSchema).max(20).parse(input)
    return this.database.transaction('rw', this.database.tables, async () => {
      const current = await this.readSnapshot()
      const plan = planMarkdownImport(
        notes,
        current,
        policy,
        notes.map(() => crypto.randomUUID()),
      )
      if (policy === 'ask' && plan.duplicates.length)
        throw new Error(
          'Há notas duplicadas. Escolha ignorar ou importar como cópia antes de confirmar.',
        )
      const data = validateSnapshot({
        ...current,
        notes: [...current.notes, ...plan.imported],
      })
      await this.table('notes').bulkAdd(plan.imported)
      return { data, imported: plan.imported, skipped: plan.skipped }
    })
  }
  async removeExamples(): Promise<Snapshot> {
    const { removableExamples } = await import('../../lib/data-integrity')
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const removed = removableExamples(data)
      if (recordCount(removed)) {
        await this.writeSnapshot(
          validateSnapshot(subtractSnapshot(data, removed)),
        )
        await this.meta().put({ key: 'removedExamples', value: removed })
      }
      return removed
    })
  }
  async canUndoExamples(): Promise<boolean> {
    return Boolean(await this.meta().get('removedExamples'))
  }
  async saveHabitLog(
    input: HabitLogInput,
    expectedUpdatedAt?: string | null,
  ): Promise<HabitLog> {
    if (!habitLogSchema.shape.date.safeParse(input.date).success) {
      throw new Error('Use uma data válida no formato AAAA-MM-DD.')
    }
    const today = new Date()
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    if (input.date > todayKey) {
      throw new Error(
        'Escolha hoje ou uma data anterior para registrar o hábito.',
      )
    }
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      if (!data.habits.some((habit) => habit.id === input.habitId)) {
        throw new Error(
          'Este hábito não existe mais. Atualize a página e tente novamente.',
        )
      }
      const previous = await this.table('habitLogs')
        .where('[habitId+date]')
        .equals([input.habitId, input.date])
        .first()
      if (
        expectedUpdatedAt !== undefined &&
        (previous?.updatedAt ?? null) !== expectedUpdatedAt
      )
        throw new RepositoryConflictError(
          'Este registro mudou em outra aba. Seu rascunho foi mantido; reabra o dia antes de editar.',
        )
      const timestamp = new Date().toISOString()
      const saved: HabitLog = {
        id: previous?.id ?? crypto.randomUUID(),
        tags: previous?.tags ?? [],
        links: previous?.links ?? [],
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: previous ? recordTimestamp(previous) : timestamp,
        isExample: false,
        ...input,
        value: input.rest ? 0 : input.value,
      }
      const next = {
        ...data,
        habitLogs: [
          ...data.habitLogs.filter((record) => record.id !== saved.id),
          saved,
        ],
      }
      const validated = validateSnapshot(next).habitLogs.find(
        (record) => record.id === saved.id,
      )
      if (!validated) throw new Error('Registro não encontrado após validação.')
      await this.table('habitLogs').put(validated)
      if (validated.value > 0 && !validated.rest)
        await recordActivity(
          this.database,
          'habit',
          validated.habitId,
          data.habits.find((h) => h.id === validated.habitId)?.title ??
            'Hábito',
          validated.date,
          validated.value,
        )
      if (validated.value > 0 && !validated.rest)
        await awardExperience(
          this.database,
          'habit',
          validated.habitId,
          validated.date,
        )
      return validated
    })
  }
  private async persistHabitRemoval(
    data: Snapshot,
    removed: Snapshot,
  ): Promise<Snapshot> {
    if (!recordCount(removed)) return removed
    const removedIds = new Set(
      collections.flatMap((name) => removed[name].map((record) => record.id)),
    )
    if (
      collections.some((name) =>
        data[name].some(
          (item) =>
            !removedIds.has(item.id) &&
            references(item).some((id) => removedIds.has(id)),
        ),
      )
    ) {
      throw new Error(
        'Este hábito possui vínculos. Remova os vínculos antes de excluir.',
      )
    }
    await this.writeSnapshot(validateSnapshot(subtractSnapshot(data, removed)))
    await this.meta().put({ key: 'removedHabitData', value: removed })
    return removed
  }
  async removeHabit(id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const removed = emptySnapshot()
      removed.habits = data.habits.filter((habit) => habit.id === id)
      removed.habitLogs = data.habitLogs.filter((log) => log.habitId === id)
      return this.persistHabitRemoval(data, removed)
    })
  }
  async removeHabitLog(habitId: string, date: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const removed = emptySnapshot()
      removed.habitLogs = data.habitLogs.filter(
        (log) => log.habitId === habitId && log.date === date,
      )
      return this.persistHabitRemoval(data, removed)
    })
  }
  async canUndoHabitRemoval(): Promise<boolean> {
    return Boolean(await this.meta().get('removedHabitData'))
  }
  async undoHabitRemoval(): Promise<MergeResult> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const current = await this.readSnapshot()
      const backup = await this.meta().get('removedHabitData')
      if (!backup) return { data: current, added: 0, skipped: 0 }
      // A removed log may refer to a habit that remained in the database.
      const removed = snapshotSchema.parse(backup.value)
      const merged = mergeSnapshots(current, removed, true)
      await this.writeSnapshot(merged.data)
      await this.meta().delete('removedHabitData')
      return merged
    })
  }
  async setTaskStatus(id: string, status: Task['status']): Promise<Task> {
    if (!taskSchema.shape.status.safeParse(status).success) {
      throw new Error('Escolha A fazer, Fazendo ou Feito para esta tarefa.')
    }
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const current = data.tasks.find((task) => task.id === id)
      if (!current) {
        throw new Error(
          'Esta tarefa não existe mais. Atualize a página e tente novamente.',
        )
      }
      if (current.status === status) return current

      const timestamp = new Date().toISOString()
      const saved: Task = {
        ...current,
        status,
        isExample: false,
        updatedAt: recordTimestamp(current),
      }
      const occurrenceKey = `taskOccurrence:${id}`
      const previousOccurrence = await this.meta().get(occurrenceKey)
      let successor: Task | undefined
      if (status === 'done' && current.repeat && !previousOccurrence) {
        const dueDate = nextOccurrence(current, dateKey(new Date()))
        if (dueDate) {
          successor = {
            ...current,
            id: crypto.randomUUID(),
            status: 'todo',
            dueDate,
            focusMinutes: 0,
            subtasks: current.subtasks.map((subtask) => ({
              ...subtask,
              id: crypto.randomUUID(),
              done: false,
            })),
            isExample: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        }
      }
      validateSnapshot({
        ...data,
        tasks: [
          ...data.tasks.filter((task) => task.id !== id),
          saved,
          ...(successor ? [successor] : []),
        ],
      })
      await this.table('tasks').put(saved)
      if (status === 'done' && current.status !== 'done')
        await recordActivity(
          this.database,
          'task',
          id,
          current.title,
          dateKey(new Date()),
        )
      if (status === 'done')
        await awardExperience(this.database, 'task', id, dateKey(new Date()))
      if (successor) await this.table('tasks').put(successor)
      if (
        !previousOccurrence &&
        current.repeat &&
        (status === 'done' || current.status === 'done')
      ) {
        // Remember completion when reopening an imported done record, too.
        // This marker remains after removal so undo cannot duplicate a successor.
        await this.meta().put({
          key: occurrenceKey,
          value: { successorId: successor?.id ?? null },
        })
      }
      return saved
    })
  }
  async postponeTask(id: string, date: string): Promise<Task> {
    if (!taskSchema.shape.dueDate.safeParse(date).success) {
      throw new Error('Use uma data válida no formato AAAA-MM-DD para adiar.')
    }
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const current = data.tasks.find((task) => task.id === id)
      if (!current) {
        throw new Error(
          'Esta tarefa não existe mais. Atualize a página e tente novamente.',
        )
      }
      const saved: Task = {
        ...current,
        dueDate: date,
        isExample: false,
        updatedAt: recordTimestamp(current),
      }
      validateSnapshot({
        ...data,
        tasks: data.tasks.map((task) => (task.id === id ? saved : task)),
      })
      await this.table('tasks').put(saved)
      return saved
    })
  }
  async removeTask(id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.readSnapshot()
      const removed = emptySnapshot()
      removed.tasks = data.tasks.filter((task) => task.id === id)
      if (!removed.tasks.length) return removed
      if (
        collections.some((name) =>
          data[name].some(
            (item) => item.id !== id && references(item).includes(id),
          ),
        )
      ) {
        throw new Error(
          'Esta tarefa possui vínculos. Remova os vínculos antes de excluir.',
        )
      }
      validateSnapshot(subtractSnapshot(data, removed))
      await this.table('tasks').delete(id)
      await this.meta().put({ key: 'removedTaskData', value: removed })
      return removed
    })
  }
  async canUndoTaskRemoval(): Promise<boolean> {
    return Boolean(await this.meta().get('removedTaskData'))
  }
  async undoTaskRemoval(): Promise<MergeResult> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const current = await this.readSnapshot()
      const backup = await this.meta().get('removedTaskData')
      if (!backup) return { data: current, added: 0, skipped: 0 }
      const removed = snapshotSchema.parse(backup.value)
      const merged = mergeSnapshots(current, removed, true)
      // The delta contains only tasks; leave other collections untouched.
      const currentIds = new Set(current.tasks.map((task) => task.id))
      await this.table('tasks').bulkPut(
        merged.data.tasks.filter((task) => !currentIds.has(task.id)),
      )
      await this.meta().delete('removedTaskData')
      return merged
    })
  }
  async undoRemoveExamples(): Promise<MergeResult> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const backup = await this.meta().get('removedExamples')
      const current = await this.readSnapshot()
      if (!backup) return { data: current, added: 0, skipped: 0 }
      // The undo delta can refer to protected examples that stayed in the database.
      const removed = snapshotSchema.parse(backup.value)
      const merged = mergeSnapshots(current, removed, true)
      await this.writeSnapshot(merged.data)
      await this.meta().delete('removedExamples')
      return merged
    })
  }
  subscribe(
    onData: (data: Snapshot) => void,
    onError: (error: unknown) => void,
  ) {
    const subscription = liveQuery(() => this.snapshot()).subscribe({
      next: onData,
      error: onError,
    })
    return () => subscription.unsubscribe()
  }
}
