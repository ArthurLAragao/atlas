import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LumenTransferDialog from './LumenTransferDialog'
import { LumenTransferSession } from './lumen-session'
import { createDatabase } from '../../data/database'
import { DexieAtlasRepository } from '../../data/repositories/dexie-repository'
import { LumenAtlasRepository } from '../../data/repositories/lumen-atlas-repository'
import {
  changedPackage,
  setupCrypto,
} from '../../lib/lumen-atlas/test-fixtures'
import { readLumenDraftStatus, useDrafts } from './draft-store'
import { decodeLumenPackage } from '../../lib/lumen-atlas/package'
const db = createDatabase('lumen-component-' + Math.random())
const repo = new DexieAtlasRepository(db)
const transfer = new LumenAtlasRepository(db, readLumenDraftStatus)
let session: LumenTransferSession
const selected = (bytes: Uint8Array) => ({
  name: 'ficticio.lumen-atlas.json',
  size: bytes.length,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
})
beforeEach(async () => {
  setupCrypto()
  localStorage.clear()
  useDrafts.setState({ drafts: {}, error: false })
  await db.open()
  for (const table of db.tables) await table.clear()
  session = new LumenTransferSession(transfer, repo)
})
afterEach(async () => {
  await db.close()
  vi.unstubAllGlobals()
  localStorage.clear()
})
it('shows full inert YAML, warnings, exact operation and explicit keyboard-focused confirmation', async () => {
  render(
    <LumenTransferDialog mode="import" onClose={vi.fn()} session={session} />,
  )
  await act(async () => {
    await session.select(
      selected(
        await changedPackage({
          text: '<img src="https://example.invalid/x">\n<script>throw Error("INERT")</script>',
        }),
      ),
    )
  })
  const preview = screen.getByLabelText('Markdown proposto (inclui YAML)')
  expect(preview).toHaveAttribute('readonly')
  expect((preview as HTMLTextAreaElement).value).toContain('status: "reviewed"')
  expect(document.querySelector('img')).toBeNull()
  expect(screen.getByRole('region', { name: 'Avisos' })).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar importação' }),
  )
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  expect(await db.table('notes').count()).toBe(0)
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirmar importação' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Nota criada'),
  )
  expect(await db.table('notes').count()).toBe(1)
})
it('Cancel preserves DB and displays a distinct cancellation outcome', async () => {
  const close = vi.fn()
  render(
    <LumenTransferDialog mode="import" onClose={close} session={session} />,
  )
  await act(async () => {
    await session.select(selected(await changedPackage()))
  })
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await db.table('notes').count()).toBe(0)
  expect(session.getSnapshot().message).toContain('cancelada')
})
it('shows conflicts without enabling confirmation or rendering force controls', async () => {
  useDrafts.setState({ error: true })
  render(
    <LumenTransferDialog mode="import" onClose={vi.fn()} session={session} />,
  )
  await act(async () => {
    await session.select(selected(await changedPackage()))
  })
  expect(
    screen.getByRole('region', { name: 'Conflitos bloqueantes' }),
  ).toHaveTextContent('rascunhos')
  expect(
    screen.queryByRole('button', { name: 'Revisar importação' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /forçar|substituir/i }),
  ).not.toBeInTheDocument()
})
it('invalidates confirmation on external draft-storage events', async () => {
  render(
    <LumenTransferDialog mode="import" onClose={vi.fn()} session={session} />,
  )
  await act(async () => {
    await session.select(selected(await changedPackage()))
  })
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar importação' }),
  )
  fireEvent(
    window,
    new StorageEvent('storage', { key: 'atlas.note-drafts.v1' }),
  )
  expect(
    screen.queryByRole('button', { name: 'Confirmar importação' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('obsoleta')
})
it('lists operations, previews old/current text, confirms protected restoration', async () => {
  const first = await changedPackage()
  await session.select(selected(first))
  session.review()
  await session.confirm()
  const pkg = await decodeLumenPackage(first)
  await session.select(
    selected(
      await changedPackage({
        text: 'Second fictional version',
        baseline: pkg.comparison_sha256,
      }),
    ),
  )
  session.review()
  await session.confirm()
  render(
    <LumenTransferDialog mode="history" onClose={vi.fn()} session={session} />,
  )
  const buttons = await screen.findAllByRole('button', {
    name: 'Ver versão recuperável',
  })
  expect(buttons[0]).toBeDisabled()
  await userEvent.click(buttons[1]!)
  expect(
    ((await screen.findByLabelText('Markdown atual')) as HTMLTextAreaElement)
      .value,
  ).toContain('Second fictional')
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar restauração' }),
  )
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirmar restauração' }),
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Versão anterior restaurada',
    ),
  )
})
