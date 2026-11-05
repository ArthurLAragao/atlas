import { build } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const phase = process.argv[2]
if (!/^(baseline|parser-probe|final)$/.test(phase ?? ''))
  throw new Error('Use baseline, parser-probe ou final.')

let captured = []
// Diagnostic build plugin: records actual chunk modules without emitting app assets.
await build({
  plugins: [
    {
      name: 'atlas-9c-bundle-evidence',
      writeBundle(_options, bundle) {
        const chunks = Object.values(bundle).filter(
          (asset) => asset.type === 'chunk',
        )
        captured = chunks.map((chunk) => ({
          file: chunk.fileName,
          entry: chunk.isEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: Object.keys(chunk.modules).map((id) =>
            id.replaceAll('\\', '/'),
          ),
        }))
      },
    },
  ],
})
const chunks = await Promise.all(
  captured.map(async (chunk) => {
    const output = await readFile(`dist/${chunk.file}`)
    return {
      ...chunk,
      bytes: output.length,
      gzipBytes: gzipSync(output).length,
    }
  }),
)
await writeFile(
  `docs/bundle-9c-${phase}.json`,
  JSON.stringify({ phase, chunks }, null, 2) + '\n',
)
