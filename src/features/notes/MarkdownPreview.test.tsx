import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { buildSeed } from '../../data/seed'
import { MarkdownPreview } from './MarkdownPreview'

function preview(content: string) {
  const notes = buildSeed().notes
  return render(
    <MemoryRouter>
      <MarkdownPreview content={content} notes={notes} />
    </MemoryRouter>,
  )
}

it('renderiza Markdown sem executar HTML, links inseguros ou carregar imagens', () => {
  const { container } = preview(
    '# Aula\n\n<script>alert(1)</script>\n\n[Perigo](javascript:alert%281%29)\n\n![Diagrama](https://example.com/diagrama.png)\n\n[Documentação](https://example.com/docs)',
  )
  expect(screen.getByRole('heading', { name: 'Aula', level: 2 })).toBeVisible()
  expect(container.querySelector('script, img')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Perigo' })).toBeNull()
  expect(screen.getByText(/Imagem: Diagrama/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Documentação' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
})

it('converte wikilinks em navegação interna e mantém código literal', () => {
  const target = buildSeed().notes[0]!
  preview(`[[${target.title}]] e [[Nota futura]]\n\n\`[[literal]]\``)
  expect(screen.getByRole('link', { name: target.title })).toHaveAttribute(
    'href',
    `/notas?note=${target.id}`,
  )
  expect(screen.getByRole('link', { name: 'Nota futura' })).toHaveAttribute(
    'href',
    '/notas?search=Nota%20futura',
  )
  expect(screen.getByText('[[literal]]').tagName).toBe('CODE')
})

it('oferece tabela rolável por teclado e estado vazio com próximo passo', () => {
  const { rerender } = preview(
    '| Tema | Estado |\n| --- | --- |\n| AWS | Revisar |',
  )
  expect(
    screen.getByRole('region', { name: 'Tabela da nota' }),
  ).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('table')).toBeVisible()
  rerender(
    <MemoryRouter>
      <MarkdownPreview content="" notes={[]} />
    </MemoryRouter>,
  )
  expect(screen.getByText(/Volte a Editar para começar/)).toBeVisible()
})

it('dá nomes acessíveis aos estados das listas Markdown', () => {
  preview('- [x] Ler\n- [ ] Aplicar')
  expect(screen.getByRole('checkbox', { name: 'Ler: concluído' })).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Aplicar: pendente' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Ler: concluído' }),
  ).toBeDisabled()
})
