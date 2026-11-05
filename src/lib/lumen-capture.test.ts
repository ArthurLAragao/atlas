import { expect, it } from 'vitest'
import { captureReference, decodeCapture } from './lumen-capture'

const capture = { id: 'a'.repeat(32), title: 'Vídeo de teste', state: 'ready', message: 'Pronto',
  exercise: 'Implemente uma fila.', publication: 'published', notion_url: 'https://app.notion.com/p/' + 'b'.repeat(32) }

it('preserva a sugestão e a referência sem declarar estudo concluído', () => {
  const item = decodeCapture(capture)!
  const note = captureReference(item)
  expect(note.id).toBe('lumen-capture-' + capture.id)
  expect(note.content).toContain(capture.notion_url)
  expect(note.content).toContain('Implemente uma fila.')
  expect(note.content).toContain('Não representa estudo concluído')
})

it('rejeita registros inválidos e links externos não autorizados', () => {
  expect(decodeCapture({ ...capture, id: '../../arquivo' })).toBeNull()
  expect(decodeCapture({ ...capture, state: 'inventado' })).toBeNull()
  for (const url of ['javascript:alert(1)', 'file:///secret', 'https://app.notion.com.evil.test/p/x', 'https://user@app.notion.com/p/x']) {
    expect(decodeCapture({ ...capture, notion_url: url })?.notionUrl).toBeNull()
  }
  expect(decodeCapture({ ...capture, publication: 'uncertain' })?.notionUrl).toBeNull()
})
