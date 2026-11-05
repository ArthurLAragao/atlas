# Revisão de design — etapa 5

Revisão em 2026-10-02, com a skill apple-design. Plataforma: aplicação web React responsiva, destinada ao uso pessoal de estudo e software. Avaliação: **Bom**, após as correções abaixo. Hoje apresenta poucos próximos passos em listas, com hierarquia editorial; o heatmap continua sendo a assinatura de Hábitos.

Artefatos: código, tokens reais, testes de navegador e capturas de Hoje/captura em 375, 768 e 1280 px. Aplicam-se os fundamentos do HIG, traduzidos para a web; não se exige menu nativo do macOS. A revisão integral dos módulos será feita na etapa 9.

Referências lidas por `references/hig-lookup.md`: accessibility, layout, typography, color, designing-for-macos, cross-platform, searching, search-fields, keyboards, sheets, toolbars, feedback e liquid-glass. Formulários também consultaram text-fields e pickers. Caminhos abaixo são relativos a `.agents/skills/apple-design/references`.

## Acessibilidade — corrigido

### Crítica: título de sheet a 200%

- **O quê:** o título do compromisso podia transbordar num celular de 375 px com texto a 200%, disputando espaço com Fechar.
- **Por quê:** `hig/accessibility.md > Vision`: “Support larger text sizes”; `hig/layout.md > Adaptability` exige acomodar mudanças de tamanho do texto.
- **Correção:** permitir redução e quebra do título, manter o botão de fechamento com seu alvo intacto. Teste de 375 px/200% verifica ausência de overflow nas sheets de compromisso, meta e captura.

### Alta: foco após uma ação que remove a linha

- **O quê:** adiar ou concluir uma pendência podia desmontar o elemento focado. Navegar pela palette também precisava mover o foco para a nova tela.
- **Por quê:** `hig/accessibility.md > Speech`: “Let people use the keyboard alone”; `hig/keyboards.md > Best practices` orienta acesso consistente às ações.
- **Correção:** restaurar foco na linha quando ela permanece, em Nova tarefa quando sai da lista e no acionador do compromisso após concluí-lo. Navegação pela palette foca o título da rota. Escape restaura o acionador; Tab fica dentro do diálogo.

Contraste calculado a partir dos tokens, sem estimar por imagem:

| Par                                   |  Escuro |   Claro |
| ------------------------------------- | ------: | ------: |
| Texto principal / fundo               | 16,46:1 | 16,33:1 |
| Texto secundário / superfície         |  7,42:1 |  5,53:1 |
| Texto secundário / superfície elevada |  6,59:1 |  6,19:1 |
| Destaque azul / fundo                 | 10,44:1 |  6,45:1 |

São superiores a 4,5:1 para texto comum (`hig/accessibility.md > Vision`). Progresso usa números e label; estado das tarefas tem controle textual. Controles mantêm alvos de 44 px, foco visível e nomes acessíveis. Redução de movimento permanece global; transparência tem fallback sólido pela preferência do sistema e opção manual.

## Plataforma e interação — corrigido

### Alta: erro depois de fechar a captura

- **O quê:** uma gravação pendente podia falhar depois de Escape, deixando o aviso dentro de uma palette já fechada.
- **Por quê:** `hig/feedback.md > Best practices`: “Make sure all feedback is accessible”; recuperação também expressa Agency em `hig/design-principles.md`.
- **Correção:** aviso global acessível com Tentar captura novamente, preservando o texto original. Rollback da operação otimista e bloqueio de envio duplicado. Testes de store e componente cobrem falha com a caixa fechada e recuperação. Avisos ficam disponíveis até serem dispensados.

### Alta: leitura posterior confundida com falha ao gravar

- **O quê:** se `save` confirmasse e a leitura seguinte falhasse, a UI poderia anunciar falha mesmo com o registro salvo. Repetir a captura criaria outro ID.
- **Por quê:** `hig/feedback.md > Best practices` orienta informar o resultado verdadeiro de uma ação; integridade transacional é também julgamento de engenharia.
- **Correção:** captura e meta aplicam a entidade devolvida por `save`, sem depender de `snapshot` posterior. Testes verificam metadados confirmados, uma única escrita e ausência da segunda leitura.

