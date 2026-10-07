import Dexie from 'dexie'

export function createDatabase(name = 'atlas-local'): Dexie {
  const database = new Dexie(name)
  database.version(1).stores({
    tasks: 'id, status, dueDate, context, *tags, updatedAt',
    habits: 'id, *tags, updatedAt',
    habitLogs: 'id, habitId, date, &[habitId+date], updatedAt',
    notes: 'id, title, *tags, updatedAt',
    goals: 'id, deadline, *tags, updatedAt',
    projects: 'id, *tags, updatedAt',
    meta: 'key',
  })
  database.version(2).stores({
    subjects: 'id, status, *tags, updatedAt',
    studyPaths: 'id, status, *tags, updatedAt',
  })
  database.version(3).stores({
    flashcards: 'id, status, review.nextReview, *tags, updatedAt',
    focusSessions: 'id, status, taskId, startedAt, updatedAt',
  })
  return database
}
