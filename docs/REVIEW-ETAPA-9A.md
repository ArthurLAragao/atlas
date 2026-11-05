# Design review: Atlas — espaço pessoal e acabamento

## Resumo e escopo

Revisão específica com a skill apple-design, em 2026-10-03/04, na ordem acessibilidade, plataforma, acabamento, interação e conteúdo. Resultado: **Good**. Tese: um centro de comando pessoal, silencioso e preciso; o perfil reúne progresso real, enquanto a captura contextual deixa a página pronta para agir sem ocupar a leitura.

Esta é a etapa **9A**, não a auditoria integral 9B. Foram preservados os módulos, repositories, relacionamentos por ID, parsers, command palette global e testes anteriores. HIG aplicado como princípios de clareza, agência e acessibilidade para React/web; convenções nativas do macOS/iOS não são requisitos desta aplicação.

Antes da implementação foram lidos AGENTS.md, PLAN.md, DECISIONS.md, os relatórios/Lighthouse da etapa 8, SKILL.md e hig-lookup. Referências relevantes: design-principles, accessibility, layout, typography, color, dark-mode, materials, liquid-glass, motion, feedback, keyboards, sheets, lists-and-tables, search-fields, searching, text-fields, pickers, sidebars, tab-bars, toolbars, alerts, popovers e undo-and-redo, além da tradução cross-platform. O catálogo não contém arquivos separados calendars/search/navigation: o roteamento está explicado em PLAN-ETAPA-9A.md.

A revisão de plataforma também consultou designing-for-ios.md e designing-for-macos.md: alcance confortável no mobile, densidade adaptável, entrada precisa e atalhos no desktop. As seis rotas principais permanecem na navegação; Perfil/Preferências são secundárias. A web mantém seus controles de janela/navegador, sem imitar menus ou chrome nativos.

## O que mudou

- **Perfil local:** rota lazy `/perfil`, avatar opcional convertido localmente, nome/identificador/frase, quatro métricas com descrições, heatmap de atividade de 13/26/52 semanas, alternativa textual completa, últimos dez eventos com filtros e até três projetos/metas/trilhas fixados por ID. Perfil e histórico confiável entram no backup JSON e na limpeza total.
- **Linguagem visual:** cinzas profundos, superfícies sólidas, divisórias finas, raios de 14/18 px, títulos editoriais e respiro; Hoje passa a usar seções em vez de caixas repetidas. Cor de destaque continua funcional. Vidro fica na navegação e camadas transitórias.
- **Notas:** prévia mouse fino após 600 ms, recorte de 1.200 caracteres, miniatura tipográfica local, acompanhamento suave e limite da viewport. Rolagem, seleção, arraste e saída cancelam; botão equivalente abre uma sheet por teclado/touch. Renderer e conteúdo são carregados sob demanda.
- **Captura contextual:** Tarefas e Notas começam compactas, expandem com foco imediato, permitem limpar e pedem confirmação para descartar texto pelo Escape. Parser, repetição e contexto continuam disponíveis. Enter na nota abre a edição; Ctrl/Cmd+K permanece inalterado.
- **Tarefas:** quarta visão Tabela, contagens reais e filtros compostos, relações navegáveis, região de rolagem rotulada e paginação de 200 registros. Lista/virtualização, Kanban e Calendário permanecem; Kanban ganha criação por coluna e mantém mudança de situação por teclado.
- **Datas e confirmação:** DateField compartilhado com calendário PT-BR lazy, setas/Home/End/Page Up/Down, Hoje e seleção acessível. Exclusões comuns, inclusive avaliações, entregas, etapas e registros de hábito, confirmam com Cancelar focado e conservam o desfazer existente. A limpeza total mantém frase/checkbox fortes e oferece backup dentro da confirmação.
- **Markdown local:** dropzone em Notas e Dados, até 20 arquivos, 1 MB por arquivo/10 MB por lote; UTF-8, frontmatter simples, fallback de título, validação, prévia limitada, descarte, duplicatas ignoradas ou importadas como cópia e confirmação explícita. Nenhum conteúdo vai para servidor. JSON aceita até 50 MB para restaurar lotes grandes; Markdown legado conserva 5 MB.

