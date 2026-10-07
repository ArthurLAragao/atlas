import { lazy } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Shell } from './Shell'
import { PageHeader } from '../components/PageHeader'

const loadToday = () => import('../features/today/TodayPage')
// Fetch the initial route while IndexedDB opens, retaining route splitting.
if (window.location.pathname === '/') void loadToday().catch(() => {})
const Today = lazy(loadToday)
const Tasks = lazy(() => import('../features/tasks/TasksPage'))
const Habits = lazy(() => import('../features/habits/HabitsPage'))
const Notes = lazy(() => import('../features/notes/NotesPage'))
const Goals = lazy(() => import('../features/goals/GoalsPage'))
const Study = lazy(() => import('../features/study/StudyPage'))
const Preferences = lazy(
  () => import('../features/preferences/PreferencesPage'),
)
const Profile = lazy(() => import('../features/profile/ProfilePage'))
const Focus = lazy(() => import('../features/study/FocusPage'))

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Today />} />
        <Route path="tarefas" element={<Tasks />} />
        <Route path="habitos" element={<Habits />} />
        <Route path="notas" element={<Notes />} />
        <Route path="metas" element={<Goals />} />
        <Route path="estudos" element={<Study />} />
        <Route path="preferencias" element={<Preferences />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="foco" element={<Focus />} />
        <Route
          path="*"
          element={
            <>
              <PageHeader title="Página não encontrada" eyebrow="Vamos retomar">
                Este endereço não existe no seu Atlas.
              </PageHeader>
              <Link className="button" to="/">
                Voltar para Hoje
              </Link>
            </>
          }
        />
      </Route>
    </Routes>
  )
}
