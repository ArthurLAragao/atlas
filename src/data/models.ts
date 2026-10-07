import {
  profileSchema,
  activityEventSchema,
  type ProfilePreferences,
  type ActivityEvent,
} from './profile-models.js'
import { z } from 'zod'

const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/)
const title = z.string().trim().min(1).max(240)
const timestamp = z.iso.datetime({ offset: true })
const date = z.iso
  .date()
  .refine(
    (value) => !value.startsWith('0000-'),
    'Use um ano entre 0001 e 9999.',
  )
const tags = z.array(z.string().trim().min(1).max(60)).max(50)
const link = z
  .object({
    type: z.enum([
      'tasks',
      'habits',
      'notes',
      'goals',
      'projects',
      'subjects',
      'studyPaths',
    ]),
    id,
  })
  .strict()
const base = {
  id,
  tags,
  createdAt: timestamp,
  updatedAt: timestamp,
  isExample: z.boolean(),
  links: z.array(link).max(200),
}

export const taskSchema = z
  .object({
    ...base,
    title,
    status: z.enum(['todo', 'doing', 'done']),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: date.nullable(),
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    context: z.string().trim().min(1).max(80).nullable(),
    subtasks: z
      .array(z.object({ id, title, done: z.boolean() }).strict())
      .max(200)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        'Subtarefas com IDs repetidos.',
      ),
    repeat: z
      .object({
        unit: z.enum(['day', 'week', 'month']),
        interval: z.number().int().min(1).max(365),
      })
      .strict()
      .nullable(),
    focusMinutes: z.number().finite().min(0),
  })
  .strict()
export const habitSchema = z
  .object({
    ...base,
    title,
    kind: z.enum(['binary', 'quantity']),
    target: z.number().positive().finite(),
    unit: z.string().trim().min(1).max(40),
    timesPerWeek: z.number().int().min(1).max(7),
  })
  .strict()
  .refine(
    (habit) => habit.kind !== 'binary' || habit.target === 1,
    'Hábito binário precisa de alvo 1.',
  )
export const habitLogSchema = z
  .object({
    ...base,
    habitId: id,
    date,
    value: z.number().finite().min(0),
    rest: z.boolean(),
  })
  .strict()
export const noteSchema = z
  .object({
    ...base,
    title,
    content: z.string().max(500_000),
    archivedAt: timestamp.nullable().optional(),
  })
  .strict()
export const goalSchema = z
  .object({
    ...base,
    title,
    deadline: date.nullable(),
    description: z.string().max(50_000).optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
    archivedFrom: z.enum(['active', 'completed']).optional(),
    weekly: z.boolean().optional(),
    keyResults: z
      .array(
        z
          .object({
            id,
            title,
            target: z.number().positive().finite(),
            current: z.number().finite().min(0),
            unit: z.string().trim().max(40).optional(),
          })
          .strict(),
      )
      .max(100)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        'Resultados com IDs repetidos.',
      ),
  })
  .strict()
const webUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, 'Use uma URL http ou https.')
export const projectSchema = z
  .object({
    ...base,
    title,
    description: z.string().max(50_000),
    repositoryUrl: webUrl.nullable(),
    urls: z.array(z.object({ title, url: webUrl }).strict()).max(100),
    status: z
      .enum(['planned', 'active', 'paused', 'completed', 'archived'])
      .optional(),
    archivedFrom: z
      .enum(['planned', 'active', 'paused', 'completed'])
      .optional(),
  })
  .strict()

const studyStatus = z.enum(['active', 'completed', 'archived'])
const optionalText = z.string().trim().max(240).nullable()
const uniqueIds = <T extends { id: string }>(items: T[]) =>
  new Set(items.map((item) => item.id)).size === items.length