Decisões detalhadas em [DECISIONS.md](DECISIONS.md), seções 009A.1–7. Não foram adicionadas dependências, imagens externas, login, backend, grafo, IA, notificações ou integrações.

## Acessibilidade — achados corrigidos

- **[Critical] O quê:** a interpolação independente de texto e fundo durante a troca de tema produziu contraste transitório de 4,28:1 nos botões do rodapé, detectado pela regressão Axe.
  **Por quê:** `accessibility.md > Vision`: “Strive to meet color contrast minimum standards.” O contraste precisa permanecer legível durante a interação, não apenas nos tokens finais.
  **Correção:** texto e fundo passam diretamente aos tokens do tema; transições de sombra, borda e pressed preservam o feedback. Nenhuma espera ou exclusão de regra foi adicionada ao teste para ocultar a falha.
- **[Critical] O quê:** o textbox da captura recebeu `aria-expanded`, atributo não permitido para esse papel; Axe identificou a falha.
  **Por quê:** `accessibility.md > Vision` orienta descrição consistente dos controles; a regra concreta de ARIA é verificada pelo Axe.
  **Correção:** expansão pertence ao botão nomeado, com `aria-expanded` e `aria-controls`; o input continua expandindo ao receber foco. Conteúdo recolhido fica inert e fora da leitura assistiva.
- **[Critical] O quê:** o nome acessível do link de perfil não coincidia com a concatenação do nome/frase visíveis, prejudicando comandos de voz.
  **Por quê:** WCAG 2.5.3, detectada pela regra experimental Label in Name já existente; `accessibility.md > Vision` exige uma interface reconhecível pela descrição.
  **Correção:** o link usa o nome nativo de seu texto, sem override ARIA. No modo recolhido, nome/frase ficam visualmente recortados, preservados na árvore acessível. “Abrir meu perfil” é título auxiliar. O teste antigo permanece integral e ganhou uma asserção para o modo recolhido.
- **[Critical] O quê:** cópias temporárias de uma tarefa na saída animada do Kanban podiam receber foco após mudar de coluna.
  **Por quê:** `accessibility.md > Mobility` orienta acesso por teclado; `lists-and-tables.md > Best practices`: “Provide appropriate feedback when people select a list item.”
  **Correção:** linhas em saída ficam inert, aria-hidden e sem o identificador usado para recuperar foco. Foco vai ao item atual ou à criação quando o filtro o remove.
- **[Critical] O quê:** previews apenas por hover, arraste exclusivo ou datas sinalizadas só por cor excluiriam pessoas com outras formas de entrada.
  **Por quê:** `accessibility.md > Vision`: “Convey information with more than color alone.”
  **Correção:** Prévia explícita, situação por select no Kanban, filtros nomeados, grade de datas com seleção textual/ARIA, heatmap com descrições completas e navegação por setas/texto. Alvos de controles preservam 44 px.
- **[Critical] O quê:** ampliar texto poderia comprimir tabela, datas ou formulários.
  **Por quê:** `accessibility.md > Vision`: “Support larger text sizes.”
  **Correção:** texto a 200%, larguras de 375/768/1280 px, rolagem interna explícita onde necessária, campos flexíveis e sem overflow da página. Em larguras estreitas, Prévia fica depois do texto da nota em vez de reservar uma coluna que comprimia o título ampliado; o título da sheet usa o papel headline no mobile, ainda ampliável. Verificações de Axe e layout nos temas claro/escuro.
- **[Critical] O quê:** exclusão imediata e confirmação com foco destrutivo poderiam apagar conteúdo por engano.
  **Por quê:** `alerts.md > Best practices` distingue destruição importante; o usuário exige confirmação mesmo para ações com desfazer, prevalecendo sobre a preferência geral do HIG por undo sem alerta.
  **Correção:** Cancelar inicia focado, Escape devolve foco, Enter em Cancelar não exclui, persistência/undo conservam vínculos. Limpeza total exige APAGAR TUDO e ciência da perda, sem promessa falsa de desfazer.

## Plataforma e interação — achados corrigidos

