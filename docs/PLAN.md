# Atlas — plano de implementação

## Ambiente pessoal — refinamento de 2026-11-03

Preservar dados e schema; aprofundar o preto e usar azul luminoso nos tokens.
Hoje reúne visão real do dia, atividade registrada e rascunho diário persistido
como nota. Lumen passa a uma janela com captura, biblioteca, arquivos e contexto.
Obsidian mantém contexto pessoal explicitamente fornecido; Notion mantém estudos.
Verificar teclado, larguras pequenas, contraste e limites das integrações.

## Entrega da etapa 7A - Metas e Projetos

Base confirmada: `b5ffaae`, checkout limpo, 400 testes unitários e 38 E2E existentes. Escopo somente Metas/Projetos; Estudos, Pomodoro e experiência PWA ficam para etapas posteriores.

1. Estender modelos de forma aditiva: descrição/estado/meta semanal explícita e unidade de resultado-chave opcionais em dados antigos; estados de projeto opcionais. Funções puras para progresso manual, tarefas complementares, prazo em dias de calendário e relações por IDs em ambos os sentidos.
2. Acrescentar operações transacionais ao repository Dexie: salvar com versão esperada, vincular/desvincular, criar tarefa/nota no projeto, arquivar/excluir/desfazer com deltas persistentes. Exclusão remove referências e desfazer restaura todos os vínculos sem sobrescrever alterações posteriores.
3. Uma rota `/metas`: listas editoriais de metas/projetos, detalhes por ID na query, progresso discreto e próximos passos; sheets de criação/edição com detalhes opcionais. Reusar tokens e componentes; conteúdo sólido, vidro só na camada funcional.
4. Hoje passa a mostrar apenas a escolha explícita do usuário, com estado vazio útil. Busca global aponta para detalhes por ID. Seed acrescenta Atlas e trilha AWS/DevOps removíveis, com atualização idempotente que não recria exemplos já apagados.
5. Testes puros, relacionamentos/repository, criação/navegação/undo no browser, três larguras/temas/texto 200%, revisão apple-design, lint/typecheck/test/build/E2E e commit Conventional Commits.

Referências carregadas via hig-lookup: accessibility, layout, typography, color, designing-for-macos, cross-platform, lists-and-tables, progress-indicators, sheets, text-fields, buttons, undo-and-redo e liquid-glass. Barras de metas são medidas de conteúdo persistente, não indicadores de espera: percentuais e rótulos exatos são julgamento de produto, sem animação simulando processamento.

Concluída em 2026-10-02: 561 testes unitários e 49 E2E aprovados; lint, typecheck e build limpos. Revisão, correções e limites em `REVIEW-ETAPA-7A.md`. Próxima entrega 7B permanece separada, sem Estudos ou Pomodoro nesta etapa.

## Entrega da etapa 6

Base confirmada: `cc94842`, etapa 5, checkout limpo. Preservar os testes existentes e acrescentar cobertura para Notas.

1. Lógica pura em `src/lib`: links `[[título]]` fora de código/HTML/links Markdown, resolução sem ambiguidade, backlinks, pesquisa por título/conteúdo/tags e exportação de nota Markdown.
2. Extensão aditiva do Note com `archivedAt` opcional, compatível com registros/backups anteriores. Operações de salvar/renomear, arquivar/excluir e desfazer transacionais no repository existente. Derivar arestas do texto; reservar `features/notes/graph` para o futuro, sem tela de grafo.
3. Lista pesquisável de notas ativas/arquivadas, criação com quatro templates, editor de texto e prévia Markdown segura, tags, autocomplete de links e backlinks. Página de leitura de largura limitada, superfícies sólidas, tokens existentes; apenas navegação/sheets recebem vidro.
4. Busca global na command palette; `nota: título` cria e abre edição. Rascunhos persistidos localmente durante a digitação, salvamento explícito com Ctrl/Cmd+S e proteção contra saída/perda de texto. Exportação individual Markdown e backup completo continuam distintos.
5. Testes puros, repository e browser: autoria/conexões/busca/undo, exportação/reimportação, texto longo em 375/768/1280 px, teclado/contraste/zoom. Revisão apple-design, lint, typecheck, test, build, E2E e commit Conventional Commits.

Referências carregadas via hig-lookup: accessibility, layout, typography, color, designing-for-macos, cross-platform, text-views, text-fields, segmented-controls, search-fields, undo-and-redo, sheets e liquid-glass. A tese: um caderno de texto fácil de abrir, conectar e reencontrar, sem controles de edição complexos.

## Entrega da etapa 5

Hoje reúne tarefas com prazo no dia, revisão automática das pendências anteriores, hábitos com registro imediato, próximo compromisso manual e meta da semana. Sugestão de até três tarefas pendentes, sem impedir a captura. Adiar usa a operação existente do repository. Compromissos são tarefas com a tag `compromisso`; metas semanais são metas com prazo no domingo. Assim, ambos permanecem no backup de conteúdo e nos cinco tipos existentes.