export const subjectSchema = z
  .object({
    ...base,
    title,
    code: optionalText,
    semester: optionalText,
    professor: optionalText,
    color: z.enum(['neutral', 'accent', 'success']),
    hours: z.number().finite().positive().nullable(),
    status: studyStatus,
    archivedFrom: z.enum(['active', 'completed']).optional(),
    notes: z.string().max(50_000),
    absences: z.number().int().min(0).max(100_000),
    absenceLimit: z.number().int().min(0).max(100_000).nullable(),
    classesHeld: z.number().int().min(0).max(100_000).nullable(),
    assessments: z
      .array(
        z
          .object({
            id,
            title,
            weight: z.number().finite().positive().nullable(),
            score: z.number().finite().min(0),
            maxScore: z.number().finite().positive(),
            date: date.nullable(),
            notes: z.string().max(10_000),
          })
          .strict()
          .refine(
            (item) => item.score <= item.maxScore,
            'A nota não pode ultrapassar a nota máxima.',
          ),
      )
      .max(500)
      .refine(uniqueIds, 'Avaliações com IDs repetidos.'),
    events: z
      .array(
        z
          .object({
            id,
            title,
            kind: z.enum(['exam', 'delivery']),
            date,
            status: z.enum(['pending', 'completed']),
            description: z.string().max(10_000),
            taskId: id.nullable(),
          })
          .strict(),
      )
      .max(500)
      .refine(uniqueIds, 'Provas ou entregas com IDs repetidos.'),
  })
  .strict()

export const studyPathSchema = z
  .object({
    ...base,
    title,
    description: z.string().max(50_000),
    status: studyStatus,
    archivedFrom: z.enum(['active', 'completed']).optional(),
    steps: z
      .array(
        z
          .object({
            id,
            title,
            done: z.boolean(),
            url: webUrl.nullable(),
            estimatedMinutes: z.number().finite().positive().nullable(),
            noteId: id.nullable(),
            taskId: id.nullable(),
          })
          .strict(),
      )
      .max(500)
      .refine(uniqueIds, 'Etapas com IDs repetidos.'),
  })
  .strict()

export const reviewSchema = z
  .object({
    repetitions: z.number().int().min(0).max(1_000_000),
    interval: z.number().int().min(0).max(36_500),
    easiness: z.number().finite().min(1.3).max(10),
    nextReview: date,
    quality: z.number().int().min(0).max(5).nullable(),
    lastReviewedAt: timestamp.nullable(),
  })
  .strict()
export const flashcardSchema = z
  .object({
    ...base,
    question: z.string().trim().min(1).max(10_000),
    answer: z.string().trim().min(1).max(50_000),
    status: z.enum(['active', 'suspended']),
    review: reviewSchema,
  })
  .strict()
export const focusSessionSchema = z
  .object({
    ...base,
    title,
    mode: z.enum(['focus', 'shortBreak', 'longBreak']),
    status: z.enum(['in-progress', 'completed', 'interrupted']),
    timerState: z.enum(['running', 'paused']),
    plannedSeconds: z.number().int().min(60).max(10_800),
    elapsedMs: z.number().int().min(0).max(10_800_000),
    segmentStartedAt: timestamp.nullable(),
    startedAt: timestamp,
    endedAt: timestamp.nullable(),
    taskId: id.nullable(),
  })
  .strict()
  .superRefine((session, context) => {
    const invalid =
      session.elapsedMs > session.plannedSeconds * 1000 ||
      (session.status === 'in-progress'
        ? session.endedAt !== null ||
          (session.timerState === 'running') !==
            (session.segmentStartedAt !== null)
        : session.endedAt === null ||
          session.segmentStartedAt !== null ||
          session.timerState !== 'paused') ||
      (session.status === 'completed' &&
        session.elapsedMs !== session.plannedSeconds * 1000) ||
      (session.endedAt !== null &&
        Date.parse(session.endedAt) < Date.parse(session.startedAt)) ||
      (session.segmentStartedAt !== null &&
        Date.parse(session.segmentStartedAt) < Date.parse(session.startedAt))
    if (invalid)
      context.addIssue({
        code: 'custom',
        message:
          'Estado do cronômetro inconsistente. Restaure um backup válido.',
      })
  })