- **[High] O quê:** o primeiro acesso da revisão caiu para 57 no Lighthouse, com 39 requisições e LCP de 9,01 s.
  **Por quê:** clareza também depende de resposta rápida; responsabilidade e simplicidade em `design-principles.md`. O diagnóstico de waterfall é julgamento de engenharia, não um limite numérico do HIG.
  **Correção:** agrupar a cadeia estática de Hoje e o núcleo, mantendo módulos opcionais dinâmicos; eliminar uma importação dinâmica ineficaz sem suprimir warnings. Coleta fria válida, aguardando pintura: 73, 13 requisições e LCP de 4,14 s. A meta acima de 90 ainda exige trabalho. Relatórios antes/depois preservados.
- **[High] O quê:** fixados cujo registro fosse removido poderiam ficar invisíveis, consumindo um dos três lugares.
  **Por quê:** agência e recuperação, conforme `design-principles.md`; o detalhe de referências preservadas é julgamento de arquitetura.
  **Correção:** referências permanecem para reaparecer com o desfazer; o perfil apresenta “indisponível” e permite desafixar. Repository e browser cobrem remoção de exemplos e retirada da referência.
- **[Medium] O quê:** rolar uma página sem deslocamento não disparava scroll e deixava a prévia flutuante aberta.
  **Por quê:** `motion.md > Best practices`: “Add motion purposefully, supporting the experience without overshadowing it.”
  **Correção:** wheel também cancela a intenção/prévia; timers e RAF são limpos ao sair e desmontar. Testes fake timers e browser cobrem atraso e cancelamento.
- **[Medium] O quê:** uma mudança de tarefa poderia perder foco ou animar centenas de elementos.
  **Por quê:** `motion.md > Providing feedback`: “Aim for brevity and precision in feedback animations.”
  **Correção:** feedback de check/estado não espera gravação; falha reverte e permite repetir. Presença animada fica restrita a listas pequenas, virtualização existente permanece, e movimento reduzido desliga as transições.
- **[Medium] O quê:** conflito de importação poderia sobrescrever notas ou deixar lote parcialmente salvo.
  **Por quê:** responsabilidade e agência em `design-principles.md`, feedback contextual em `feedback.md`.
  **Correção:** transação revalida IDs e conteúdo; usuário escolhe ignorar ou criar cópias. Sem sobrescrita silenciosa. Testes verificam cancelamento, duplicatas, falhas, recarga e inclusão no backup.

## Acabamento e conteúdo

- **[Medium] O quê:** muitas caixas competiam com a prioridade da página; aplicar vidro ao editor ou à tabela prejudicaria a leitura.
  **Por quê:** `liquid-glass.md > Where the material belongs`: “Don't use Liquid Glass in the content layer.”
  **Correção:** seções sólidas, divisores e largura editorial; blur restrito a navegação/camadas funcionais, com fallback opaco. Hierarquia vem de tipografia e espaço, não de decoração.
- **[Medium] O quê:** a barra nativa dos fixados destoava dos indicadores do Atlas.
  **Por quê:** consistência visual e cuidado com detalhes em `design-principles.md`; escolha de acabamento.
  **Correção:** barra fina de tokens, porcentagem textual adjacente e semântica progress preservada.
- **[Low] O quê:** campos densos sem colunas claras ou estados vazios genéricos aumentam a procura.
  **Por quê:** `lists-and-tables.md > Content`: “Use descriptive column headings in a multicolumn table.”
  **Correção:** títulos de coluna reconhecíveis, contagens reais, situação com texto/ícone e convites concretos para anotar/fixar/importar. Atividade explica o que conta; não usa XP nem inventa datas antigas de tarefas.

O que preservar: monocromia, acento contido, botões com texto, foco visível, parsers existentes, leitura sólida, ações reversíveis, IDs como vínculos, próximo passo concreto e carregamento sob demanda. O perfil é sempre privado/local; a imagem de referência não forneceu dados reais ou métricas para preencher o aplicativo.

## Validação e performance

Lighthouse mobile local, com o throttling original da etapa 8 e perfil novo. O callback de navegação agora mantém o mesmo trace aberto até Hoje visível, dois frames e 1 s de rede ociosa; IndexedDB pode terminar depois do network quiet. A pintura final foi inspecionada. O critério de término mudou, portanto os números não representam uma repetição metodológica idêntica. A filmstrip da etapa 8 também mostra Hoje pronto. Primeiro acesso começa com caches/IndexedDB vazios; retorno é medido separadamente após preparar o app online. Não há alegação de auditoria integral ou de instalação física.

