import sharp from 'sharp'

const routes = [
  'hoje',
  'tarefas-lista',
  'tarefas-kanban',
  'tarefas-tabela',
  'tarefas-calendario',
  'habitos',
  'notas',
  'metas',
  'estudos',
  'foco',
  'perfil',
  'preferencias',
]
const images = await Promise.all(
  routes.map(async (route, index) => ({
    input: await sharp(
      `docs/screenshots/redesign-9a-after-${route}-1280-dark.png`,
    )
      .resize({ width: 400, height: 312, fit: 'cover', position: 'top' })
      .toBuffer(),
    left: (index % 3) * 400,
    top: Math.floor(index / 3) * 312,
  })),
)
await sharp({
  create: { width: 1200, height: 1248, channels: 3, background: '#101010' },
})
  .composite(images)
  .png()
  .toFile('docs/screenshots/redesign-9a-after-overview.png')
const mobile = await Promise.all(
  ['hoje', 'tarefas-kanban', 'notas', 'perfil'].map(async (route, index) => ({
    input: await sharp(
      `docs/screenshots/redesign-9a-after-${route}-375-dark.png`,
    )
      .resize({ width: 250, height: 620, fit: 'cover', position: 'top' })
      .toBuffer(),
    left: index * 250,
    top: 0,
  })),
)
await sharp({
  create: { width: 1000, height: 620, channels: 3, background: '#101010' },
})
  .composite(mobile)
  .png()
  .toFile('docs/screenshots/redesign-9a-after-mobile-overview.png')
