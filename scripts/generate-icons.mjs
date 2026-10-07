import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
const source = await readFile(
  new URL('../public/icons/atlas.svg', import.meta.url),
  'utf8',
)
const tokens = await readFile(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
)
const background = tokens.match(/--brand-surface:\s*(#[\da-f]{6});/i)?.[1]
if (!background) throw new Error('Token --brand-surface ausente ou inválido')
// Keep the supplied artwork and its provenance metadata intact. Installation
// icons use an opaque, unmasked canvas; the launcher applies its own shape.
const opaque = source.replace(
  '</defs>',
  `</defs><rect width="256" height="256" fill="${background}"/>`,
)
await writeFile(new URL('../public/favicon.svg', import.meta.url), opaque)
for (const size of [180, 192, 512])
  await sharp(Buffer.from(opaque))
    .resize(size, size)
    .png()
    .toFile(
      fileURLToPath(
        new URL(`../public/icons/atlas-${size}.png`, import.meta.url),
      ),
    )
// The artwork's outer radius is 108.5/256 of its source canvas. At 448 px,
// it fits within the mandatory 204.8 px mask-safe radius of the 512 px canvas.
const maskableMark = await sharp(Buffer.from(source))
  .resize(448, 448)
  .png()
  .toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background },
})
  .composite([{ input: maskableMark, gravity: 'centre' }])
  .png()
  .toFile(
    fileURLToPath(
      new URL('../public/icons/atlas-maskable-512.png', import.meta.url),
    ),
  )