| Medida                                    |         Etapa 8 |           Etapa 9A final |
| ----------------------------------------- | --------------: | -----------------------: |
| Desempenho, primeiro acesso               |              67 |                   **73** |
| Desempenho, retorno preparado             |             100 |                  **100** |
| Acessibilidade Lighthouse                 |             100 |                  **100** |
| Boas práticas / SEO                       |        100 / 91 |                 100 / 91 |
| FCP, primeiro acesso                      |          3,07 s |                   2,86 s |
| LCP, primeiro acesso                      |          5,37 s |               **4,14 s** |
| Speed Index, primeiro acesso              |          8,56 s |                   9,53 s |
| TBT, primeiro acesso                      |           37 ms |                **89 ms** |
| CLS                                       |               0 |                        0 |
| Requisições observadas na navegação fria  |              31 |                   **13** |
| Transferência observada na navegação fria |   322.431 bytes |        **313.413 bytes** |
| Assets do build (JS/CSS)                  |              49 |                   **47** |
| Tamanho total dos assets, sem compressão  | 1.241.828 bytes | 1.315.248 bytes (+5,91%) |

O total do aplicativo cresceu com funcionalidades, mas a transferência inicial caiu 2,80%. FCP/LCP melhoraram nesta coleta; Speed Index e TBT pioraram, mostrando que a pintura inicial ainda merece trabalho. A pontuação não substitui a inspeção desses tempos. A primeira revisão mediu **57**, com 39 requisições e LCP de 9,01 s: a regressão foi tratada, não descartada. Grupos de build reúnem dependências estáticas do núcleo e de Hoje, evitando sucessivas filas de arquivos pequenos. React/router, storage e validation permanecem separados. Perfil, formulário de perfil, prévia de nota, renderer Markdown, Tabela, DatePicker, importador e command palette continuam dinâmicos. Nenhuma dependência foi adicionada. O precache cobre todos os chunks (62 entradas, 1.330,26 KiB).

Duas coletas intermediárias foram **invalidadas** após inspeção da captura: [90, abertura dos dados](lighthouse-stage9a-incomplete-startup.report.html) e [85, fallback da rota](lighthouse-stage9a-before-paint-guard.report.html). O commit de testes citou 90 antes dessa verificação; esta revisão corrige a conclusão. A medição válida de 73 inclui Hoje pronto, não uma tela de espera. Não foi alterado o throttling ou preparado o banco antes da navegação fria. A meta acima de 90 permanece pendente. Um timeout HTTP na preparação do retorno não produziu relatório e foi repetido em outro preview local do mesmo build. Uma coleta de retorno com frame inicial incompleto está preservada em [incomplete-return](lighthouse-stage9a-incomplete-return.report.html) e também foi excluída: preparar online e depois ir a about:blank antes do trace resolveu a composição inicial, mantendo caches/SW/IndexedDB. O retorno final de 100 mostra Hoje pronto na filmstrip.

Relatórios reais: [primeiro acesso](lighthouse-stage9a.report.html), [retorno](lighthouse-stage9a-return.report.html), [regressão antes da correção](lighthouse-stage9a-before-bundle-fix.report.html) e inventários [antes](bundle-stage9a-before.json)/[depois](bundle-stage9a-after.json). Lighthouse não reportou avisos nos cenários finais. Medição local única por build/cenário; variabilidade e validação no deploy permanecem relevantes.

Validação final do build:

| Verificação                             | Resultado                                         |
| --------------------------------------- | ------------------------------------------------- |
| `npm run lint`                          | aprovado                                          |
| `npm run typecheck`                     | aprovado, TypeScript estrito                      |
| `npm run test`                          | **812/812**, 59 arquivos, zero falhas             |
| `npm run build`                         | aprovado, sem warnings do app                     |
| `npm run test:e2e`                      | **91/91**, zero falhas, skips ou retries/flaky    |
| Capturas complementares com Axe         | **6/6**, zero violações                           |
| Contraste calculado a partir dos tokens | **90/90** pares; texto ≥5,53:1, controles ≥4,21:1 |

