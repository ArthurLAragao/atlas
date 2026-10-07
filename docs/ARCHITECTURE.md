# Arquitetura do Atlas

Visão do código congelado para a primeira entrega pública.

## Camadas e módulos

| Local                         | Responsabilidade                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`, `src/App.tsx` | Entrada React, tema, provider de dados, LazyMotion e registro PWA.                                                                |
| `src/app`                     | Shell/dock, rotas, captura, preferências, PWA e snapshot compartilhado.                                                           |
| `src/features`                | today, tasks, habits, notes, goals, study, profile e preferences. Foco/flashcards pertencem a study; goals também reúne Projetos. |
| `src/components`              | Primitivos compartilhados, sheets/Radix, confirmações, captura, feedback, calendário e dock.                                      |
| `src/lib`                     | Regras puras: parser, datas, streaks, heatmaps, progresso, médias, SM-2, timer, busca, Markdown, backups e preferências.          |
| `src/data`                    | Schemas Zod, seed, contrato AtlasRepository, adaptador Dexie e operações especializadas.                                          |
| `src/styles`                  | Tokens e estilos aprovados; conteúdo sólido e materiais em camadas funcionais.                                                    |

UI chama stores/repository; alterações de conteúdo vão ao adaptador transacional; Dexie `liveQuery` entrega snapshots ao Zustand. `src/data/service.ts` compõe o `AtlasRepository`. Um adaptador futuro exige implementação/testes próprios: Supabase e sincronização não existem nesta versão.

Entidades se relacionam por IDs e `links[]`, sem cópias por módulo. Eventos de estudo/etapas e sessões têm referências opcionais específicas. Datas locais usam `YYYY-MM-DD`; instantes usam ISO. Progresso acadêmico ou horas de foco não viram sucesso de meta automaticamente.

## IndexedDB, estado e concorrência

`src/data/database.ts` cria `atlas-local`:

- v1: tasks, habits, habitLogs, notes, goals, projects e meta.
- v2: subjects e studyPaths.
- v3: flashcards e focusSessions.

`meta` guarda inicialização/migração de exemplos, undo e ledgers de XP/atividade/perfil. O snapshot lê esses metadados; Perfil não duplica entidades. **Dexie v3 e schemaVersion 1 do envelope de backup são contratos distintos**, preservados.

Inicialização/operações compostas usam transações. Operações com versão esperada verificam `updatedAt` para recusar edição antiga. Atualizações otimistas mantêm erro/recuperação; módulos têm locks e undo próprios, não um histórico universal. As auditorias exercitam duas abas/rollback/relações/deduplicação, sem provar todos os casos possíveis de concorrência.

Zustand conserva estado da UI/snapshot; preferências e rascunhos ficam em stores/localStorage separados. Timer conserva timestamps no banco: pausa congela o tempo, F5 recupera, chegar a zero não conclui silenciosamente sessão/tarefa. [Contratos de dados e privacidade](DATA-AND-PRIVACY.md).

## Carregamento sob demanda

`src/app/routes.tsx` usa React.lazy; Hoje é antecipado em `/`. Editor/preview Markdown, AST de wikilinks, conteúdo da sheet Dados, calendário, Tabela/Kanban e perfil têm fronteiras dinâmicas. `note-identity` e `data-records` separam identidade/integridade leve do parser completo.

Na 9C, imports de salvar/renomear notas e proteger remoção de exemplos são resolvidos **antes** da transação Dexie; exports síncronos antigos continuam reexportados. Sheet Dados mantém título/descrição/saída durante carga; Hoje não foi substituído por loading para melhorar LCP. Engine `domMax` conserva fronteira/timing da 9B. Listas de tarefas/notas têm virtualização para conjuntos grandes; não há promessa de virtualizar toda coleção em toda tela.

## Rotas, PWA e testes

Rotas: `/`, `/tarefas`, `/habitos`, `/notas`, `/metas`, `/estudos`, `/foco`, `/perfil`, `/preferencias`; detalhes por query. Wildcard mostra Página não encontrada dentro do shell. `features/notes/graph` é reserva arquitetural, sem rota de grafo.

Vite gera dist. vite-plugin-pwa/Workbox gera manifest/worker/precache, incluindo chunks lazy. Registro desativado em dev; em produção começa após conteúdo real renderizado. Prompt e `skipWaiting: false` mantêm escolha de atualizar; cache de assets e IndexedDB são separados. [Validação e limites](VALIDATION.md).

Vitest/Testing Library: funções, stores, componentes/repositories com jsdom/fake-indexeddb. Playwright: Edge, um worker, contextos descartáveis, fluxos/teclado/concorrência/offline e duas revisões reais do worker. Axe avalia estados automatizados; Lighthouse separa frio/retorno. Os testes existentes foram preservados; resultados da cópia pública em [VALIDATION](VALIDATION.md).

Não há backend, conta remota, integrações ou notificações. Instalação física, Safari/iOS, NVDA e zoom nativo permanecem sem comprovação; [limites e resultados](VALIDATION.md) separam automação e verificações humanas.
