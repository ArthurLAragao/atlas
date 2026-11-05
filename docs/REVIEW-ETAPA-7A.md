# Revisão de design — etapa 7A

## Síntese

Aplicação web React para organização pessoal e estudos. Tese: conectar uma intenção a medidas e próximos passos em uma página de leitura, com listas e detalhes sob demanda. A identidade editorial permanece nas proporções, tipografia e ritmo; o heatmap continua sendo a assinatura do Atlas. Revisão com a skill apple-design: acessibilidade, plataforma, craft, interação e conteúdo, nesta ordem.

Avaliação: **Boa**, após as correções abaixo. Evidência: fontes, tokens reais, testes de browser em contextos descartáveis e screenshots. Os princípios HIG se aplicam à web; menus nativos do macOS e Dynamic Type são traduzidos para controles HTML/ARIA, teclado, reflow e tamanho de texto. Não houve teste com leitor de tela real nem medição Lighthouse nesta etapa.

## Acessibilidade

- **[Crítico, corrigido] O quê:** texto contínuo válido em título/unidade/tag de resultado-chave poderia ultrapassar 375 px.
  **Por quê:** `layout.md > Adaptability`: “Be prepared for text-size changes.” A leitura precisa sobreviver a largura pequena e texto ampliado.
  **Correção:** `overflow-wrap:anywhere`, campos com largura mínima zero e colunas que empilham. Stress de título com 240 caracteres contínuos, unidade 40 e tag 60; matriz 375/768/1280 px, claro/escuro, detalhe e formulário com texto a 200%.
- **[Crítico, corrigido] O quê:** abrir o registro recuperado quando ele já estava na rota mantinha foco no link em vez do título; confirmação tardia de formulário fechado poderia roubar navegação/foco.
  **Por quê:** `accessibility.md > Vision`: “Describe your app's interface and content for VoiceOver.” `undo-and-redo.md > Best practices`: “Show the results of an undo or redo.”
  **Correção:** foco explícito no título ao abrir a recuperação; guard de formulário montado antes dos callbacks. Sheets usam Radix, Escape, Tab/Shift+Tab e retorno ao acionador. Salvar foca o título; arquivar foca Desarquivar; excluir volta à lista; desfazer foca o link de recuperação. Testes de teclado e de gravação pendente cobrem esses caminhos.

Contraste calculado dos valores em `tokens.css`, sem estimar pelos PNGs. Razões mínimas contra bg/surface/surface-elevated:

| Papel                        |  Escuro |   Claro | Exigência usada |
| ---------------------------- | ------: | ------: | --------------: |
| Texto principal              | 13,52:1 | 15,22:1 |           4,5:1 |
| Texto secundário             |  6,59:1 |  5,53:1 |           4,5:1 |
| Destaque azul / links / foco |  8,57:1 |  6,02:1 |     4,5:1 texto |
| Erro                         |  8,96:1 |  5,96:1 |           4,5:1 |
| Borda de controle            |  4,10:1 |  4,42:1 |             3:1 |

`accessibility.md > Vision`: “Strive to meet color contrast minimum standards.” Estados e progresso possuem texto, números e rótulos de `<progress>`, independentes da cor. Botões/campos/links acionáveis têm região de 44 px; checkbox usa o label como região de toque. Estilos existentes respondem a reduced motion, reduced transparency e contraste aumentado; não foram acrescentadas animações obrigatórias.

## Plataforma e craft

- **[Médio, corrigido] O quê:** metas e projetos ainda estavam no placeholder genérico e não mostravam uma intenção conectada às ações.
  **Por quê:** `lists-and-tables.md > Best practices`: “Prefer displaying text in a list or table.” `layout.md > Visual hierarchy`: “Use progressive disclosure to make layouts cleaner and easier to interact with.”
  **Correção:** lista editorial → detalhe com título, medidas/próximos passos, relações e descrição sob demanda. Uma rota existente, sem dashboard adicional; listas extensas virtualizadas e relações paginadas com teclado.
- **[Médio, corrigido] O quê:** a edição semanal antiga inferia escolha por data e acrescentava domingo a uma meta existente sem prazo.
  **Por quê:** julgamento de produto: o usuário controla qual intenção deve acompanhar nesta semana; nenhuma referência HIG determina essa regra de negócio.
  **Correção:** seleção explícita exclusiva, preservação do prazo e estado vazio útil no Hoje. A média dos resultados-chave e a barra de tarefas permanecem separadas.

