import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const phase = process.argv[2]
const stage =
  process.argv.find((arg) => arg.startsWith('--stage='))?.slice(8) ?? '9b'
if (!['9b', '9c'].includes(stage))
  throw new Error('Use --stage=9b ou --stage=9c.')
if (!['baseline', 'final'].includes(phase))
  throw new Error('Use baseline ou final.')
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const result = { phase, scenarios: {}, assets: [] }
for (const scenario of ['cold', 'return']) {
  const runs = []
  for (let run = 1; run <= 3; run++) {
    const file = `docs/lighthouse-${stage}-${phase}-${scenario}-${run}.report.json`
    const report = JSON.parse(await readFile(file, 'utf8'))
    const metric = (id) => report.audits[id].numericValue
    runs.push({
      file,
      fetchTime: report.fetchTime,
      lighthouseVersion: report.lighthouseVersion,
      userAgent: report.environment.hostUserAgent,
      config: report.configSettings,
      performance: Math.round(report.categories.performance.score * 100),
      accessibility: Math.round(report.categories.accessibility.score * 100),
      fcp: metric('first-contentful-paint'),
      lcp: metric('largest-contentful-paint'),
      tbt: metric('total-blocking-time'),
      cls: metric('cumulative-layout-shift'),
      transferred: metric('total-byte-weight'),
      warnings: report.runWarnings,
      requests: report.audits['network-requests'].details.items.length,
      javascriptTime: metric('bootup-time'),
      mainThreadTime: metric('mainthread-work-breakdown'),
    })
  }
  result.scenarios[scenario] = {
    runs,
    median: Object.fromEntries(
      [
        'performance',
        'accessibility',
        'fcp',
        'lcp',
        'tbt',
        'cls',
        'transferred',
        'requests',
        'javascriptTime',
        'mainThreadTime',
      ].map((key) => [key, median(runs.map((run) => run[key]))]),
    ),
  }
}
for (const name of await readdir('dist/assets')) {
  const file = `dist/assets/${name}`
  result.assets.push({
    name,
    bytes: (await stat(file)).size,
    gzipBytes: gzipSync(await readFile(file)).length,
  })
}
result.assets.sort((a, b) => b.bytes - a.bytes)
result.assetBytes = result.assets.reduce((sum, asset) => sum + asset.bytes, 0)
await writeFile(
  `docs/performance-${stage}-${phase}.json`,
  JSON.stringify(result, null, 2) + '\n',
)
console.log(
  JSON.stringify(
    {
      phase,
      cold: result.scenarios.cold.median,
      return: result.scenarios.return.median,
      assetBytes: result.assetBytes,
    },
    null,
    2,
  ),
)