Os 757 testes unitários e 76 casos de browser anteriores foram preservados. Há mais 55 testes unitários e 15 casos de browser. As alterações nos testes antigos acrescentam a confirmação de exclusão ou consultam o ancestral semântico da nova linha de nota; preservam conteúdo, vínculos, persistência, posição 210 e recuperação. A sidebar ganhou uma asserção de nome acessível no modo recolhido. Nenhuma regra Axe foi excluída para fazer a suíte passar. Uma repetição encontrou três beforeAll de importação lazy acima de 10 s, antes de executar quatro casos; a tentativa com 30 s também falhou e foi revertida. A repetição usa um worker para reduzir contenção; os limites originais, asserções e tempos de interação/fake timers permanecem iguais. As falhas ficam em unit-stage9a-before-setup-fix.report.json e unit-stage9a-before-concurrency-fix.report.json; uma nova repetição serial ainda falhou na preparação e foi interrompida. Os mesmos preloads passaram à coleta estática do módulo; Hoje/Hábitos também são preparados nessa fase no teste de foco/navegação. Os oito casos e 33 asserções desses quatro arquivos continuam iguais; nenhum limite de interação mudou. A suíte final completa usa essa preparação; o carregamento lazy real permanece coberto pelo E2E de produção.

Os casos novos cobrem atividade/sequência/intensidade/deduplicação, avatar/perfil, fixados e referências indisponíveis, ida e volta do perfil após limpeza, atraso/cancelamento/limites da prévia, teclado/touch, parser/repetição, Tabela/filtros/contagens/paginação, conclusão nas quatro visões e Hoje, falha de persistência, confirmação e foco, importação válida/múltipla/sem título/inválida/grande/excessiva/duplicada/HTML ativo/cancelada, F5 e backup. A matriz inclui 375/768/1280 px, dois temas, texto a 200%, movimento e transparência reduzidos, calendário por teclado e Axe. Os testes do PWA anterior também passaram com o novo build.

Evidências: [unitários](unit-stage9a.report.json), [browser completo](e2e-stage9a.report.json), [Axe das capturas](axe-stage9a-captures.json), [contraste](contrast-stage9a.json) e [instalabilidade local](pwa-installability-stage9a.json). Aviso NO_COLOR/FORCE_COLOR do runner Playwright é de ambiente. Uma repetição do build emitiu PLUGIN_TIMINGS: callback closeBundle do PWA levou 49,3 s, após o bundle pronto em 9,4 s. É um diagnóstico de duração do gerador de SW, não de código/bundle ou execução do app; não foi suprimido. A verificação final salva o [log completo do build](build-stage9a.log). Relatórios das primeiras regressões Axe permanecem como before-contrast-fix/before-native-label-fix.

O teste adicional de offline prepara somente Preferências online, aguarda o SW, bloqueia a rede e então carrega/importa Markdown, abre prévia, cria tarefa com parser, abre Tabela/calendário, edita perfil, recarrega e exporta os registros. Os módulos sob demanda ainda não tinham sido abertos antes de cortar a conexão. A rodada individual está em [e2e-stage9a-offline.report.json](e2e-stage9a-offline.report.json); o caso também integra a rodada final completa. As regressões anteriores mantêm cobertura de todas as rotas offline, atualização real do SW, persistência, timer após refresh/segundo plano, virtualização e relacionamentos.

## Evidências visuais

