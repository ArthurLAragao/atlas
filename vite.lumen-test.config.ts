import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

/** Do not discover environment files in the project root in fictional tests. */
export default defineConfig(({ command }) => {
  if (
    command === 'serve' &&
    !/^[a-z0-9-]{1,48}$/u.test(process.env.VITE_LUMEN_TEST_SESSION ?? '')
  )
    throw new Error(
      'Defina uma VITE_LUMEN_TEST_SESSION fictícia antes de abrir este ambiente.',
    )
  return mergeConfig(base, {
    envDir: './local-private/lumen-test-env-unused',
    server: { host: '127.0.0.1', port: 4189, strictPort: true },
  })
})
