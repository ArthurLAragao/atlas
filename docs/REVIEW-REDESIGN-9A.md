# Revisão de design: Atlas — 9A rebuild

## Resumo

Avaliação: **Good**, no escopo das telas e fluxos alterados. A tese é dar prioridade aos próximos passos e manter captura e navegação ao alcance, com conteúdo editorial sólido e o heatmap como assinatura de continuidade. O dock substitui a sidebar conforme as anotações finais do usuário; a etapa 9B de auditoria geral não foi iniciada.

Aplicação web React/TypeScript/Vite, local e privada, para organização pessoal e estudos. As recomendações Apple HIG foram traduzidas para HTML, React Router, Radix e CSS; não se trata de uma reprodução de componentes nativos Apple. A revisão combina código, medidas reais, screenshots e testes em Edge headless. Não comprova uso físico em iOS/Android ou leitura com VoiceOver/NVDA.

## Mudanças por tela

| Tela/fluxo     | Resultado concreto                                                                                                          | Evidência                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Navegação      | Dock fixo central inferior; perfil no dock; Preferências junto de Aparência no cabeçalho; rodapé sem ações repetidas        | `redesign-9a-after-hoje-*`, testes dock/rolagem/rotas                     |
| Captura        | Seek circular expande para campo com foco imediato; Enter encaminha texto à palette original; Escape conserva rascunho      | `redesign-9a-after-seek.png`, testes Seek e Ctrl/Cmd+K                    |
| Hoje           | Prioridades dominantes, compromisso/meta em coluna complementar, hábitos abaixo; organização personalizada mantém ordem DOM | `redesign-9a-after-hoje-*`, testes antigos de widgets e Hoje              |
| Tarefas        | Captura compacta, toolbar, agrupamentos por prazo, menus por teclado; Lista/Kanban/Tabela/Calendário preservados            | Quatro conjuntos `redesign-9a-after-tarefas-*`                            |
| Hábitos        | Registro em lista, heatmap com respiro e linguagem “Comece hoje” para sequência zero                                        | `redesign-9a-after-habitos-*`, registros/tooltip/alternativa textual      |
| Notas          | Coleção e leitura em desktop; etapas no mobile; editor lazy, preview contextual e importação Markdown preservados           | `redesign-9a-after-notas-*`, editor/preview/import extras                 |
| Metas/projetos | Segmentos Tudo/Metas/Projetos e detalhes por seção, sem duplicar entidades ou progresso                                     | `redesign-9a-after-metas-*`, testes de vínculos/progresso                 |
| Estudos        | Próximo prazo e próxima etapa em primeiro plano; flashcards ao lado em desktop; coleções abaixo                             | `redesign-9a-after-estudos-*`, flashcard extra, testes de avaliações/SM-2 |
| Foco           | Cronômetro central, números tabulares, modos segmentados, escolha da tarefa por menu                                        | `redesign-9a-after-foco-*`, testes de timestamps/refresh/Space/Escape     |
| Perfil         | Cabeçalho central em desktop e alinhado em compacto; métricas em faixa; dados locais/atividade/pins preservados             | `redesign-9a-after-perfil-*`, testes anteriores de perfil/backup          |
| Preferências   | Grupos editoriais e campos em duas colunas quando há espaço, uma coluna em compacto                                         | `redesign-9a-after-preferencias-*`, preferências/limpeza forte/PWA        |
| Datas          | Popover ancorado em desktop e sheet inferior em mobile, reutilizando a grade e a lógica existentes                          | `redesign-9a-after-datepicker.png`, teste de teclado/foco/seleção         |
| Feedback       | Toasts no canto inferior direito, oito segundos com pausa em foco/hover/janela oculta; erros persistentes                   | testes com relógio controlado; undo ainda disponível em disclosures       |

## Acessibilidade: achados corrigidos

| Severidade / O quê                                                                     | Por quê                                                                                                           | Correção aplicada                                                                                                                      |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Crítico: controles compactos do cabeçalho podiam ter largura inferior a 44 px          | `accessibility.md > Mobility`: “Offer sufficiently sized controls.” O projeto exige 44×44 px em todos os tamanhos | Mínimos semânticos de largura/altura; medição dos controles visíveis no browser, incluindo texto 200%                                  |
| Crítico: montagem lazy de uma página podia tomar foco de um diálogo ou campo já em uso | `accessibility.md > Mobility` e `keyboards.md`; interrompia a captura e a mudança de aparência                    | PageHeader verifica foco atual; mantém foco em interação ativa e ainda foca o título em navegação normal; três testes unitários        |
| Crítico: pilha de feedback podia cobrir ações com texto ampliado                       | `accessibility.md > Vision`: “Support larger text sizes.”                                                         | Viewport dos toasts limitado entre dock e altura real do cabeçalho, medida por ResizeObserver; rolagem interna e teste 200%            |
| Alto: calendário lazy recebia teclas antes da célula pronta                            | Foco previsível é necessário para escolher uma data por teclado                                                   | Grid conserva célula ativa, Escape e retorno ao acionador; testes esperam o foco real antes de enviar teclas                           |
| Alto: feedback duradouro ocupava uma seção inteira de Hoje                             | `feedback.md > Best practices`: “Make sure all feedback is accessible.”                                           | Apresentação transitória com região anunciada, pausa durante interação e recuperação secundária; nenhuma alteração do registro de undo |

Contraste calculado a partir dos valores hex dos tokens, sem estimativa por screenshot: **36 pares opacos aprovados**, texto com mínimo **5,53:1**, contornos de controle com mínimo **4,21:1**. Fundos translúcidos e opções de acento também são exercitados com Axe. Fonte: `contrast-redesign-9a.json`.

## Convenções e craft

