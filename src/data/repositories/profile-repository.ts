import type Dexie from 'dexie'
import { z } from 'zod'
import {
  activityEventSchema,
  profileSchema,
  type ActivityEvent,
} from '../profile-models'
export async function readProfileData(database: Dexie) {
  const profile: { value: unknown } | undefined = await database
    .table('meta')
    .get('profile')
  const activity: { value: unknown } | undefined = await database
    .table('meta')
    .get('activity')
  return {
    profile: profile?.value ? profileSchema.parse(profile.value) : null,
    activity: z.array(activityEventSchema).parse(activity?.value ?? []),
  }
}
/** Same content transaction; no effect triggered by rendering, hydration or import. */
export async function recordActivity(
  database: Dexie,
  kind: ActivityEvent['kind'],
  sourceId: string,
  title: string,
  date: string,
  value = 1,
) {
  const { activity } = await readProfileData(database)
  const key = `${kind}:${sourceId}${['habit', 'flashcard'].includes(kind) ? `:${date}` : ''}`
  if (activity.some((event) => event.key === key)) return activity
  const event = activityEventSchema.parse({
    key,
    kind,
    sourceId,
    title: title.slice(0, 240),
    date,
    value,
    at: new Date().toISOString(),
  })
  const next = [...activity, event]
  if (next.length > 100_000)
    throw new Error(
      'O histórico atingiu seu limite. Exporte um backup antes de continuar.',
    )
  await database.table('meta').put({ key: 'activity', value: next })
  return next
}
