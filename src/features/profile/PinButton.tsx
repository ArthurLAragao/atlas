import { Pin, PinOff } from 'lucide-react'
import { useState } from 'react'
import { useData, dataError } from '../../app/data-store'
import { repository } from '../../data/service'
import type { PinnedItem } from '../../data/profile-models'

export function PinButton({ type, id }: PinnedItem) {
  const pinned = useData(
    (s) =>
      s.data.profile?.pinned.some((p) => p.type === type && p.id === id) ??
      false,
  )
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState('')
  return (
    <>
      <button
        className="button"
        disabled={busy}
        aria-pressed={pinned}
        onClick={async () => {
          setBusy(true)
          try {
            useData.setState({
              data: await repository.togglePinned({ type, id }, pinned),
            })
            setFeedback(pinned ? 'Item desafixado.' : 'Item fixado no perfil.')
          } catch (error) {
            setFeedback(dataError(error))
          } finally {
            setBusy(false)
          }
        }}
      >
        {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
        {pinned ? 'Desafixar do perfil' : 'Fixar no perfil'}
      </button>
      <span role="status" className="form-help">
        {feedback}
      </span>
    </>
  )
}
