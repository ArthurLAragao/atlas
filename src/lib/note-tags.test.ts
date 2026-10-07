import { expect, it } from 'vitest'
import { readNoteTags } from './note-tags'
it('preserva tags importadas com vírgulas ou # quando o campo não muda', () => {
  const tags = ['cloud, aws', '#literal']
  expect(readNoteTags(tags.join(', '), tags)).toEqual(tags)
  expect(readNoteTags(tags.join(', '), tags)).not.toBe(tags)
})
it('separa e deduplica tags somente quando o campo é editado', () => {
  expect(readNoteTags(' #cloud, faculdade, cloud, ', [])).toEqual([
    'cloud',
    'faculdade',
  ])
  expect(readNoteTags('', ['cloud'])).toEqual([])
})
