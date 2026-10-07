import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

it('foca o título ao abrir uma rota sem interação em andamento', () => {
  render(
    <PageHeader title="Hoje" eyebrow="Seu espaço">
      Um dia de cada vez.
    </PageHeader>,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  expect(document.title).toBe('Hoje · Atlas')
})

it('não fecha um diálogo aberto enquanto a rota termina de carregar', () => {
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  const field = document.createElement('input')
  dialog.append(field)
  document.body.append(dialog)
  field.focus()
  render(
    <PageHeader title="Hoje" eyebrow="Seu espaço">
      Um dia de cada vez.
    </PageHeader>,
  )
  expect(field).toHaveFocus()
  dialog.remove()
})

it('preserva foco em captura do cabeçalho durante carregamento tardio', () => {
  const toolbar = document.createElement('header')
  toolbar.className = 'toolbar'
  const field = document.createElement('input')
  toolbar.append(field)
  document.body.append(toolbar)
  field.focus()
  render(
    <PageHeader title="Notas" eyebrow="Seu espaço">
      Anote uma ideia.
    </PageHeader>,
  )
  expect(field).toHaveFocus()
  toolbar.remove()
})
