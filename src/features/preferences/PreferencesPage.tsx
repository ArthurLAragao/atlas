import { PageHeader } from '../../components/PageHeader'
import { usePreferences } from '../../app/preferences-store'
import type { Accent, EffectPreference, Theme } from '../../lib/preferences'
import { FocusPreferences } from '../study/FocusPreferences'
import { WidgetOrganizer } from '../today/WidgetOrganizer'
import { DataTransfer } from '../../components/DataTransfer'
import { useData } from '../../app/data-store'
import { recordCount, removableExamples } from '../../lib/data-integrity'
import { InstallApp } from './InstallApp'
import { ExperienceSummary } from './ExperienceSummary'
import { ClearData } from './ClearData'
import '../../styles/preferences.css'
import '../../styles/directions.css'

export default function PreferencesPage() {
  const preferences = usePreferences((state) => state.preferences)
  const update = usePreferences((state) => state.update)
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const examples = recordCount(removableExamples(data))
  return (
    <div className="preferences-page">
      <PageHeader title="Preferências" eyebrow="Do seu jeito">
        Mudanças salvas neste navegador. Ajuste apenas o que ajuda no seu dia.
      </PageHeader>
      <section aria-labelledby="preferences-appearance">
        <h2 id="preferences-appearance">Aparência e conforto</h2>
        <div className="preferences-fields">
          <label>
            Tema
            <select
              aria-label="Tema"
              value={preferences.theme}
              onChange={(event) =>
                update({ theme: event.target.value as Theme })
              }
            >
              <option value="system">Seguir sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
          <label>
            Cor de destaque
            <select
              aria-label="Cor de destaque"
              value={preferences.accent}
              onChange={(event) =>
                update({ accent: event.target.value as Accent })
              }
            >
              <option value="blue">Azul Atlas</option>
              <option value="neutral">Grafite</option>
              <option value="green">Verde contido</option>
            </select>
          </label>
          <label>
            Movimento
            <select
              aria-label="Movimento"
              aria-describedby="motion-help"
              value={preferences.motion}
              onChange={(event) =>
                update({ motion: event.target.value as EffectPreference })
              }
            >
              <option value="system">Seguir sistema</option>
              <option value="reduce">Reduzir movimento</option>
              <option value="allow">Permitir movimento</option>
            </select>
            <span className="caption" id="motion-help">
              Reduzir remove transições e animações. Permitir substitui a
              preferência do sistema.
            </span>
          </label>
          <label>
            Transparência
            <select
              aria-label="Transparência"
              aria-describedby="transparency-help"
              value={preferences.transparency}
              onChange={(event) =>
                update({ transparency: event.target.value as EffectPreference })
              }
            >
              <option value="system">Seguir sistema</option>
              <option value="reduce">Reduzir transparência</option>
              <option value="allow">Permitir transparência</option>
            </select>
            <span className="caption" id="transparency-help">
              Reduzir usa superfícies sólidas na navegação. Texto longo sempre
              tem fundo sólido.
            </span>
          </label>
          <label>
            Idioma
            <select aria-label="Idioma" value="pt-BR" disabled>
              <option>Português do Brasil</option>
            </select>
            <span className="caption">
              Outros idiomas poderão ser adicionados. Hoje o Atlas está em
              português.
            </span>
          </label>
        </div>
      </section>
      <section aria-labelledby="preferences-today">
        <h2 id="preferences-today">Tela Hoje</h2>
        <WidgetOrganizer />
      </section>
      <section aria-labelledby="preferences-focus">
        <h2 id="preferences-focus">Foco e pausas</h2>
        <FocusPreferences />
      </section>
      <ExperienceSummary />
      <InstallApp />
      <section aria-labelledby="preferences-data">
        <h2 id="preferences-data">Seus dados</h2>
        <p>
          Registros locais não são sincronizados. Faça uma cópia antes de trocar
          de navegador ou dispositivo.
        </p>
        <DataTransfer />
        <button
          className="button"
          disabled={busy || !examples}
          onClick={() => void useData.getState().removeExamples()}
        >
          Remover exemplos ({examples})
        </button>

        <ClearData />
      </section>
    </div>
  )
}
