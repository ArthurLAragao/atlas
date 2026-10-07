/** Keep imported tags exact unless the user edits the comma-separated field. */
export function readNoteTags(
  text: string,
  original: readonly string[],
): string[] {
  if (text === original.join(', ')) return [...original]
  return [
    ...new Set(
      text
        .split(',')
        .map((tag) => tag.trim().replace(/^#/u, ''))
        .filter(Boolean),
    ),
  ]
}