`layout.md > Visual hierarchy`: “Group related items” fundamenta a separação por espaço e divisores, com duas colunas apenas quando ajudam a leitura. `materials.md > Liquid Glass`: “Don't use Liquid Glass in the content layer.” fundamenta editor, listas e textos sobre superfícies sólidas. `motion.md > Providing feedback`: “Aim for brevity and precision in feedback animations.” fundamenta microtransições canceláveis e o respeito às preferências de movimento.

O dock usa links de navegação, com indicação de destino atual. Em mobile são cinco controles no total: Hoje, Tarefas, Hábitos, Perfil e Mais. A escolha de Mais e do dock também no desktop é uma adaptação solicitada pelo usuário, não uma alegação de conformidade literal com a navegação nativa Apple.

Acessório removido: repetição de Perfil e Preferências no rodapé. A captura global ganhou uma entrada contextual, sem um parser paralelo ou mudança da command palette. Leitura longa e metadados têm hierarquia distinta; tons neutros e hairlines mantêm o heatmap como peça característica. O título do Perfil recebe alinhamento explícito após limitar a largura do foco de h1.

## O que preservar

- Repositories, IndexedDB, IDs, relacionamentos e backups originais.
- Ordem de widgets definida pelo usuário e DOM coerente com essa ordem.
- Editor simples, Markdown sanitizado, links internos e preview sob demanda de 600 ms.
- Confirmações com Cancelar inicial, Escape e desfazer; limpeza total com confirmação forte.
- SM-2 e timer por timestamps, incluindo recuperação e estado interrompido.
- Lazy loading das rotas, preview, editor, Tabela, Kanban, Calendário e data picker; precache PWA.
- Movimento e transparência reduzidos, foco visível e alternativas por teclado ao arraste.

## Antes e depois

![Antes: visão desktop](screenshots/redesign-9a-before-overview.png)

![Depois: visão desktop](screenshots/redesign-9a-after-overview.png)

![Depois: visão mobile](screenshots/redesign-9a-after-mobile-overview.png)

![Captura Seek](screenshots/redesign-9a-after-seek.png)

![Notas em leitura e edição](screenshots/redesign-9a-after-editor-1280.png)

## Limitações e próximos passos

- O portfólio local na porta 4173 recusou conexão. A direção monocromática foi baseada no briefing e nos materiais fornecidos; não houve comparação visual direta com esse servidor.
- Alguns campos secundários de configuração/formulários continuam usando select nativo. Os controles das listas, filtros/captura de tarefas e modo Foco foram adaptados; uma uniformização adicional deve conservar a semântica e não exige mudar dados.
- Axe, teclado e screenshots não substituem testes físicos com tecnologias assistivas. Recomenda-se NVDA/VoiceOver e instalação em dispositivos reais na etapa 9B.
- Os relatórios Lighthouse e a matriz comprovam os cenários locais medidos; não são uma medição de rede pública, hardware móvel real ou garantia de pontuação constante.
- Recomendo iniciar a etapa 9B de auditoria geral, usando esta revisão e os relatórios como ponto de partida, com atenção aos dispositivos reais e leitores de tela ainda não exercitados.

## Validação final e commits

`npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` passaram, sem warnings de produção. A suíte unitária passou com **825 testes em 64 arquivos** (antes: 812/59); o E2E final passou com **97/97 casos**, em 10,4 minutos (antes: 91). Nenhum caso foi removido ou marcado como skip. Os testes antigos foram adaptados somente aos controles reais e aos estados lazy, preservando as asserções de dados, persistência, geometria, acessibilidade e foco.

Axe: zero violações nas 96 combinações da matriz, nos fluxos alterados exercitados pelos testes e nas duas capturas adicionais de feedback. Texto 200% em 375/768/1280, claro/escuro, movimento e transparência reduzidos; matriz visual inclui também 1440. A recarga offline foi exercitada com service worker real, dados persistentes e componentes/rotas não visitados previamente.

Uma rodada anterior teve 96 casos aprovados e um erro de arquivo de service worker durante recompilação concorrente. Não foi considerada aprovação nem houve redução de asserções: a rodada final manteve dist estável e todos os 97 casos passaram. As evidências antigas geradas pelas suítes são preservadas no histórico; as capturas novas usam o prefixo redesign-9a.

Veja também `PERFORMANCE-REDESIGN-9A.md`, `validation-redesign-9a.json` e `VISUAL-AUDIT-9A.md`.

Performance medida: **91 no primeiro acesso, 100 no retorno**, acessibilidade 100 em ambos e nenhum aviso. Antes do rebuild: 73 no primeiro acesso; etapa 8: 67. Bundle total +1,52%, transferência fria +0,93%, sem dependências novas. A screenshot final do Lighthouse foi inspecionada e mostra Hoje pronto. O relatório de performance contém método, métricas completas e limites.

Commits do rebuild, em ordem:

1. `9354b04` — `chore: audita inconsistências visuais do Atlas`
2. `4225c54` — `style: consolida tokens e primitives do design system`
3. `cc191a2` — `style: refaz layout e hierarquia das telas principais`
4. `a204f83` — `style: refina tarefas hábitos e notas para experiência premium`
5. `2f0e4f1` — `style: refina metas estudos foco perfil e preferências`
6. `82bd257` — `feat: aprimora motion feedback e estados de interface`
7. `78dabf4` — `fix: corrige responsividade acessibilidade e detalhes visuais`
8. `ab59e53` — `test: valida fluxos e componentes do redesign`
9. `docs: documenta sistema visual e revisão do redesign`

Lint, typecheck, suíte unitária e build são executados antes de cada commit. O hash do nono commit pode ser consultado no histórico Git; ele contém este relatório.
