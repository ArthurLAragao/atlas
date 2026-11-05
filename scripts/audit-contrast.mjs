import { readFile, writeFile } from 'node:fs/promises'
const css = await readFile(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
)
function variables(selector) {
  const start = css.indexOf(selector + ' {'),
    end = css.indexOf('}', start)
  if (start < 0) return {}
  return Object.fromEntries(
    [
      ...css.slice(start, end).matchAll(/--([\w-]+):\s*(#[a-f\d]{6})\s*;/gi),
    ].map((match) => [match[1], match[2]]),
  )
}
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((position) => parseInt(hex.slice(position, position + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
const stage = process.argv.includes('--stage9a') ? 'stage9a' : 'stage8'
const checks = []
for (const theme of ['dark', 'light'])
  for (const accent of ['blue', 'neutral', 'green']) {
    const tokens = {
      ...variables(':root'),
      ...(theme === 'light' ? variables(":root[data-theme='light']") : {}),
      ...(accent !== 'blue' ? variables(`:root[data-accent='${accent}']`) : {}),
      ...(theme === 'light' && accent !== 'blue'
        ? variables(`:root[data-theme='light'][data-accent='${accent}']`)
        : {}),
    }
    for (const background of ['bg', 'surface', 'surface-elevated'])
      for (const role of [
        'text-primary',
        'text-secondary',
        'accent',
        'danger',
        'control-border',
      ]) {
        const foreground = tokens[role],
          fill = tokens[background]
        const a = luminance(foreground),
          b = luminance(fill)
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          minimum = role === 'control-border' ? 3 : 4.5
        checks.push({
          theme,
          accent,
          role,
          background,
          foreground,
          fill,
          ratio: Number(ratio.toFixed(2)),
          minimum,
          pass: ratio >= minimum,
        })
      }
  }
await writeFile(
  new URL(`../docs/contrast-${stage}.json`, import.meta.url),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      source: 'src/styles/tokens.css',
      method: 'WCAG 2 contrast, sRGB relative luminance',
      checks,
    },
    null,
    2,
  ),
)
console.log(
  `${checks.length} pares; mínimo texto ${Math.min(...checks.filter((check) => check.minimum === 4.5).map((check) => check.ratio))}:1; mínimo controles ${Math.min(...checks.filter((check) => check.minimum === 3).map((check) => check.ratio))}:1`,
)
if (checks.some((check) => !check.pass))
  throw new Error(`Contraste insuficiente; confira docs/contrast-${stage}.json`)
