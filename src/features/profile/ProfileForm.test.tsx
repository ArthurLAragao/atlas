import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileForm } from './ProfileForm'
import { defaultProfile } from '../../data/profile-models'
import { repository } from '../../data/service'
import { emptySnapshot } from '../../data/models'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('processamento assíncrono do avatar preserva os campos digitados enquanto a imagem abre', async () => {
  let resolveBitmap!: (bitmap: ImageBitmap) => void
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveBitmap = resolve
        }),
    ),
  )
  const closeBitmap = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/webp;base64,AAAA',
  )
  const save = vi
    .spyOn(repository, 'saveProfile')
    .mockResolvedValue(emptySnapshot())
  const original = defaultProfile()
  const onClose = vi.fn()
  render(<ProfileForm profile={original} onClose={onClose} />)
  expect(screen.getByLabelText('Identificador opcional')).toHaveAttribute(
    'placeholder',
    '@exemplo',
  )
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Imagem local opcional'),
    new File(['local'], 'avatar.png', { type: 'image/png' }),
  )
  await user.clear(screen.getByLabelText('Nome de exibição'))
  await user.type(screen.getByLabelText('Nome de exibição'), 'Nome mantido')
  await act(async () =>
    resolveBitmap({
      width: 100,
      height: 100,
      close: closeBitmap,
    } as unknown as ImageBitmap),
  )
  expect(screen.getByLabelText('Nome de exibição')).toHaveValue('Nome mantido')
  await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      name: 'Nome mantido',
      avatar: 'data:image/webp;base64,AAAA',
    }),
    original,
  )
  expect(closeBitmap).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
})