Captura global com cmdk em Dialog Radix: Ctrl/Cmd+K, texto padrão para tarefa, prefixos `nota:` e `hábito:`, navegação por destinos. Interpretação antes de salvar; notas/hábitos preservam a prosa. Ajuda em sheet com `?`, sem interceptar texto, IME ou atalhos do navegador. Foco retorna ao acionador; navegar mantém o foco no título da rota.

Lógica pura de seleção/progresso/captura em `src/lib`, UI de Hoje em `features/today`, palette/ajuda compartilhadas e store de comandos em `app`. Tokens existentes; conteúdo sólido, vidro apenas na camada funcional. Ordem: lógica e testes → Hoje e formulários → captura e atalhos → verificação de teclado, persistência e layouts → revisão HIG, checks e commit. Widgets reordenáveis, XP, notificações e PWA continuam na etapa 8.

Referências carregadas via `hig-lookup.md`: accessibility, layout, typography, color, designing-for-macos, cross-platform, searching, search-fields, keyboards, sheets, toolbars, feedback e liquid-glass.

## Entrega da etapa 4

Lista como visão principal, captura em uma linha com interpretação visível e formulário em sheet para detalhes. Lista, Kanban e calendário compartilham filtros e registros; mudar a situação por select oferece alternativa ao arraste. Calendário mensal mostra contagens e abre a lista do dia. Contextos começam com Faculdade, Kyber, Projetos, Pessoal e Academia e podem ser editados.

Funções puras de parser/calendário/repetição em `src/lib`, operações transacionais e undo em repositories, store otimista e componentes pequenos em `features/tasks`. Repetição gera a próxima tarefa uma única vez ao concluir, preservando a concluída. Ordem: lógica e dados → lista/formulários → Kanban/calendário → testes de fluxos e revisão HIG → checks e commit. Pomodoro permanece na etapa 7; integração com Hoje e captura global na etapa 5.

Referências: accessibility, layout, typography, color, designing-for-macos, cross-platform, lists-and-tables, text-fields, sheets, buttons, segmented-controls, drag-and-drop, undo-and-redo, keyboards e motion, roteadas por hig-lookup.

## Arquitetura

## Entrega da etapa 7B

1. Disciplinas e trilhas: coleções auxiliares `subjects` e `studyPaths`, migração aditiva do IndexedDB e leitura de backups antigos; avaliações e eventos pertencem à disciplina, etapas pertencem à trilha. Vínculos usam os IDs de tarefas e notas existentes. Lógica pura de médias, presença, prazos e progresso em `src/lib/study.ts`. UI em `src/features/study`, listas e detalhes na rota Estudos, edição em sheets. Validar todos os checks e fluxos antes do primeiro commit.
2. Flashcards e Foco: revisão diária com SM-2 pequeno e documentado; cronômetro com timestamps persistidos, transições explícitas e sessões reais, sem conclusão automática por abandono. Rota de Foco carregada sob demanda e botão global. Preferências discretas de duração. Testar recuperação, pausa, refresh e tempo em segundo plano; revisar HIG e executar novamente os checks antes do segundo commit.

Contrato da segunda subetapa: `flashcards` e `focusSessions` serão coleções auxiliares exportáveis, com os mesmos vínculos por ID. Flashcards guardam pergunta, resposta e estado SM-2. Sessões guardam tempo acumulado, início do segmento ativo, duração planejada e estado explícito. O relógio calcula diferenças de timestamps, sem contar ticks. Chegar a zero exige confirmação de conclusão; refresh e navegação não escrevem uma sessão concluída. Reiniciar encerra a tentativa anterior como interrompida. Uma transação impede sessões simultâneas e conclusão duplicada. Preferências de duração ficam junto das preferências locais existentes. Estudos e Foco não alteram resultados de metas.

Tokens existentes para superfícies sólidas, hierarquia tipográfica, espaçamento, alvos de toque, foco e cores semânticas. Identificação de disciplinas por opções curadas e nome textual. Novos tokens apenas quando necessários para dimensões do cronômetro/listas. Revisão: acessibilidade, plataforma web, acabamento, interação e conteúdo; 375/768/1280 px, texto a 200%, ambos os temas e preferências de movimento/transparência.

Referências roteadas por `hig-lookup.md`: accessibility, layout, typography, color, lists-and-tables, sheets, text-fields, progress-indicators, designing-for-macos, cross-platform, liquid-glass, undo-and-redo, keyboards, feedback, motion e alerts.

React + TypeScript estrito + Vite. Features carregadas sob demanda por rota com React Router. UI compartilhada acessível com Radix, ícones Lucide e Tailwind ligado a tokens CSS. Zustand guarda preferências; conteúdo terá repositories assíncronos sobre Dexie, substituíveis por Supabase sem acoplar componentes ao banco. Funções puras em `src/lib`, testadas com Vitest; fluxos com Testing Library.

```text
src/app/                    shell, rotas e preferências
src/components/             UI compartilhada
src/features/               today, tasks, habits, notes, goals, study
src/lib/                    lógica pura e testes
src/data/repositories/      contratos e implementação local (etapa 2)
src/styles/                 tokens e estilos globais
docs/                       plano, decisões e pendências
```

