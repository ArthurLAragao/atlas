import { readFile, writeFile } from 'node:fs/promises'

const css = await readFile('src/styles/tokens.css', 'utf8')
const report = process.argv.includes('--audit-9b')
  ? 'docs/contrast-9b.json'
  : 'docs/contrast-redesign-9a.json'
function values(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  )
}
const dark = values(
  css.slice(
    css.indexOf('color-scheme: dark;'),
    css.indexOf(":root[data-theme='light']"),
  ),
)
const light = values(
  css.match(/:root\[data-theme='light'\]\s*\{([^}]+)\}/)?.[1] ?? '',
)
function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
const results = []
for (const [theme, palette] of [
  ['dark', dark],
  ['light', light],
]) {
  for (const foreground of [
    'text-primary',
    'text-secondary',
    'accent',
    'success',
    'danger',
    'control-border',
  ]) {
    for (const background of ['bg', 'surface', 'surface-elevated']) {
      const first = luminance(palette[foreground]),
        second = luminance(palette[background])
      const ratio =
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      const minimum = foreground === 'control-border' ? 3 : 4.5
      results.push({
        theme,
        foreground,
        background,
        foregroundHex: palette[foreground],
        backgroundHex: palette[background],
        ratio: Number(ratio.toFixed(2)),
        minimum,
        passes: ratio >= minimum,
      })
    }
  }
}
await writeFile(
  report,
  JSON.stringify(
    {
      method:
        'WCAG relative luminance from CSS token hex values; opaque surfaces. Rendered blends and extra accents verified separately with Axe.',
      results,
    },
    null,
    2,
  ) + '\n',
)
if (results.some((item) => !item.passes))
  throw new Error('Contraste insuficiente nos tokens')
console.log(
  `${results.length} pares aprovados; menor texto: ${Math.min(...results.filter((item) => item.minimum === 4.5).map((item) => item.ratio))}:1`,
)
