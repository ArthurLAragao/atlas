/** Explicit opt-in, dedicated localhost origin; never selects an existing personal DB. */
export function lumenTestSession(
  value: unknown,
  development: boolean,
  host: string,
): string | null {
  if (value === undefined || value === '') return null
  if (
    !development ||
    host !== '127.0.0.1:4189' ||
    typeof value !== 'string' ||
    !/^[a-z0-9-]{1,48}$/u.test(value)
  )
    throw new Error(
      'Ambiente de teste Lumen inválido. Use 127.0.0.1:4189 com uma sessão explícita.',
    )
  return value
}
export const activeLumenTestSession = lumenTestSession(
  import.meta.env.VITE_LUMEN_TEST_SESSION,
  import.meta.env.DEV,
  typeof location === 'undefined' ? '' : location.host,
)
