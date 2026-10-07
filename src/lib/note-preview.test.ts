import { describe, expect, it } from 'vitest'
import { notePreviewExcerpt, previewPosition } from './note-preview'
describe('prévia contextual', () => {
  it('posiciona próximo ao cursor com respiro', () =>
    expect(previewPosition(10, 20, 350, 300, 1280, 800)).toEqual({
      x: 30,
      y: 40,
    }))
  it('inverte perto das bordas', () =>
    expect(previewPosition(1200, 750, 350, 300, 1280, 800)).toEqual({
      x: 830,
      y: 430,
    }))
  it('mantém o recorte dentro da viewport', () =>
    expect(previewPosition(20, 20, 343, 350, 375, 667)).toEqual({
      x: 16,
      y: 40,
    }))
  it('limita textos longos sem alterar a nota', () => {
    const text = 'a'.repeat(10000)
    expect(notePreviewExcerpt(text)).toHaveLength(1200)
    expect(text).toHaveLength(10000)
  })
  it('remove metadados do recorte e preserva wikilinks', () =>
    expect(
      notePreviewExcerpt('---\ntitle: Aula\n---\n\n# Aula\n[[Outra nota]]'),
    ).toBe('# Aula\n[[Outra nota]]'))
})