- [Perfil com atividade e fixados, 1280 px](screenshots/etapa-9a-perfil-com-atividade-1280.png).
- [Perfil escuro, 375 px/texto 200%](screenshots/etapa-9a-perfil-dark-375.png).
- [Perfil claro, 768 px/texto 200%](screenshots/etapa-9a-perfil-light-768.png).
- [Tarefas, 375 px/texto 200%](screenshots/etapa-9a-tarefas-dark-375.png).
- [Importação Markdown, 375 px/texto 200%](screenshots/etapa-9a-markdown-dark-375.png).
- [Tabela, 1280 px](screenshots/etapa-9a-tabela-1280.png), [375 px](screenshots/etapa-9a-tabela-375.png) e [768 px](screenshots/etapa-9a-tabela-768.png).
- [Prévia por hover](screenshots/etapa-9a-hover-1280.png) e [ação equivalente](screenshots/etapa-9a-previa-1280.png).
- [Calendário mobile](screenshots/etapa-9a-datepicker-375.png) e [desktop](screenshots/etapa-9a-datepicker-1280.png).
- [Filmstrip fria válida](screenshots/etapa-9a-lighthouse-primeiro-acesso.jpg), [retorno válido](screenshots/etapa-9a-lighthouse-retorno.jpg) e [referência da etapa 8](screenshots/etapa-9a-referencia-lighthouse-etapa8.jpg).
- [Hoje escuro, 1280 px](screenshots/etapa-9a-hoje-1280-dark.png) e [375 px](screenshots/etapa-9a-hoje-375-dark.png).
- [Kanban, 375 px](screenshots/etapa-9a-kanban-375.png), [Calendário de tarefas, 768 px](screenshots/etapa-9a-calendario-768.png) e [texto longo em Notas, 375 px](screenshots/etapa-9a-notas-texto-longo-375.png).

As séries etapa-9a-perfil/tarefas/markdown incluem os dois temas e as três larguras. Screenshots de etapas anteriores não são substituídos por esta revisão.

## Limitações

- O portfólio em http://127.0.0.1:4173/ recusou conexão nas tentativas; a direção foi baseada na descrição, imagem e arquivos locais fornecidos, sem afirmar comparação visual direta com o site.
- Lighthouse de primeiro acesso 73: atende à restrição de não regredir dos 67 da etapa 8, mas ainda fica abaixo da meta acima de 90. Retomar waterfall, JavaScript inicial e tempo de pintura, sem contabilizar telas de espera como resultado final.
- Sem VoiceOver/NVDA, Safari/iOS, instalação no sistema operacional ou dispositivo touch físico. Axe, foco DOM e emulação no Edge não substituem essas verificações.
- Sheets preservam a arquitetura de montagem e usam fade na entrada; algumas saídas são imediatas. Uniformizar saída animada em todos os módulos é refinamento ainda pendente, sem atrasar ações ou persistência.
- O heatmap registra apenas ações reconstruíveis ou com evento confiável. Conclusões antigas sem data não recebem datas inventadas; dados de exemplo não entram. Revisões/hábitos contam uma vez por origem/dia. Limites e fórmula estão documentados.
- Frontmatter é intencionalmente simples, sem YAML genérico, imagens ou anexos. Bases acima de 50 MB exigem futura estratégia de streaming. Rascunhos/undo/preferências gerais não fazem parte do backup; perfil, fixados e atividade fazem.

## Commits

1. `5b78b34` — feat: adiciona perfil local e histórico de atividade.
2. `d8887d3` — style: refina linguagem visual premium do Atlas.
3. `8b2ab50` — feat: adiciona preview contextual de notas.
4. `fdaada1` — feat: refina captura rápida e visualização de tarefas.
5. `db93e17` — fix: aprimora calendário, data picker e microinterações.
6. `0d4c9c3` — feat: importa notas Markdown locais com validação e duplicatas.
7. `714fdf3` - test: cobre fluxos visuais e dados da etapa 9A.
8. `8b99d9e` - fix: valida medições de performance e estabiliza runner local.
9. `708a099` - test: estabiliza preparação dos fluxos da etapa 9A.
10. `docs: documenta revisão da etapa 9A` - commit final de documentação/evidências; hash consultável no histórico Git.

Lint, typecheck, test e build foram executados antes de cada commit. A importação Markdown recebeu um commit adicional para separar a Parte 7 da alteração visual. A rodada integral de E2E/Axe corresponde ao código do commit de testes; os commits seguintes ajustam apenas o auditor, a concorrência/preparação do runner local e documentação/evidências, mantendo os mesmos hashes dos assets medidos. Os commits finais de preparação e documentação compartilham a mesma verificação completa do conjunto final de arquivos; a documentação não altera o produto.

Recomendação: iniciar a **etapa 9B** como auditoria integral dos módulos e da experiência completa, usando estas evidências como base. Priorizar testes em leitor de tela/dispositivo real, revisão de saída das sheets, desempenho do primeiro acesso e validação do build hospedado na etapa 10. Esta revisão não iniciou a 9B nem publicou o app.
