# Atlas — plano de auditoria 9B

Data: 2026-10-05. Versão visual aprovada: `eb7c770` (HEAD inicial; último ajuste de produto: `78dabf4`). Git inicialmente limpo. Direção visual congelada; nenhuma publicação autorizada nesta etapa.

## Inventário verificado no código

| Rota                         | Recursos existentes                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Hoje `/`                     | Prioridades, pendências, compromisso manual, meta semanal explícita, hábitos, organização de widgets e captura global |
| Tarefas `/tarefas`           | Parser PT-BR, edição, subtarefas, repetição, contextos, Lista/Kanban/Tabela/Calendário, vínculos e desfazer           |
| Hábitos `/habitos`           | Binários/quantitativos, frequência diária/semanal, descanso, logs datados, sequência e heatmaps                       |
| Notas `/notas`               | Markdown, rascunhos locais, templates, busca, wiki links/backlinks, preview contextual, importação Markdown           |
| Metas `/metas`               | Metas/resultados-chave, projetos, relações por ID, criação contextual, meta semanal, fixação no perfil                |
| Estudos `/estudos`           | Disciplinas/avaliações/faltas/eventos, trilhas/checklist e flashcards SM-2                                            |
| Foco `/foco`                 | Timer por timestamps, pausas, recuperação e registro de sessões                                                       |
| Perfil `/perfil`             | Perfil/avatar local, métricas, atividade/heatmap e até três referências fixadas                                       |
| Preferências `/preferencias` | Aparência, movimento/transparência, foco, XP, widgets, backups/limpeza e PWA                                          |

Rotas usam imports dinâmicos. Dez coleções IndexedDB: tasks, habits, habitLogs, notes, goals, projects, subjects, studyPaths, flashcards, focusSessions. `meta` conserva perfil, experiência, histórico operacional e inicialização. Banco Dexie versão 3; interface AtlasRepository protege a camada de persistência. Grafo permanece reservado na arquitetura, sem tela implementada. Sem backend/login/sincronização.

## Baseline

Scripts reais: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`. Baseline executado em `eb7c770`: lint, typecheck e build aprovados, 825 testes em 64 arquivos aprovados, 97 E2E aprovados (10,2 min). Logs separados `audit-9b-baseline-*.log`. Após tentativas interrompidas por falta de saída intermediária, o baseline unitário concluiu com o mesmo script e `--pool=threads`; configuração e asserções foram preservadas. A suíte completa padrão, já com regressões, posteriormente concluiu em 238,73 s: 838 testes/66 arquivos. As interrupções não foram falhas de asserção.

Lighthouse baseline atual, três execuções independentes por cenário: frio 80/85/86 (mediana 85), retorno 99/100/100 (mediana 100), acessibilidade 100 nas seis. Mediana LCP frio 3,482 s; conteúdo real de Hoje. Relatórios individuais e bundles em `performance-9b-baseline.json`. Os números históricos 67/100 da etapa 8 não substituem estas medições.

## Riscos e ordem

1. Concluir baseline e congelar artefatos de produção para E2E/performance. Inspecionar interface com contexto descartável.
2. Medir três navegações frias e três de retorno, sem outras suítes concorrentes. Cada coleta terá perfil temporário independente e relatório JSON/HTML próprio.
3. Integridade: atomicidade, conflitos entre abas, repetição/XP/eventos, migrações, importações inválidas, backup completo e recuperação de falhas. Prioridade crítica/alta antes de otimizações.
4. Fluxos por módulo e limites de datas/conteúdo. Adicionar regressões para defeitos reproduzidos, preservando todas as asserções existentes.
5. Apple HIG: acessibilidade primeiro, depois comportamento/plataforma/craft/conteúdo; corrigir apenas defeitos objetivos. Axe, teclado/foco, 375/768/1280/1440 px, temas, texto 200%, redução de movimento/transparência.
6. Performance somente com evidência de gargalo. Repetir três coletas frias e três de retorno nas mesmas condições; comparar mediana e bundle. Meta fria >=90 permanece critério, nunca promessa.
7. Validar PWA em produção: reload e rotas não visitadas offline, edição/reconexão, duas revisões reais de worker, adiamento/ativação com rascunho e timer, manifest/ícones/escopo.
8. Checks finais, documentos QA/PERFORMANCE/REVIEW e commits pequenos com os quatro checks obrigatórios antes de cada commit.

## Método e segurança dos testes

Playwright/Edge headless usa contextos novos sem storageState pessoal. Bancos destrutivos recebem nomes exclusivos ou vivem em contextos explicitamente descartáveis; testes de SW usam servidor/artefatos temporários próprios. Nunca operar limpeza na aba pessoal do usuário. Não executar build durante E2E/Lighthouse para evitar substituição de chunks em uso.

Lighthouse: build de produção, configuração mobile existente e inalterada, frio com cache/IndexedDB/SW vazios, retorno após preparação online separado. Trace começa antes da primeira navegação e termina após Hoje real renderizado; sem prewarming frio ou tela artificial. Registrar todas as execuções, mediana, métricas e waterfall. Inventariar bytes dos assets antes/depois. Capturas novas usam prefixo audit-9b; evidência histórica é preservada.

JSON preserva snapshot completo; backup Markdown Atlas inclui bloco de restauração JSON. Notas Markdown individuais não prometem restaurar todas as entidades/metadados. Leitor de tela humano, hardware móvel e instalação física não serão declarados validados por automação.
