import { Link } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal, X } from 'lucide-react'
import { usePreferences } from '../app/preferences-store'
import type { Theme, Accent } from '../lib/preferences'

const themes: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
]
const accents: { value: Accent; label: string }[] = [
  { value: 'blue', label: 'Azul' },
  { value: 'neutral', label: 'Grafite' },
  { value: 'green', label: 'Verde' },
]

export function Appearance() {
  const preferences = usePreferences((state) => state.preferences)
  const update = usePreferences((state) => state.update)
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="button appearance-trigger" aria-label="Aparência">
          <SlidersHorizontal aria-hidden="true" />
          <span>Aparência</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="appearance-panel glass"
          sideOffset={8}
          collisionPadding={16}
          align="end"
          aria-labelledby="appearance-title"
        >
          <div className="section-heading">
            <h2 id="appearance-title">Do seu jeito</h2>
            <Popover.Close
              className="icon-button"
              aria-label="Fechar aparência"
            >
              <X aria-hidden="true" />
            </Popover.Close>
          </div>
          <fieldset>
            <legend>Tema</legend>
            <div className="segmented">
              {themes.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={preferences.theme === value}
                    onChange={() => update({ theme: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cor de destaque</legend>
            <div className="accent-options">
              {accents.map(({ value, label }) => (
                <label key={value} className="accent-option">
                  <input
                    type="radio"
                    name="accent"
                    checked={preferences.accent === value}
                    onChange={() => update({ accent: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preferences.solid}
              onChange={(event) => update({ solid: event.target.checked })}
            />
            <span>Reduzir transparência</span>
          </label>
          <p className="caption">As preferências ficam neste navegador.</p>
          <Popover.Close asChild>
            <Link className="button" to="/preferencias">
              Todas as preferências
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
