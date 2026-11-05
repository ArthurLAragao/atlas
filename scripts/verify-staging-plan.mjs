import { strict as assert } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'

const config = JSON.parse(
  await readFile('docs/staging-vercel.example.json', 'utf8'),
)
const rewrite = new RegExp(`^${config.rewrites[0].source}$`)
const navigations = [
  '/',
  '/tarefas',
  '/habitos',
  '/notas',
  '/metas',
  '/estudos',
  '/foco',
  '/perfil',
  '/preferencias',
  '/rota-inexistente',
]
const resources = [
  '/assets',
  '/assets/inexistente.js',
  '/icons',
  '/icons/inexistente.png',
  '/sw.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/third-party-notices.txt',
  '/arquivo.js',
]
const results = [
  ...navigations.map((path) => ({ path, expected: true })),
  ...resources.map((path) => ({ path, expected: false })),
].map((item) => {
  const matches = rewrite.test(item.path)
  assert.equal(matches, item.expected, item.path)
  return { ...item, matches }
})
const notice = await readFile('public/third-party-notices.txt', 'utf8')
assert.equal(await readFile('dist/third-party-notices.txt', 'utf8'), notice)
assert(notice.includes('Copyright (c) 2026 Saurabh Chauhan'))
await writeFile(
  'docs/staging-plan-check-pre10b.json',
  JSON.stringify(
    {
      localOnly: true,
      hostedVercelValidated: false,
      scope:
        'Regex ECMAScript proposta e cópia do aviso em dist; não testa matcher/headers/404 da Vercel.',
      results,
      thirdPartyNoticeCopiedToDist: true,
    },
    null,
    2,
  ) + '\n',
)
console.log(
  `${results.length} casos locais de regra; aviso presente em dist. Nenhum deploy.`,
)
