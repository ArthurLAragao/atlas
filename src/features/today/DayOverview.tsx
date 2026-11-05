import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { activityEvents, activityGrid } from '../../lib/activity'
import { formatDay } from '../../lib/habits'
import { useNotes } from '../notes/note-store'
import '../../styles/day-overview.css'

export function DayOverview({ today, pending, completed, habitsDone, habitsTotal }: {
  today: string; pending: number; completed: number; habitsDone: number; habitsTotal: number
}) {
  const data = useData((state) => state.data)
  const grid = useMemo(() => activityGrid(activityEvents(data), today, 8), [data, today])
  const noteId = 'day-note-' + today
  const existing = data.notes.find((note) => note.id === noteId)
  const [draft, setDraft] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const value = draft ?? existing?.content ?? ''
  useEffect(() => {
    const receive = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail
      if (typeof detail === 'string' && detail.length <= 500_000) { setDraft(detail); setMessage('Rascunho ditado; ainda não foi salvo.') }
    }
    window.addEventListener('atlas:journal-draft', receive)
    return () => window.removeEventListener('atlas:journal-draft', receive)
  }, [])
  async function save() {
    setSaving(true)
    const now = new Date().toISOString()
    try {
      const saved = await useNotes.getState().save({
        ...(existing ?? { id: noteId, title: 'Registro do dia · ' + formatDay(today), tags: ['diario'], links: [], createdAt: now, isExample: false }),
        content: value, updatedAt: now,
      }, existing?.updatedAt ?? null)
      setMessage(saved ? 'Registro salvo nas notas do Atlas.' : 'Não foi possível salvar. Seu texto continua aqui.')
      if (saved) setDraft(null)
    } finally { setSaving(false) }
  }
  return <section className="day-overview" aria-label="Visão do dia">
    <div className="day-pulse">
      <div className="day-pulse-heading"><span>Seu ritmo</span><Link to="/perfil">Ver atividade</Link></div>
      <div className="day-metrics">
        <div><strong>{pending}</strong><span>tarefas pendentes</span></div>
        <div><strong>{completed}</strong><span>tarefas concluídas</span></div>
        <div><strong>{habitsDone}<small>/{habitsTotal}</small></strong><span>hábitos de hoje</span></div>
      </div>
      <div className="day-heatmap" role="group" aria-label="Atividade registrada nas últimas oito semanas">
        {grid.map((week, index) => <div key={index}>{week.map((day) => <span
          key={day.date} className="day-heatmark" role="img" data-level={day.level} data-future={day.future}
          title={`${formatDay(day.date)}: ${day.points} ações registradas`}
          aria-label={`${formatDay(day.date)}: ${day.points} ações registradas`} />)}</div>)}
      </div>
      <p className="form-help">Oito semanas de ações registradas. Cada marca representa um dia.</p>
      {(data.tasks.some((task) => task.isExample) || data.habits.some((habit) => habit.isExample)) && <p className="form-help">Os exemplos da lista não entram nestes indicadores pessoais.</p>}
    </div>
    <div className="day-journal">
      <div className="day-pulse-heading"><label htmlFor="day-journal">Anotações do dia</label><span className="day-overline">Salvo no Atlas</span></div>
      <textarea id="day-journal" value={value} maxLength={500_000}
        placeholder="O que merece sua atenção hoje? Ideias, dúvidas e próximos passos…"
        onChange={(event) => { setDraft(event.target.value); setMessage('') }} />
      <div className="day-journal-actions"><button id="save-day-journal" className="button button-primary" onClick={() => void save()} disabled={saving || !value.trim()}>Salvar registro</button>
        <Link to="/notas">Todas as notas</Link></div>
      {message && <p role="status" className="form-help">{message}</p>}
    </div>
  </section>
}
