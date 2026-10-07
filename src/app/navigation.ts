import {
  CalendarDays,
  CheckCheck,
  Grid2X2,
  NotebookPen,
  Target,
  GraduationCap,
} from 'lucide-react'

export const navigation = [
  { path: '/', label: 'Hoje', icon: CalendarDays },
  { path: '/tarefas', label: 'Tarefas', icon: CheckCheck },
  { path: '/habitos', label: 'Hábitos', icon: Grid2X2 },
  { path: '/notas', label: 'Notas', icon: NotebookPen },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/estudos', label: 'Estudos', icon: GraduationCap },
] as const
