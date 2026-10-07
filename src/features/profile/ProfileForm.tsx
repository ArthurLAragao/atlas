import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import '../../styles/notes.css'
import { repository } from '../../data/service'
import { useData, dataError } from '../../app/data-store'
import {
  profileSchema,
  type ProfilePreferences,
} from '../../data/profile-models'

async function localAvatar(file: File): Promise<string> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error('Escolha PNG, JPEG ou WebP de até 2 MB.')
  const image = await createImageBitmap(file)
  try {
    if (image.width * image.height > 24_000_000)
      throw new Error(
        'A imagem é grande demais. Reduza para até 24 megapixels.',
      )
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error(
        'Não foi possível preparar a imagem. Tente outra ou use iniciais.',
      )
    const side = Math.min(image.width, image.height)
    context.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    )
    const result = canvas.toDataURL('image/webp', 0.8)
    if (result.length > 350_000)
      throw new Error('Reduza a imagem e tente novamente.')
    return result
  } finally {
    image.close()
  }
}
export function ProfileForm({
  profile,
  onClose,
}: {
  profile: ProfilePreferences
  onClose: () => void
}) {
  const [value, setValue] = useState(profile),
    [original] = useState(profile),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const parsed = profileSchema.safeParse(value)
      if (!parsed.success)
        throw new Error(
          'Revise os campos. O identificador aceita letras, números, hífen e sublinhado.',
        )
      useData.setState({
        data: await repository.saveProfile(parsed.data, original),
      })
      onClose()
    } catch (error) {
      setError(dataError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <EntrySheet
      title="Editar perfil"
      description="Seu espaço é privado. Tudo fica neste navegador e pode entrar no seu backup."
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="note-form" onSubmit={(e) => void submit(e)}>
        <label>
          Nome de exibição
          <input
            autoFocus
            maxLength={100}
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          Identificador opcional
          <input
            maxLength={40}
            placeholder="@exemplo"
            value={value.handle}
            onChange={(e) => setValue({ ...value, handle: e.target.value })}
          />
        </label>
        <label>
          Uma frase sua
          <input
            maxLength={180}
            placeholder="Um dia de cada vez."
            value={value.bio}
            onChange={(e) => setValue({ ...value, bio: e.target.value })}
          />
        </label>
        <label>
          Aparência do avatar
          <select
            value={value.avatarStyle}
            onChange={(e) =>
              setValue({
                ...value,
                avatarStyle: e.target
                  .value as ProfilePreferences['avatarStyle'],
              })
            }
          >
            <option value="neutral">Cinza sólido</option>
            <option value="soft">Cinza suave</option>
            <option value="contrast">Contraste</option>
          </select>
        </label>
        <label>
          Imagem local opcional
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                const avatar = await localAvatar(file)
                setValue((current) => ({ ...current, avatar }))
                setError('')
              } catch (error) {
                setError(dataError(error))
              } finally {
                setBusy(false)
                e.target.value = ''
              }
            }}
          />
        </label>
        <p className="form-help">
          Até 2 MB; recorte central de 256 × 256 px, convertido em WebP. Sem
          envio, metadados ou imagem remota. Iniciais funcionam sem upload.
        </p>
        {value.avatar && (
          <button
            type="button"
            className="button"
            onClick={() => setValue({ ...value, avatar: null })}
          >
            Usar iniciais
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            Salvar perfil
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
