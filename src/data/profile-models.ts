import { z } from 'zod'

export const pinnedItemSchema = z
  .object({
    type: z.enum(['projects', 'goals', 'studyPaths']),
    id: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict()
export const profileSchema = z
  .object({
    name: z.string().trim().max(100),
    handle: z
      .string()
      .trim()
      .max(40)
      .regex(/^@?[\p{L}\p{N}_-]*$/u),
    bio: z.string().trim().max(180),
    avatarStyle: z.enum(['neutral', 'soft', 'contrast']),
    avatar: z
      .string()
      .max(350_000)
      .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
      .nullable(),
    pinned: z
      .array(pinnedItemSchema)
      .max(3)
      .refine(
        (items) =>
          new Set(items.map((item) => `${item.type}:${item.id}`)).size ===
          items.length,
      ),
  })
  .strict()
export const activityEventSchema = z
  .object({
    key: z.string().min(1).max(500),
    kind: z.enum(['task', 'habit', 'focus', 'flashcard', 'step']),
    sourceId: z.string().min(1).max(300),
    title: z.string().max(240),
    date: z.iso.date().refine((value) => !value.startsWith('0000-')),
    at: z.iso.datetime({ offset: true }),
    value: z.number().finite().min(0),
  })
  .strict()
  .refine(
    (e) =>
      e.key ===
      `${e.kind}:${e.sourceId}${['habit', 'flashcard'].includes(e.kind) ? `:${e.date}` : ''}`,
  )
export type ProfilePreferences = z.infer<typeof profileSchema>
export type PinnedItem = z.infer<typeof pinnedItemSchema>
export type ActivityEvent = z.infer<typeof activityEventSchema>
export const defaultProfile = (): ProfilePreferences => ({
  name: '',
  handle: '',
  bio: '',
  avatarStyle: 'neutral',
  avatar: null,
  pinned: [],
})
