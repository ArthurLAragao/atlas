import { z } from 'zod'
export const weekdayNames = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

const date = z.iso.date().refine((value) => !value.startsWith('0000-'))
const text = z.string().trim().min(1).max(240)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const weekday = z.number().int().min(0).max(6)
export const scheduleDaySchema = z
  .object({
    weekday,
    label: text.optional(),
    time: time.nullable(),
    dayOffset: z.number().int().min(0).max(1),
    order: z.number().int().min(0).max(10_000),
    optional: z.boolean(),
  })
  .strict()
export const scheduleSchema = z
  .object({
    mode: z.enum(['daily', 'weekdays', 'flexible']),
    timesPerWeek: z.number().int().min(1).max(7),
    days: z.array(scheduleDaySchema).max(7),
  })
  .strict()
  .refine(
    (s) => new Set(s.days.map((d) => d.weekday)).size === s.days.length,
    'Dias repetidos na programação.',
  )
  .refine(
    (s) => s.mode !== 'weekdays' || s.days.length > 0,
    'Escolha ao menos um dia fixo.',
  )
export const scheduleVersionSchema = z
  .object({
    effectiveFrom: date,
    schedule: scheduleSchema,
    target: z.number().positive().finite(),
    unit: z.string().trim().min(1).max(40),
  })
  .strict()
export const scheduleVersionsSchema = z
  .array(scheduleVersionSchema)
  .min(1)
  .max(1000)
  .refine(
    (versions) =>
      versions.every(
        (v, i) => i === 0 || v.effectiveFrom > versions[i - 1]!.effectiveFrom,
      ),
    'Versões devem estar em ordem de vigência, sem datas repetidas.',
  )

const block = z
  .object({
    title: text,
    start: time.nullable(),
    end: time.nullable(),
    dayOffset: z.number().int().min(0).max(1),
    optional: z.boolean(),
  })
  .strict()
export const routineDaySchema = z
  .object({
    weekday,
    type: text,
    focus: z.string().trim().min(1).max(1000),
    classes: z
      .array(
        z
          .object({ title: text, start: time, end: time })
          .strict()
          .refine(
            (c) => c.start < c.end,
            'O fim da aula deve ser depois do início.',
          ),
      )
      .max(10),
    planning: z.array(block).max(30),
  })
  .strict()
const days = z
  .array(routineDaySchema)
  .length(7)
  .refine(
    (d) => new Set(d.map((v) => v.weekday)).size === 7,
    'Informe os sete dias, uma vez cada.',
  )
export const weeklyRoutineSchema = z
  .object({
    updatedAt: z.iso.datetime({ offset: true }),
    versions: z
      .array(z.object({ effectiveFrom: date, days }).strict())
      .min(1)
      .max(1000)
      .refine((v) =>
        v.every((d, i) => i === 0 || d.effectiveFrom > v[i - 1]!.effectiveFrom),
      ),
  })
  .strict()
export const routineConfigSchema = z
  .object({
    format: z.literal('atlas-weekly-routine'),
    schemaVersion: z.literal(1),
    days,
    habits: z
      .array(
        z
          .object({
            key: z
              .string()
              .regex(/^[a-zA-Z0-9_-]+$/)
              .max(120),
            title: text,
            kind: z.enum(['binary', 'quantity']),
            target: z.number().positive().finite(),
            unit: z.string().trim().min(1).max(40),
            schedule: scheduleSchema,
          })
          .strict()
          .refine((h) => h.kind !== 'binary' || h.target === 1),
      )
      .min(1)
      .max(100)
      .refine((h) => new Set(h.map((v) => v.key)).size === h.length),
  })
  .strict()
export type HabitSchedule = z.infer<typeof scheduleSchema>
export type ScheduleDay = z.infer<typeof scheduleDaySchema>
export type ScheduleVersion = z.infer<typeof scheduleVersionSchema>
export type WeeklyRoutine = z.infer<typeof weeklyRoutineSchema>
export type RoutineConfig = z.infer<typeof routineConfigSchema>
export interface RoutineMapping {
  key: string
  habitId: string | null // null creates a new habit; no fuzzy merge
  expectedUpdatedAt: string | null
}