/** Auxiliary ledger, not a new item type. Deleted sources keep their earned XP. */
export const experienceEventSchema = z
  .object({
    key: z.string().min(1).max(500),
    kind: z.enum(['task', 'habit', 'focus', 'step', 'flashcard']),
    sourceId: z.string().min(1).max(300),
    date,
    earnedAt: timestamp,
  })
  .strict()
  .refine(
    (event) =>
      event.key ===
      `${event.kind}:${event.sourceId}${event.kind === 'habit' || event.kind === 'flashcard' ? `:${event.date}` : ''}`,
    'Chave de XP inválida.',
  )
export type ExperienceEvent = z.infer<typeof experienceEventSchema>

export const schemas = {
  tasks: taskSchema,
  habits: habitSchema,
  habitLogs: habitLogSchema,
  notes: noteSchema,
  goals: goalSchema,
  projects: projectSchema,
  subjects: subjectSchema,
  studyPaths: studyPathSchema,
  flashcards: flashcardSchema,
  focusSessions: focusSessionSchema,
}
export const collections = [
  'tasks',
  'habits',
  'habitLogs',
  'notes',
  'goals',
  'projects',
  'subjects',
  'studyPaths',
  'flashcards',
  'focusSessions',
] as const
export type Collection = (typeof collections)[number]
export type Task = z.infer<typeof taskSchema>
export type Habit = z.infer<typeof habitSchema>
export type HabitLog = z.infer<typeof habitLogSchema>
export type Note = z.infer<typeof noteSchema>
export type Goal = z.infer<typeof goalSchema>
export type Project = z.infer<typeof projectSchema>
export type Subject = z.infer<typeof subjectSchema>
export type StudyPath = z.infer<typeof studyPathSchema>
export type Flashcard = z.infer<typeof flashcardSchema>
export type ReviewState = z.infer<typeof reviewSchema>
export type FocusSession = z.infer<typeof focusSessionSchema>
export interface EntityMap {
  tasks: Task
  habits: Habit
  habitLogs: HabitLog
  notes: Note
  goals: Goal
  projects: Project
  subjects: Subject
  studyPaths: StudyPath
  flashcards: Flashcard
  focusSessions: FocusSession
}
export type Entity = EntityMap[Collection]
export type Snapshot = { [K in Collection]: EntityMap[K][] } & {
  experience: ExperienceEvent[]
  profile: ProfilePreferences | null
  activity: ActivityEvent[]
}
export const emptySnapshot = (): Snapshot => ({
  experience: [],
  profile: null,
  activity: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  notes: [],
  goals: [],
  projects: [],
  subjects: [],
  studyPaths: [],
  flashcards: [],
  focusSessions: [],
})
export const snapshotSchema = z
  .object({
    profile: profileSchema.nullable().default(null),
    activity: z
      .array(activityEventSchema)
      .max(100_000)
      .default([])
      .refine(
        (events) =>
          new Set(events.map((event) => event.key)).size === events.length,
      ),
    experience: z
      .array(experienceEventSchema)
      .max(100_000)
      .default([])
      .refine(
        (events) =>
          new Set(events.map((event) => event.key)).size === events.length,
        'Eventos de XP repetidos.',
      ),
    tasks: z.array(taskSchema).max(10_000),
    habits: z.array(habitSchema).max(10_000),
    habitLogs: z.array(habitLogSchema).max(50_000),
    notes: z.array(noteSchema).max(10_000),
    goals: z.array(goalSchema).max(10_000),
    projects: z.array(projectSchema).max(10_000),
    subjects: z.array(subjectSchema).max(10_000).default([]),
    studyPaths: z.array(studyPathSchema).max(10_000).default([]),
    flashcards: z.array(flashcardSchema).max(10_000).default([]),
    focusSessions: z.array(focusSessionSchema).max(50_000).default([]),
  })
  .strict()