### Média: compromissos vencidos no mesmo dia

- **O quê:** ao passar o horário, um compromisso pendente saía do próximo compromisso e só reaparecia nas pendências no dia seguinte. A tag sem horário também podia ocultar a tarefa do dia.
- **Por quê:** `hig/layout.md > Visual hierarchy`: “Order content by relative importance”; manter pendências recuperáveis é uma decisão de produto.
- **Correção:** horários passados de hoje entram em Revisar pendências; compromissos sem horário ficam nas tarefas do dia. Não alterar datas, duplicar o próximo compromisso ou incluir concluídos na revisão. Cobertura pura e de navegador.

### Média: captura e navegação disputando intenção

- **O quê:** comandos iguais a nomes de telas e atalhos internos do cmdk poderiam produzir uma ação inesperada.
- **Por quê:** `hig/keyboards.md > Best practices` e `hig/searching.md > Best practices` favorecem comandos previsíveis. A sintaxe específica é uma decisão de produto.
- **Correção:** prévia da entidade, prefixos `tarefa:`, `nota:` e `hábito:`, navegação explícita por `/rota`, `ir tela` ou nome exato. Desativar os vimBindings do cmdk para Ctrl+K manter sua função global. Atalhos respeitam digitação, composição IME e outras sheets; uma gravação antiga não apaga uma caixa reaberta.

## Craft e conteúdo

- **O quê:** evitar sobrecarga em Hoje e manter o significado das ações visível.
- **Por quê:** `hig/layout.md > Visual hierarchy`, `hig/typography.md > Conveying hierarchy` e `hig/liquid-glass.md > Where the material belongs`: “Don't use Liquid Glass in the content layer.”
- **Correção:** listas e seções sólidas, poucas ações, contador e aviso gentil acima de três tarefas, progresso nativo com texto, exemplos identificados. Vidro só na navegação e diálogos. Mesmos tokens e ícones das etapas anteriores.
- Compromisso é tarefa com tag; meta semanal é Goal com prazo. Ambos entram no backup e preservam IDs/vínculos. Não criar um sexto tipo de conteúdo. Decisão de arquitetura registrada em `DECISIONS.md`.

## Verificação e limites

- `npm run lint`: aprovado, sem warnings.
- `npm run typecheck`: aprovado. Corrigidas as duas asserções de mocks genéricos que acessavam `title` sem distinguir HabitLog.
- `npm run test`: **266 testes / 17 arquivos aprovados**.
- `npm run build`: aprovado, sem warnings, Vite 8.3.1. Palette e ajuda permanecem em chunks carregados ao abrir.
- `ATLAS_TEST_URL=http://127.0.0.1:4180 npm run test:e2e`: **27 aprovados / 1 falha inicial**. O teste antigo de backup procurava uma nota em Hoje. Corrigido para visitar Notas, mantendo as verificações de conteúdo, contagens e persistência; reexecução desse teste aprovada. **Todos os 28 fluxos validados**, incluindo oito de Hoje/captura/atalhos e ida e volta completa de JSON/Markdown após esvaziar o IndexedDB.
- Axe sem violações nos estados auditados de Hoje, captura, ajuda e formulários; console de erro limpo. Layouts de 375, 768 e 1280 px nos dois temas, texto de 200%, foco/teclado e fallback sólido verificados. Seis screenshots em `docs/screenshots/etapa-5-*`.
- `git diff --check`: aprovado.

Os testes de browser usam contextos descartáveis; não limpam os dados do perfil pessoal. A mensagem de ambiente Playwright sobre NO_COLOR/FORCE_COLOR não é warning do app; a reexecução remove a variável conflitante.

Não declarar Lighthouse, leitor de tela manual, PWA com recarga offline ou deploy nesta etapa. Axe e testes de foco dão evidência automatizada, sem substituir a auditoria humana integral. Notas completas, busca de conteúdo, metas/projetos completos e Pomodoro seguem o plano das próximas etapas.
