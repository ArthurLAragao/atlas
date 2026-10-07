import { emptySnapshot, type Snapshot } from './models.js'

export function buildSeed(now = new Date()): Snapshot {
  const timestamp = now.toISOString()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const base = (id: string, tags: string[] = []) => ({
    id: `example-${id}`,
    tags,
    links: [],
    isExample: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  const result = emptySnapshot()
  result.projects = [
    {
      ...base('project', ['projetos']),
      title: 'Atlas',
      description:
        'Seu centro de comando pessoal: reúna tarefas, notas e metas em um só lugar.',
      status: 'active',
      repositoryUrl: null,
      urls: [],
    },
    {
      ...base('project-learning', ['estudos', 'cloud']),
      title: 'Trilha AWS/DevOps',
      description:
        'Aprender os fundamentos, praticar com projetos pequenos e registrar descobertas.',
      status: 'planned',
      repositoryUrl: null,
      urls: [],
    },
  ]
  result.goals = [
    {
      ...base('goal', ['estudos']),
      title: 'Criar uma rotina de estudo leve',
      deadline: null,
      keyResults: [
        {
          id: 'example-key-result',
          title: 'Concluir três sessões de estudo',
          target: 3,
          current: 0,
        },
      ],
    },
  ]
  result.tasks = [
    'Revisar estruturas de dados',
    'Separar 25 minutos para AWS',
    'Anotar uma ideia de projeto',
  ].map((title, index) => ({
    ...base(`task-${index}`, ['exemplo']),
    title,
    status: 'todo',
    priority: index === 0 ? 'high' : 'medium',
    dueDate: day,
    dueTime: null,
    context: index === 0 ? 'Faculdade' : 'Projetos',
    subtasks: [],
    repeat: null,
    focusMinutes: 0,
    links: [
      { type: 'goals', id: 'example-goal' },
      { type: 'projects', id: 'example-project' },
    ],
  }))
  result.habits = [
    {
      title: 'Academia',
      kind: 'binary',
      target: 1,
      unit: 'vez',
      timesPerWeek: 3,
    },
    { title: 'Sono', kind: 'quantity', target: 8, unit: 'h', timesPerWeek: 7 },
    {
      title: 'Estudo',
      kind: 'quantity',
      target: 45,
      unit: 'min',
      timesPerWeek: 5,
    },
    {
      title: 'Código',
      kind: 'quantity',
      target: 30,
      unit: 'min',
      timesPerWeek: 5,
    },
    {
      title: 'Leitura',
      kind: 'quantity',
      target: 15,
      unit: 'min',
      timesPerWeek: 3,
    },
    { title: 'Água', kind: 'quantity', target: 3, unit: 'L', timesPerWeek: 7 },
  ].map((habit, index) => ({
    ...base(`habit-${index}`, ['exemplo']),
    ...habit,
    kind: habit.kind === 'binary' ? 'binary' : 'quantity',
  }))
  result.habitLogs = [
    {
      ...base('log'),
      habitId: 'example-habit-2',
      date: day,
      value: 15,
      rest: false,
    },
  ]
  result.notes = [
    {
      ...base('note-0', ['faculdade', 'exemplo']),
      title: 'Nota de aula — exemplo',
      content:
        '# Estruturas de dados\n\n## Ideia principal\nUma estrutura organiza dados para facilitar operações.\n\n## Revisar\n- Comparar listas e árvores.\n- Resolver um exercício.\n\nPróximo passo: [[Ideia de projeto — exemplo]].',
    },
    {
      ...base('note-1', ['projetos', 'exemplo']),
      title: 'Ideia de projeto — exemplo',
      content:
        '# Uma ideia pequena\n\nConstruir algo útil, documentar e aprender fazendo.',
      links: [{ type: 'projects', id: 'example-project' }],
    },
  ]
  result.subjects = ['Estruturas de Dados', 'Sistemas Operacionais'].map(
    (title, index) => ({
      ...base(`subject-${index}`, ['faculdade', 'exemplo']),
      title,
      code: null,
      semester: null,
      professor: null,
      color: index === 0 ? 'accent' : 'neutral',
      hours: null,
      status: 'active',
      notes: 'Disciplina de exemplo. Preencha os dados do seu semestre.',
      absences: 0,
      absenceLimit: null,
      classesHeld: null,
      assessments: [],
      events: [],
    }),
  )
  result.studyPaths = [
    {
      title: 'AWS Cloud Fundamentals',
      description: 'Entender cloud e praticar um pequeno passo por vez.',
      steps: [
        'Entender regiões e zonas de disponibilidade',
        'Conhecer IAM e permissões',
        'Registrar os fundamentos de computação e armazenamento',
      ],
    },
    {
      title: 'Fundamentos de DevOps',
      description: 'Construir uma base de entrega e operação de software.',
      steps: [
        'Revisar Git e branches',
        'Executar um projeto com containers',
        'Entender uma pipeline de integração contínua',
      ],
    },
    {
      title: 'Cibersegurança Básica',
      description:
        'Estudar fundamentos de segurança em ambientes de prática autorizados.',
      steps: [
        'Conhecer confidencialidade, integridade e disponibilidade',
        'Revisar autenticação e controle de acesso',
        'Registrar boas práticas de proteção',
      ],
    },
  ].map((path, index) => ({
    ...base(`study-path-${index}`, ['estudos', 'exemplo']),
    title: path.title,
    description: path.description,
    status: 'active',
    steps: path.steps.map((title, stepIndex) => ({
      id: `example-step-${index}-${stepIndex}`,
      title,
      done: false,
      url: null,
      estimatedMinutes: 25,
      noteId: null,
      taskId: null,
    })),
  }))
  return result
}
