import type { ProfilePreferences, PinnedItem } from '../profile-models'
import type {
  Collection,
  EntityMap,
  HabitLog,
  Snapshot,
  Task,
  Note,
  Flashcard,
  FocusSession,
} from '../models'
import type { FocusAction } from '../../lib/focus'
import type { MergeResult } from '../../lib/data-integrity'

export interface HabitLogInput {
  habitId: string
  date: string
  value: number
  rest: boolean
}

export interface StartFocusInput {
  id: string
  mode: FocusSession['mode']
  plannedSeconds: number
  taskId: string | null
  links?: FocusSession['links']
}

export interface AtlasRepository {
  saveProfile(
    profile: ProfilePreferences,
    expected?: ProfilePreferences,
  ): Promise<Snapshot>
  togglePinned(item: PinnedItem, expectedPinned?: boolean): Promise<Snapshot>
  saveFlashcard(
    item: Flashcard,
    expectedUpdatedAt: string | null,
  ): Promise<Snapshot>
  reviewFlashcard(
    id: string,
    quality: number,
    expectedUpdatedAt: string,
  ): Promise<Snapshot>
  removeFlashcard(id: string): Promise<Snapshot>
  canUndoFlashcard(): Promise<boolean>
  undoFlashcard(): Promise<Snapshot>
  startFocus(input: StartFocusInput): Promise<Snapshot>
  changeFocus(
    id: string,
    action: FocusAction,
    expectedUpdatedAt: string,
  ): Promise<Snapshot>
  unlinkFocusTask(id: string, expectedUpdatedAt: string): Promise<Snapshot>
  canUndoFocusTask(): Promise<boolean>
  undoFocusTask(): Promise<Snapshot>
  saveStudy<K extends 'subjects' | 'studyPaths'>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: EntityMap[K] }>
  archiveStudy(
    name: 'subjects' | 'studyPaths',
    id: string,
    archived: boolean,
  ): Promise<Snapshot>
  removeStudy(name: 'subjects' | 'studyPaths', id: string): Promise<Snapshot>
  undoStudyChange(): Promise<Snapshot>
  getStudyUndo(): Promise<{
    label: string
    type: 'subjects' | 'studyPaths'
    id: string
  } | null>
  linkStudy(
    name: 'subjects' | 'studyPaths',
    id: string,
    targetType: 'tasks' | 'notes',
    targetId: string,
    linked: boolean,
  ): Promise<Snapshot>
  createStudyTask(
    name: 'subjects' | 'studyPaths',
    id: string,
    item: Task,
    eventId?: string,
    stepId?: string,
  ): Promise<{ data: Snapshot; created: Task }>
  saveDirection<K extends 'goals' | 'projects'>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: EntityMap[K] }>
  archiveDirection(
    name: 'goals' | 'projects',
    id: string,
    archived: boolean,
  ): Promise<Snapshot>
  removeDirection(name: 'goals' | 'projects', id: string): Promise<Snapshot>
  linkDirection(
    name: 'goals' | 'projects',
    id: string,
    targetType: 'tasks' | 'notes' | 'goals' | 'projects',
    targetId: string,
    linked: boolean,
  ): Promise<Snapshot>
  createProjectItem<K extends 'tasks' | 'notes'>(
    projectId: string,
    name: K,
    item: EntityMap[K],
  ): Promise<{ data: Snapshot; created: EntityMap[K] }>
  undoDirectionChange(): Promise<Snapshot>
  getDirectionUndo(): Promise<{
    label: string
    type: 'goals' | 'projects'
    id: string
  } | null>
  saveNote(
    note: Note,
    expectedUpdatedAt: string | null,
  ): Promise<{ data: Snapshot; saved: Note }>
  archiveNote(id: string, archived: boolean): Promise<Snapshot>
  removeNote(id: string): Promise<Snapshot>
  undoNoteChange(): Promise<Snapshot>
  canUndoNoteChange(): Promise<boolean>
  clearAll(): Promise<Snapshot>
  initialize(): Promise<void>
  list<K extends Collection>(name: K): Promise<EntityMap[K][]>
  get<K extends Collection>(
    name: K,
    id: string,
  ): Promise<EntityMap[K] | undefined>
  save<K extends Collection>(
    name: K,
    item: EntityMap[K],
    expectedUpdatedAt?: string | null,
  ): Promise<EntityMap[K]>
  remove(name: Collection, id: string): Promise<void>
  snapshot(): Promise<Snapshot>
  importData(data: Snapshot): Promise<MergeResult>
  importMarkdownNotes(
    notes: Note[],
    policy: import('../../lib/markdown-import').DuplicatePolicy,
  ): Promise<{ data: Snapshot; imported: Note[]; skipped: number }>
  removeExamples(): Promise<Snapshot>
  undoRemoveExamples(): Promise<MergeResult>
  canUndoExamples(): Promise<boolean>
  saveHabitLog(
    input: HabitLogInput,
    expectedUpdatedAt?: string | null,
  ): Promise<HabitLog>
  removeHabit(id: string): Promise<Snapshot>
  removeHabitLog(habitId: string, date: string): Promise<Snapshot>
  undoHabitRemoval(): Promise<MergeResult>
  canUndoHabitRemoval(): Promise<boolean>
  setTaskStatus(id: string, status: Task['status']): Promise<Task>
  postponeTask(id: string, date: string): Promise<Task>
  removeTask(id: string): Promise<Snapshot>
  undoTaskRemoval(): Promise<MergeResult>
  canUndoTaskRemoval(): Promise<boolean>
  subscribe(
    onData: (data: Snapshot) => void,
    onError: (error: unknown) => void,
  ): () => void
}
