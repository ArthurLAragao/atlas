/** A recoverable stale editor; no transaction was committed. */
export class RepositoryConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepositoryConflictError'
  }
}
