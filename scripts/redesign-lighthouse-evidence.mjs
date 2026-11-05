import { readFile, writeFile } from 'node:fs/promises'

const scenarios = [
  ['stage8-cold', 'lighthouse-stage8.report.json'],
  ['before-cold', 'lighthouse-stage9a.report.json'],
  ['after-cold', 'lighthouse-redesign-9a.report.json'],
  ['after-return', 'lighthouse-redesign-9a-return.report.json'],
]
const results = []
for (const [scenario, filename] of scenarios) {
  const report = JSON.parse(await readFile(`docs/${filename}`, 'utf8'))
  const requests = report.audits['network-requests'].details.items
  results.push({
    scenario,
    filename,
    scores: Object.fromEntries(
      Object.entries(report.categories).map(([name, category]) => [
        name,
        Math.round(category.score * 100),
      ]),
    ),
    metrics: Object.fromEntries(
      [
        'first-contentful-paint',
        'largest-contentful-paint',
        'speed-index',
        'total-blocking-time',
        'cumulative-layout-shift',
      ].map((key) => [key, report.audits[key].numericValue]),
    ),
    requests: requests.length,
    transferBytes: requests.reduce(
      (sum, request) => sum + (request.transferSize || 0),
      0,
    ),
    warnings: report.runWarnings,
  })
  if (scenario.startsWith('after-')) {
    const image = report.audits['final-screenshot'].details.data.split(',')[1]
    await writeFile(
      `docs/screenshots/redesign-9a-lighthouse-${scenario}.png`,
      Buffer.from(image, 'base64'),
    )
  }
}
await writeFile(
  'docs/lighthouse-comparison-redesign-9a.json',
  JSON.stringify(results, null, 2) + '\n',
)
console.log(JSON.stringify(results, null, 2))
