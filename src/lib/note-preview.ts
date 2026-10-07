export function previewPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = 20,
  gutter = 16,
) {
  const left =
    x + gap + width > viewportWidth - gutter ? x - gap - width : x + gap
  const top =
    y + gap + height > viewportHeight - gutter ? y - gap - height : y + gap
  return {
    x: Math.max(gutter, Math.min(left, viewportWidth - width - gutter)),
    y: Math.max(gutter, Math.min(top, viewportHeight - height - gutter)),
  }
}
export function notePreviewExcerpt(content: string, limit = 1200): string {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '')
    .trim()
    .slice(0, limit)
}