## Direção e tokens

Monocromático editorial: conteúdo legível, poucos contêineres, linhas e espaço para hierarquia. Heatmap é a assinatura, implementado na etapa 3, sem números fictícios nesta base.
Tokens semânticos: bg, surface, surface-elevated, border, text-primary, text-secondary, accent, success, danger; variações claras/escuras. Tipografia de sistema com largeTitle, title, headline, body, callout e caption. Espaçamento em múltiplos de 4 px, alvos de 44 px, raios de 10–16 px, movimento de 180 ms. Somente a camada funcional recebe blur; fallback opaco para redução de transparência e alto contraste.
Escuro é o padrão; opções claro e sistema explícitas. Accent inicial azul discreto; opções curadas com contraste verificado. Não exigir configuração no primeiro acesso.

```text
Desktop: [sidebar recolhível] [toolbar de aparência]
                              [título e contexto]
                              [conteúdo por feature]
Mobile:  [marca e aparência]
         [título e conteúdo em uma coluna]
         [Hoje | Tarefas | Hábitos | Notas | Metas | Estudos]
```

## Etapas e verificação

Estado em 2026-10-03: funcionalidades das etapas 1 a 8 concluídas, com 7A e duas subetapas 7B. Relatórios por etapa em docs; a experiência diária está em `REVIEW-ETAPA-8.md` e o plano específico em `PLAN-ETAPA-8.md`. A meta de desempenho no primeiro acesso permanece pendente, registrada na verificação. Próxima entrega: auditoria integral e esse ajuste de desempenho (etapa 9).

1. Setup, tokens, temas, layout responsivo, rotas e testes da base.
2. Modelos, Dexie, repositories, seed removível, importação/exportação JSON e Markdown.
3. Hábitos, intensidade, descanso, frequência, streaks, heatmap e alternativa textual.
4. Tarefas, parser pt-BR, subtarefas, repetição, Kanban acessível e calendário.
5. Hoje integrado, captura rápida, command palette e sheet de atalhos.
6. Notas Markdown, links, backlinks, templates e busca.
7. Metas/projetos, disciplinas/trilhas/flashcards, SM-2 e Pomodoro.
8. Preferências, widgets, XP discreto e PWA offline. Notificações excluídas desta etapa por instrução explícita; apenas arquitetura futura documentada.
9. Auditoria apple-design: acessibilidade, plataforma, craft, interação e conteúdo; corrigir e registrar O quê / Por quê / Correção.
10. README com prints, documentação de execução e deploy Vercel.

Em cada etapa: lint, typecheck, testes e build; corrigir falhas antes do commit Conventional Commits. Verificar layouts 375, 768 e ≥1280 px e teclado conforme os componentes entram. Não declarar Lighthouse, offline, leitor de tela ou deploy sem evidência. Listas acima de 200 itens terão virtualização quando forem implementadas.

## Referências consultadas antes da UI

Etapa 7B executada em dois commits: primeiro disciplinas/avaliações/faltas/eventos/trilhas; depois flashcards/SM-2 e Foco/Pomodoro. Ambos mantêm repositories, migrações aditivas e validação completa antes de commitar. Decisões e revisões específicas ficam nos respectivos documentos.

Skill `apple-design`, `references/hig-lookup.md`, `references/cross-platform.md`; HIG: design-principles, accessibility, color, typography, layout, materials, dark-mode, motion, buttons, lists-and-tables, text-fields, toggles, sheets, sidebars, tab-bars, toolbars, search-fields, charts, onboarding, feedback, undo-and-redo, keyboards, liquid-glass e designing-for-macos.
Aplicação à web: princípios e fundamentos, sem impor menus nativos do macOS. A solicitação explícita de seletor de tema prevalece sobre a recomendação da skill de não oferecer seletor próprio.

## Redesign de painéis — 03/11/2026
Preservar Navigation, dock, toolbar e tokens globais. Aplicar tokens de conteúdo no main e painéis reutilizáveis para Hoje, tarefas, hábitos, estudos, foco, metas e notas. Manter dados e integrações reais; sem novos mocks no Atlas. Verificar navegação inalterada, contraste, teclado e larguras 375/768/1440.

## Operação local real — 03/11/2026
Substituir servidor temporário por serviço local persistente com fallback SPA e tipos MIME corretos; manter origem 127.0.0.1:4180 e IndexedDB. Tratar erros de chunks sem apagar dados. Conectar ações e voz pt-BR ao catálogo local de aplicativos. Testar navegação direta/reload e fluxos reais sem afirmar aprovação humana do microfone.

## Publicação GitHub Pages - 05/11/2026
Publicar o código e o build em /atlas/, com PWA escopada e rotas hash apenas na hospedagem estática. Preservar dock, esquema de dados e URLs do app local. Documentar exportação/importação entre origens, excluir artefatos locais e verificar build, testes e navegação pública.