`liquid-glass.md > The two layers`: “never Liquid Glass” no conteúdo. Conteúdo e formulários têm fundo sólido; vidro fica na navegação e cabeçalho de sheet. Leitura limitada a 42 rem; números tabulares, escala semântica e uma ação principal em cada formulário. A utilidade calma é intencional; não há decoração competindo com a leitura.

## Interação e conteúdo

- **[Alto, corrigido] O quê:** URL incompleta podia lançar exceção em vez de exibir orientação; prazo com ano zero passava pela importação e falhava no detalhe.
  **Por quê:** `text-fields.md > Best practices`: “Validate fields when it makes sense.” O erro deve indicar uma correção e manter o texto.
  **Correção:** validação segura de URL http/https e datas consistentes; formulário conserva conteúdo e permite retentar. Regressões de modelo, importação e browser.
- **[Médio, corrigido] O quê:** valores como 0,0001 eram mostrados como zero e valores perto do alvo podiam aparecer como já atingidos.
  **Por quê:** julgamento de produto: precisão da medida manual é parte do significado, não um detalhe visual.
  **Correção:** formatação com até 21 dígitos significativos. Valor atual/alvo reais e contagem atingida acompanham o percentual inteiro aproximado.
- **[Médio, corrigido] O quê:** vazio de vínculo usava gênero incorreto para projeto e novos links não recebiam foco.
  **Por quê:** julgamento de conteúdo, mantendo ações diretas e sem jargão.
  **Correção:** “Ainda não há registros vinculados. Escolha um registro existente para conectar.” Adicionar link foca o novo título; adicionar resultado foca seu título. Erros indicam como corrigir e preservam o formulário.
- **[Alto, corrigido] O quê:** limpeza automática de referências transformava exemplos em pessoais; restauração de projeto invalidava histórico anterior da nota apenas pelo token de versão.
  **Por quê:** `undo-and-redo.md > Best practices`: “Help people predict the results of undo and redo as much as possible.”
  **Correção:** preservar a origem dos exemplos na limpeza; deltas transacionais e rebase conservador quando a versão esperada era exatamente a restaurada. Edição posterior continua protegida contra sobrescrita. Desfazer explicita a ação e mostra o registro recuperado, inclusive após recarregar.

## Verificação e limites

Resultado de fechamento em 2026-10-02:

| Comando             | Resultado                                                         |
| ------------------- | ----------------------------------------------------------------- |
| `npm run lint`      | Sem erros ou warnings                                             |
| `npm run typecheck` | Sem erros                                                         |
| `npm run test`      | 561 testes, 33 arquivos, todos aprovados                          |
| `npm run build`     | Aprovado, sem warnings                                            |
| `npm run test:e2e`  | 49 testes aprovados, suíte completa no build de produção, 3,8 min |

Todos os 400 testes unitários e 38 E2E anteriores foram preservados; a etapa acrescenta 161 testes unitários e 11 E2E. A primeira execução completa identificou duas expectativas antigas do Hoje; asserções e preparação foram atualizadas para a escolha explícita/prazo preservado, e a execução completa seguinte passou. O novo teste de criação semanal mantém a cobertura do domingo sugerido.

A conferência após formatação encontrou um timeout intermitente no teste antigo de navegação, que passou isolado. A suíte usa no máximo quatro workers para reduzir a disputa de recursos dos jsdom; nenhum teste, asserção ou timeout foi removido/relaxado.

As 36 screenshots novas cobrem duas telas, três larguras, dois temas e texto a 200%; testes axe não encontraram violações nas telas/sheets verificadas. As verificações incluem foco/teclado, ausência de overflow, texto contínuo, 210 itens, gravações tardias, valores fracionários, falha recuperável de URL e restauração completa dos backups JSON/Markdown em IndexedDB real. Contextos de testes são descartáveis, sem limpar o banco do usuário. O runner Node emitiu apenas aviso de ambiente sobre NO_COLOR/FORCE_COLOR; não houve erros de console da aplicação nos fluxos monitorados.

Fora da etapa: Estudos, Pomodoro, IA, grafo, integrações, nuvem, login e gamificação. Redo e histórico unificado permanecem documentados como evolução. Leitor de tela real e Lighthouse continuam como limitações da auditoria, sem pontuações inventadas.
