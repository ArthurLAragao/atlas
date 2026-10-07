import type Dexie from 'dexie'
import { z } from 'zod'
import { experienceEventSchema } from '../models'
import { experienceEvent, type ExperienceKind } from '../../lib/experience'
export async function readExperience(database: Dexie) {
  const entry: { value: unknown } | undefined = await database
    .table('meta')
    .get('experience')
  return z.array(experienceEventSchema).parse(entry?.value ?? [])
}
/** Called inside the same rw transaction as the action. Key deduplication survives refresh and undo. */
export async function awardExperience(
  database: Dexie,
  kind: ExperienceKind,
  sourceId: string,
  date: string,
) {
  const events = await readExperience(database)
  const event = experienceEvent(kind, sourceId, date, new Date().toISOString())
  if (!events.some((existing) => existing.key === event.key)) {
    events.push(event)
    await database.table('meta').put({ key: 'experience', value: events })
  }
  return events
}
