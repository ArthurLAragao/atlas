import { expect, it } from 'vitest'
import { lumenTestSession } from './lumen-test-environment'
it('requires explicit dev session and exact dedicated origin', () => {
  expect(lumenTestSession(undefined, false, 'atlas.example')).toBeNull()
  expect(lumenTestSession('fictional-1', true, '127.0.0.1:4189')).toBe(
    'fictional-1',
  )
  for (const [development, host, session] of [
    [false, '127.0.0.1:4189', 'a'],
    [true, 'localhost:4189', 'a'],
    [true, '127.0.0.1:4180', 'a'],
    [true, '127.0.0.1:4189', '../personal'],
  ] as const)
    expect(() => lumenTestSession(session, development, host)).toThrow()
})
