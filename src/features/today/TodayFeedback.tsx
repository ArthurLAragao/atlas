import { useData } from '../../app/data-store'
import { useTasks } from '../tasks/task-store'
import { useHabits } from '../habits/habit-store'
import { useToday } from './today-store'
import { TransientToast } from '../../components/TransientToast'

export function TodayFeedback() {
  const busy = useData((state) => state.busy)
  const tasks = useTasks()
  const habits = useHabits()
  const goal = useToday()
  const items = [
    { ...tasks, key: 'tasks', undoLabel: 'Desfazer exclusão de tarefa' },
    {
      ...habits,
      key: 'habits',
      undoLabel: 'Desfazer exclusão de hábito ou registro',
    },
    { ...goal, key: 'goal' },
  ]
  return items.map((item) =>
    item.message || item.error ? (
      <TransientToast
        key={item.key}
        identity={`${item.key}:${item.message}:${item.error}`}
        persistent={Boolean(item.error)}
        onDismiss={item.dismiss}
      >
        {item.message && <p role="status">{item.message}</p>}
        {item.error && (
          <p role="alert" className="data-error">
            {item.error}
          </p>
        )}
        <div className="button-row">
          {'canUndo' in item && item.canUndo && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void item.undo()}
            >
              {item.undoLabel}
            </button>
          )}
          {(item.message || item.error) && (
            <button className="button" onClick={item.dismiss}>
              Fechar aviso
            </button>
          )}
        </div>
      </TransientToast>
    ) : null,
  )
}
