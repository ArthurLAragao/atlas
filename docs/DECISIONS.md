# Decisões

## 007A — Metas e Projetos, 2026-10-02

- Evolução aditiva dos schemas: metas antigas sem estado são ativas; projetos antigos são planejados. Descrição da meta, unidade do resultado-chave e escolha semanal são opcionais em backups anteriores. Não criar coleções paralelas nem duplicar tarefas/notas.
- Progresso principal da meta é a média dos percentuais dos resultados-chave, com cada percentual limitado a 100%. Mostrar números atuais/alvos sem alterar os valores manuais, inclusive acima do alvo. Sem resultados-chave, informar que faltam medidas; tarefas vinculadas têm barra complementar separada. Estado concluído é uma escolha explícita, não altera resultados-chave.
- Relações existentes em `links[]` de ambos os lados contam uma única vez por ID. Novos vínculos ficam no registro que iniciou a relação; desvincular remove ambas as direções. Excluir uma meta/projeto retira referências e guarda deltas para desfazer transacional, recusando restaurar sobre registros alterados posteriormente.
- Meta semanal passa a ser uma escolha explícita `weekly`, exclusiva entre metas e preservada no backup. Hoje não infere intenção por prazo/criação e não seleciona exemplos sozinho. A função antiga de inferência semanal permanece como utilitário legado testado; o produto usa o seletor explícito novo. O formulário de Hoje mantém seus contratos e preserva os novos campos ao editar.
- `/metas` reúne listas e páginas de detalhe por `?goal=ID`/`?project=ID`, sem dashboard extra. A busca global e relações navegam pelos IDs. Mudanças em Hoje/Tarefas/Notas limitam-se à escolha semanal e navegação/vínculos; preservar testes e registrar adaptações de fixtures para exemplos novos e seleção explícita.
- `lists-and-tables.md > Best practices`: "Prefer displaying text in a list or table." `sheets.md > Best practices`: "Display only one sheet at a time". Criação curta; detalhes de descrição, tags e URLs sob demanda. `liquid-glass.md > The two layers`: conteúdo sem vidro.
- Hoje usa `saveDirection` com a versão capturada no formulário e o snapshot confirmado da transação. O caminho legado de `saveGoal` sem o campo semanal mantém seu contrato/testes; o formulário atual sempre envia a escolha explícita. Nenhuma mudança na estrutura dos módulos concluídos; Tarefas ganha somente abertura do registro por `?task=ID`.
- Limpeza automática de referências após exclusão preserva `isExample` dos registros relacionados; uma edição ou vínculo explícito ainda torna o registro pessoal. Migração de exemplos acontece uma vez, altera só exemplos antigos reconhecidos e não reinserta exemplos removidos; não muda schema/índices do IndexedDB.
- Tokens `updatedAt` avançam em toda gravação e restauração. Desfazer faz rebase do histórico anterior somente quando ele esperava exatamente o conteúdo e versão restaurados, incluindo o histórico de notas afetadas; edições reais continuam bloqueando restauração. Falha ao consultar histórico após escrita confirmada não anuncia falha da gravação.
- Formulários descartados durante uma gravação não executam callbacks tardios de navegação/foco; a confirmação permanece no store. Datas persistidas rejeitam ano 0000 para manter o mesmo domínio dos cálculos. URLs inválidas retornam validação em vez de lançar exceção no refinement.
- Preservar prazo `null` ao selecionar/editar uma meta no Hoje. Números de resultados-chave usam até 21 dígitos significativos, sem arredondar valores pequenos para zero na leitura. Percentuais inteiros são aproximações de apresentação; a contagem atingida usa valores reais.
- Testes anteriores preservados. Fixtures ajustam o total dos exemplos (14→15; índice pesquisável 13→14), o exemplo AWS removível sem referência e a seleção explícita antes das asserções antigas da meta semanal e de seu layout. A asserção de prazo da meta existente agora exige preservar o prazo original; um teste novo mantém a cobertura de domingo sugerido para a criação pelo Hoje. Novos testes ampliam concorrência, falhas, relações, progresso, navegação e acessibilidade.
- Limitar Vitest a quatro workers: a rodada final encontrou timeout intermitente no carregamento frio de rotas com muitos jsdom simultâneos; o caso passou isolado. Manter todos os casos, asserções e timeouts, reduzindo somente a disputa de recursos da suíte.

## 006 — Notas e conhecimento, 2026-10-02

- Manter features, Zustand, Dexie e a interface de repositories. Adicionar operações de notas ao contrato; módulos concluídos só recebem integração de busca/captura e compatibilidade de dados. Os testes anteriores permanecem; mudanças de comportamento autorizadas recebem novas asserções.
- A busca global abre Notas/Hábitos por ID, filtra Tarefas pelo título e revela o registro em Metas/Projetos. Pequenos wrappers reinicializam a seleção ao mudar a query de destino em Tarefas/Hábitos; a implementação e os testes de seus módulos são preservados. LocalRecords destaca o resultado solicitado mesmo fora dos cinco primeiros.
- `archivedAt` é opcional no schema Note, sem mudar os índices ou reescrever registros antigos. Ausência/null significa ativa. Backups antigos continuam válidos; a exportação inclui o estado de arquivo quando presente.
- `[[título]]` referencia notas por título normalizado (Unicode NFC, caixa e espaços), preservando acentos. Títulos duplicados não são resolvidos arbitrariamente. Backlinks e futuras arestas são derivados do Markdown, ignorando código, HTML e links externos. Ao renomear um título único, atualizar referências resolvidas numa transação, preservando o restante do texto.
- Desfazer de arquivamento/exclusão de notas usa uma pilha persistente no meta do repository, sem alterar o histórico de tarefas/hábitos. Não sobrescrever versões alteradas por outra aba ao desfazer.
- Editor nativo textarea com salvar explícito, rascunho local e status. Preview com react-markdown/remark-gfm, sem HTML executável nem carregamento de anexos/imagens. Documentação consultada: https://github.com/remarkjs/react-markdown e https://github.com/remarkjs/remark/tree/main/packages/remark-parse.
- Exportação individual produz Markdown legível com os links internos intactos; o backup completo JSON/Markdown preserva IDs, vínculos e arquivamento. Grafo fica apenas no contrato de arestas e numa pasta reservada, sem nova tela.
- A remoção de exemplos também considera dependências derivadas de `[[links]]`, inclusive transitivas, para preservar notas de exemplo referenciadas por conteúdo pessoal. `links[]` continua guardando os vínculos explícitos existentes; wikilinks não sobrescrevem esse campo. O parser Markdown compartilhado acrescenta um chunk de aproximadamente 21 kB gzip, necessário para distinguir código de texto nessa operação.
- `updatedAt` de notas avança ao menos 1 ms por gravação, incluindo renomeações de referências e arquivamento. Isso mantém a proteção de edição entre abas mesmo com relógio fixo ou duas alterações no mesmo milissegundo. Os rascunhos versionados preservam tags originais e fazem merge por ID no localStorage; falha de armazenamento mantém o texto em memória e explica como salvar/exportar.
- Tags importadas são preservadas exatamente quando o campo não foi editado. Edição explícita usa vírgulas como separadores e aceita o prefixo `#`; conteúdo e exportação não reparam tags sem intenção. Títulos com `[[`/`]]` são recusados tanto na captura quanto no editor, com orientação para corrigir.
- `text-views.md > Best practices`: "Keep text legible." Leitura limitada a 42 rem, textarea nativo, escala semântica e superfície opaca. `segmented-controls.md > Best practices`: "provide closely related choices"; apenas Editar/Pré-visualizar. `search-fields.md > Best practices`: "start search immediately when a person types"; pesquisa local por título, conteúdo e tags, sem confirmação.
- `undo-and-redo.md > Best practices`: "Show the results of an undo or redo." Depois de recuperar uma nota, mostrar e focar o link para abri-la; undo não disputa Ctrl/Cmd+Z com a edição nativa de texto. `liquid-glass.md > The two layers`: "never Liquid Glass" na camada de conteúdo. As referências orientam a web; não simulamos convenções nativas de menus do macOS.
- Nenhum teste anterior foi removido nem suas asserções reduzidas. O caso antigo de remoção por vínculos explícitos agora usa conteúdo neutro para isolar essa regra; nove novos testes cobrem dependências wiki. O E2E anterior de captura ganhou verificação de edição da nota e retorno explícito a Hoje antes de suas asserções originais de reload.

## 005 - Hoje e captura global, 2026-10-01

- Revisão em 2026-10-02: compromissos com horário vencido hoje também entram nas pendências; sem horário, permanecem na lista do dia. Não alterar prazos automaticamente nem ocultar uma pendência ao passar o horário.
- A confirmação de captura e meta usa a entidade retornada pela transação de `save`, inclusive os metadados normalizados. Não condicionar sucesso a uma segunda leitura do banco: isso poderia anunciar uma falha após gravar e provocar duplicação numa tentativa seguinte.

- Hoje mostra tarefas do dia e separa as pendências anteriores para revisão. Datas não mudam sem ação explícita. A sugestão de três tarefas é um aviso, sem limite rígido. Sem prazo continua no módulo Tarefas; a captura global informa essa interpretação.
- Compromisso manual usa uma tarefa com tag `compromisso`, data e hora; meta semanal usa Goal com prazo no domingo. Conteúdo continua exportável sem ampliar os cinco tipos ou esconder dados pessoais em preferências. Semanas de segunda a domingo; seleção de compromissos usa hora local, sem conversão de datas para UTC. Julgamento de produto.
- A caixa global cria tarefa por padrão; `nota:` e `hábito:` são atalhos explícitos. Tags são extraídas de notas/hábitos, mas datas/prioridades nelas permanecem texto. Novos hábitos rápidos são binários e podem ser detalhados no módulo. Navegação explícita e opções separadas evitam criar tarefas por engano.
- `search-fields.md > Best practices`: "start search immediately when a person types". A interpretação e os destinos atualizam enquanto se digita, com um campo rotulado e opções operáveis por setas/Enter. `keyboards.md > Custom keyboard shortcuts`: "only the most frequently used app-specific commands"; atalhos globais mínimos, sem captura de `?` durante edição ou composição.
- `sheets.md > Best practices`: "Display only one sheet at a time". Atalhos globais não empilham dialogs sobre edições; Escape e Fechar restauram foco. Navegação deixa foco no título do destino. `feedback.md > Best practices`: feedback de resultado no contexto, persistente até fechar; erros mantêm a entrada para nova tentativa.
- `liquid-glass.md > Review checklist`: vidro só nos controles e navegação. Hoje usa listas e divisórias sólidas; caixa de comando tem fundo funcional translúcido, com fallback opaco. Alvos de 44 px, zoom de texto e reduced motion seguem os tokens existentes.

## 004 - Tarefas e captura, 2026-10-01

- Lista editorial como entrada; detalhes opcionais em sheet, captura com Enter e interpretação visível. Três visões compartilham o mesmo conteúdo e filtros. `lists-and-tables.md > Best practices`: “Prefer displaying text in a list or table.” `segmented-controls.md > Best practices`: “Use a segmented control to provide closely related choices”.
- Parser simples, local e puro: primeiro prazo/horário/prioridade vence. Dados inválidos ou conflitantes ficam no título com aviso; sem perda silenciosa de texto. Horário isolado usa hoje, DD/MM usa o ano corrente, dia da semana inclui hoje e próximo exclui hoje. Tags preservam acentos e são deduplicadas em Unicode NFC. Escolhas de gramática são julgamento de produto.
- Conclusão recorrente atômica mantém a original e gera uma próxima ocorrência futura. Marcador operacional por ID evita duplicação concorrente e ao reabrir/reconcluir; tarefas importadas já concluídas são marcadas ao reabrir. Intervalos saltam atrasos aritmeticamente e ajustam meses curtos. Sucessor recebe IDs novos e resets de subtarefas/foco. Backup de conteúdo mantém o formato; marcadores e preferências não são exportados.
- Exclusão transacional com proteção de vínculos, delta persistido e UI otimista com rollback. Última exclusão pode ser desfeita após reload, preservando registros existentes. Reabrir uma tarefa não apaga o sucessor; mover a situação novamente reverte o estado do Kanban. Histórico amplo de undo/redo continua futuro.
- Kanban com arraste nativo de ponteiro e select equivalente por teclado/toque; destinos realçados e foco acompanha a tarefa. `drag-and-drop.md > Best practices`: “Offer alternative ways to accomplish drag-and-drop actions.” Calendário com 42 dias, contagens, seleção por teclado ou campo de data e lista do dia, incluindo tarefas sem prazo. Alvos de 44 px e texto/ícones além de cor, conforme `accessibility.md > Mobility` e `Vision`.
- Contextos sugeridos em preferências validadas do navegador, editáveis e também livres no formulário. Alterar sugestões preserva os textos das tarefas existentes. Valores de filtro têm prefixo separado para aceitar contextos chamados “all” ou “none”. Listas de mais de 200 tarefas virtualizadas em todas as visões, com foco nos extremos e medição de altura real.
- Tokens semânticos e dimensões centralizados, conteúdo sólido, sheets Radix com Cancelar/Escape/retorno de foco. Apenas check tem feedback de mola, opcional por reduced motion; sem fade de texto. `sheets.md > Best practices`: “Provide an alternative to the Done button.” `motion.md > Best practices`: “Make motion optional.”

## 003 - Hábitos e histórico, 2026-10-01

- Sequência diária para frequência de 7x/semana; sequência semanal para frequências menores, com semanas de segunda a domingo. Hoje e a semana atual ainda incompletos têm tolerância até o fechamento. Descanso preserva a sequência sem incrementá-la; na semana reduz os dias disponíveis, sem transformar descanso em conclusão. Semanas inteiras de descanso preservam, sem incrementar. Alterar alvo/frequência recalcula o histórico; tipo fica fixo após o primeiro registro.
- Heatmap de 13 semanas inicialmente, com opções de 26 e 52. Semanas em colunas, segunda a domingo em linhas; futuro desabilitado. Cada alvo tem 44 px com uma marca interna discreta. Foco único por gráfico e setas movem no espaço; Enter edita. Tabela textual com os mesmos dias e ações. `charts.md > Best practices`: "Make an interactive chart easy to navigate when using keyboard commands". `accessibility.md > Vision`: "Avoid relying solely on color".
- Cinco níveis: zero, até 25%, até 50%, abaixo de 100% e alvo atingido. Descanso usa traço; conclusão usa check. Visão geral soma contribuições normalizadas ao alvo de cada hábito, evitando misturar litros, horas e minutos; descansos ficam fora do denominador. Nenhum histórico fictício foi adicionado ao seed.
- Um único histórico alterna entre Todos e um hábito. Lista de registro de hoje mantém a captura rápida; criação, edição e registro retroativo em sheets curtas com Cancelar/Escape e retorno de foco. `layout.md > Visual hierarchy`: "Use progressive disclosure"; `sheets.md > Best practices`: "Provide an alternative to the Done button."
- Exclusões são otimistas, atômicas e oferecem Desfazer, com delta persistido. Apagar hábito remove seus registros, protegendo vínculos externos. Erros recuperam o estado anterior e explicam como corrigir. `undo-and-redo.md > Best practices`: "Help people predict the results of undo and redo".
- Animação breve de entrada no histórico e mola nos checks, desativadas por reduced motion. Conteúdo permanece opaco e só o cabeçalho da sheet usa material de navegação. `motion.md > Best practices`: "Make motion optional."
- Listas com mais de 200 hábitos são virtualizadas; histórico textual é paginado em 28 dias. Funções de datas usam dias locais com date-fns, sem interpretar YYYY-MM-DD como UTC.

## 002 — Dados locais, 2026-10-01

- Dexie/IndexedDB `atlas-local`, versão 1: tasks, habits, habitLogs, notes, goals, projects e meta. Contrato `AtlasRepository` assíncrono separado do adaptador. `src/data/service.ts` é o ponto de composição para um adaptador futuro, sem SDK de nuvem nesta fase.
- Schemas Zod são fonte dos tipos e validam dados externos em runtime. IDs globais, vínculos tipados, datas reais, timestamps, URLs http(s), valores finitos e índice único `[habitId+date]`. Escritas não podem deixar órfãos.
- Seed de 14 registros, incluindo os seis hábitos sugeridos. Inserção e marcador de inicialização na mesma transação; remoção não reinicializa o seed. Exemplos têm `isExample`, independente das tags. Editar um exemplo o torna pessoal; vínculos pessoais protegem exemplos transitivamente.
- Remoção de exemplos otimista com rollback na interface. O delta removido fica em meta para desfazer após reload; restauração preserva registros existentes. Exportações não incluem o histórico interno de desfazer. `undo-and-redo.md › Best practices`: “Show the results of an undo or redo.”
- Importação aditiva com prévia: nunca sobrescreve IDs existentes, rejeita colisões entre tipos e ignora registro de hábito já presente no mesmo dia. Validação e escrita completa acontecem em uma transação, rechecando o estado atual. Sem modo de substituir/apagar o banco.
- Backup JSON versionado contém os seis tipos e todos os campos. Markdown Atlas inclui leitura humana e bloco JSON de restauração, claramente explicado; a importação usa o bloco, não edições na leitura. Markdown comum entra como uma nova nota a cada importação. HTML importado é texto, nunca executado.
- Limite de entrada: 5 MB por arquivo, notas de até 500 mil caracteres. Títulos até 240 caracteres, tags até 60. Preferências visuais continuam separadas no localStorage e não entram no backup de conteúdo. Os modelos de disciplinas/trilhas/flashcards e contextos editáveis entram nas respectivas etapas.
- Painel “Seus dados” com Radix Dialog, Escape, retorno de foco, títulos/descrições e seletor nativo acionado por botão em português. Uma única sheet; só seu cabeçalho recebe material translúcido. `sheets.md › Best practices`: “Display only one sheet at a time from the main interface.” `file-management.md › Saving work`: “Help people be confident that their work is always preserved unless they cancel or delete it.”
- Hoje e módulos exibem prévias de até cinco registros por coleção. Não há listas extensas renderizadas nesta etapa nem CRUD de UI antecipado. Os repositories já fornecem list/get/save/remove para as próximas features.
- Dexie e Zod em chunks próprios de produção após medição de chunk principal acima de 500 kB; limite de warning mantido. Factory de banco em vez de subclass para evitar expansão recursiva dos tipos de transação no TypeScript 6.
- O carregamento inicial trata bloqueio/indisponibilidade do IndexedDB com erro e tentativa novamente. Sem fallback silencioso em memória. Operações de dados funcionam sem rede com a página carregada; instalação e recarga offline via PWA permanecem na etapa 8.

## 001 — Base incremental, 2026-10-01

- Preservar o starter React/Vite existente e implementar apenas a etapa 1 neste ciclo. Rotas futuras mostram estados preparatórios honestos, sem simular dados persistidos.
- React Router com BrowserRouter, lazy imports por feature e fallback para URL desconhecida. Hospedagem deverá reescrever rotas para index.html.
- Escuro por padrão, claro e sistema disponíveis. Preferências locais com Zustand; falha de armazenamento mantém a sessão utilizável com aviso. Conteúdo ficará no Dexie a partir da etapa 2.
- Seis destinos persistentes no mobile, em faixa rolável em larguras pequenas/zoom; todos permanecem acessíveis por teclado, sem esconder features em um menu Mais. Compromisso consciente pela quantidade de módulos. `tab-bars.md › Best practices`: “Use a tab bar to support navigation, not to provide actions.”
- Controles HTML nativos e Radix Popover para aparência; foco gerenciado em trocas de rota e Escape no popover. `keyboards.md › Best practices`: “Support Full Keyboard Access when possible.”
- Conteúdo opaco, blur apenas na sidebar, toolbar, tab bar e popover. `liquid-glass.md › The two layers`: “This is the only place Liquid Glass belongs.”
- Aparência configurável é requisito explícito, sobrepondo a preferência nativa da skill. Cores curadas preservam contraste; personalização livre exigirá validação adicional.
- Espaçamentos, dimensões, cores e tipografia em tokens. Media queries usam limiares fixos documentados, pois CSS variables não funcionam em condições de media queries.
- Identidade discreta ligada à rotina: lista editorial de áreas no Hoje; sem estatísticas inventadas ou heatmap decorativo antes de haver dados.

# Etapa 7B.1 — Estudos (2026-10-02)

- Disciplinas e trilhas são coleções auxiliares do módulo Estudos. Avaliações, provas/entregas e etapas são registros internos com IDs estáveis; tarefas e notas continuam únicas, referenciadas por ID. Dexie v2 adiciona tabelas sem recriar as anteriores; backups v1 recebem as novas arrays vazias. Cinco novos exemplos são explicitamente marcados e a migração não ressuscita exemplos removidos.
- Notas de avaliação são normalizadas para 0–10 para permitir máximos diferentes. Sem pesos, média simples; havendo pesos, média ponderada com peso 1 para campos omitidos. O texto explica essa regra. Presença usa faltas e aulas realizadas na mesma unidade; carga horária não implica automaticamente aulas realizadas.
- O próximo compromisso é um evento pendente, hoje ou futuro, de disciplina ativa. Urgência inclui ícone e texto; cores de identificação usam os tokens neutro/destaque/sucesso, sempre acompanhadas do nome.
- Edição usa sheets de uma tarefa por vez, conteúdo sólido e primeiro campo focado. Navegação e desfazer restauram foco. A guarda de formulário ativo já usada em Metas é reutilizada sem modificar os módulos concluídos. A implementação privada de undo passou a aceitar a chave do histórico, compartilhando proteção de versões entre Metas e Estudos; os testes anteriores foram preservados.
- Lista principal virtualizada acima de 200 itens com alternativas de teclado. Não há dashboard adicional. A rota Estudos mostra compromisso, disciplinas e pequenos próximos passos de trilhas.
- As asserts de contagem do seed foram atualizadas especificamente de 15 para 20 (e 16 para 21 quando uma tarefa pessoal é adicionada), mantendo todos os cenários, comparações de snapshots e testes anteriores. A mudança corresponde aos dois exemplos de disciplina e três de trilha.
- Referências lidas via `hig-lookup.md`: accessibility > Vision/Mobility, layout > Visual hierarchy/Adaptability, typography > Conveying hierarchy, color, lists-and-tables, sheets > Best practices, text-fields > Best practices, liquid-glass > Review checklist, undo-and-redo, keyboards e feedback. Adaptação à web conforme cross-platform.md.

## Etapa 7B.2 - Flashcards e Foco (2026-10-03)

- Dexie v3 adiciona `flashcards` e `focusSessions` ao mesmo banco. Backups antigos recebem arrays vazias; novos backups JSON/Markdown preservam revisão, vínculos e timestamps. `LearningRepository` organiza operações privadas do adaptador existente, usando suas tabelas e transações; o contrato `AtlasRepository` continua independente do Dexie. Nenhum módulo concluído foi recriado. O `save` de tarefas preserva os minutos já registrados, para que um formulário antigo não apague tempo confirmado.
- SM-2 pequeno, baseado na [descrição original de Piotr Wozniak](https://www.super-memory.org/archive/english/ol/sm2.htm): qualidades 0–5; facilidade inicial 2,5 e mínimo 1,3; intervalos 1, 6 e teto do intervalo anterior multiplicado pela facilidade anterior. A facilidade usa a fórmula original. Variante deliberada: uma revisão por cartão por dia, com falhas voltando amanhã, sem ciclos obrigatórios no mesmo dia. Limites defensivos: facilidade 10, intervalo 36.500 dias e um milhão de repetições. Datas são dias locais. Editar texto ou vínculos preserva a revisão; suspender mantém o histórico. A tela prioriza a fila de hoje e oferece edição sob demanda.
- Uma sessão em andamento por banco, garantida transacionalmente. O relógio usa tempo acumulado e início do segmento atual, não soma ticks. Pausar congela o acumulado; retomar inicia outro segmento. Refresh, mudança de rota e janela em segundo plano apenas recalculam a exibição. Chegar a zero exige confirmação: nunca conclui automaticamente uma sessão abandonada. Registro limitado ao tempo planejado evita atribuir horas de uma aba esquecida; regressão do relógio do sistema é limitada a zero. Pausas têm registros próprios, sem incrementar foco.
- Encerrar ou reiniciar registra o tempo realizado como interrompido; concluir só é possível após o tempo planejado. Finalização e soma de minutos à tarefa são uma transação, idempotente contra repetição. Conflitos em outra aba recuperam o estado salvo e explicam como tentar novamente. Reiniciar preserva modo e contexto, inclusive após refresh. Histórico é paginado em 20 registros.
- Foco guarda IDs da tarefa e dos projetos/disciplinas/trilhas relacionados no início da sessão. Totais contextuais são informativos e não alteram notas, faltas ou resultados-chave. Sessões encerradas permitem desvincular a tarefa sem apagar título, tempo ou contexto: a transação retira somente os minutos dessa sessão do total da tarefa. A última desvinculação pode ser desfeita após refresh, com proteção contra edições posteriores. Assim, a proteção existente contra exclusão com referência órfã continua utilizável, sem prender tarefas ao histórico. Os cartões podem se conectar a nota, disciplina e trilha sem cópias.
- Preferências locais de duração: foco 25 min (1–180), pausa curta 5 (1–60), longa 15 (1–120). Aplicam-se à próxima sessão e permanecem fora do backup de conteúdo, como as demais preferências. Troca entre foco e pausas é explícita, sem ciclo automático. Acesso por tarefa ou botão global, com rota `/foco` carregada sob demanda; não se adicionou outro destino à tab bar.
- Todos os testes anteriores foram preservados. A comparação integral de preferências passou a incluir os três novos defaults, mantendo os campos e cenários existentes; os novos testes cobrem limites, revisões, transições, recuperação e relacionamentos. Validação final: 732 testes em 43 arquivos e 65 e2e, além de lint/typecheck/build limpos.
- Timer com números tabulares, leitura sólida, `aria-live="off"` e anúncio apenas das mudanças de estado. Space controla o relógio fora de campos, diálogos e controles com ativação nativa; Escape abre a confirmação e respeita eventos já consumidos ao fechar uma sheet. Qualidades 0–5 só agem com a resposta revelada e fora de campos/diálogos. Foco retorna ao acionador ou ao próximo cartão. `keyboards.md > Standard keyboard shortcuts`, `accessibility.md > Speech`, `sheets.md > Best practices`, `liquid-glass.md > The two layers` e `motion.md > Best practices` orientaram a revisão. O formulário preserva texto em falhas e ignora callbacks de telas descartadas.

## Etapa 8A — preferências e organização diária

- `/preferencias` é uma rota secundária, acessível no rodapé e no popover Aparência; mantém as seis áreas principais. Seletores nativos, descrições próximas e salvamento imediato seguem `settings.md > Best practices` e `accessibility.md > Mobility`.
- Widgets usam uma lista ordenada persistida no armazenamento de preferências existente. O DOM acompanha a ordem, sem CSS order; arraste por alça (mouse/toque) tem botões equivalentes de subir/descer e anúncio textual. Cinco widgets atuais ficam visíveis por padrão, quatro de Estudos/Foco são opcionais. Ocultar/reset têm Desfazer. Referências: `drag-and-drop.md > Best practices`, `layout.md > Visual hierarchy`.
- A arquitetura dos módulos concluídos foi mantida. `useAtlasReducedMotion` adapta os três componentes existentes de Framer Motion à escolha explícita do usuário; CSS e ThemeSync aplicam a mesma política. O booleano antigo solid é migrado para transparência reduzida. Alto contraste sempre conserva fundo sólido. Referências: `motion.md > Best practices`, `liquid-glass.md > Review checklist`.
- Limpar todos exige APAGAR TUDO e ciência da irreversibilidade, com cancelar focado. Uma transação apaga registros/históricos e mantém marcadores de inicialização para impedir retorno de exemplos. Rascunhos locais também são limpos; preferências ficam. Backup permite restauração posterior. Referência: `alerts.md > Best practices`.
- Idioma preparado como pt-BR no modelo normalizado; nenhuma tradução incompleta aparece na interface.

## Etapa 8B — XP como histórico auxiliar

- XP fica em meta.experience no IndexedDB já existente, atrás do repository; não introduz outro tipo de item ou tabela duplicada. Snapshot/JSON/Markdown incluem o histórico auxiliar experience, opcional em backups antigos. Contagens de conteúdo continuam considerando as dez coleções existentes.
- Pontos por ação: tarefa 10, hábito 5, foco concluído 15, etapa 10 e revisão de cartão 2 (inclusive dificuldade, valorizando esforço). Cada tarefa, sessão ou etapa pontua uma vez; hábito e cartão pontuam uma vez por dia. Revisões de valores e desfazer não permitem duplicação. Eventos nascem na mesma transação da ação, com chaves estáveis.
- Exclusão, reabertura e dias ausentes não reduzem XP. Pausas e sessões interrompidas não pontuam. Importar/seed não inferem XP retroativo. Resumo ocultável apenas em Preferências, com marcos textuais sem níveis, ranking, sons ou confetes. Julgamento de produto: reconhecer pequenos passos sem criar pressão.
- Nenhum cálculo de notas, faltas, metas, progresso ou sequência consome XP. O histórico conserva sourceId como identificação histórica sem exigir que a origem continue existindo.
- Testes anteriores preservados. Dois laços de relações usam explicitamente collections em vez de Object.values para excluir metadados auxiliares. O teste de exclusão de hábito mantém comparação integral das coleções vazias e exige XP intacto antes/depois de reabrir. Não se reduziu cobertura; novos testes cobrem deduplicação, transações, exportação, importação e ausência de efeitos em metas/médias.

## Etapa 8C - PWA, offline e revisão final, 2026-10-03

- vite-plugin-pwa com registro único fora de StrictMode, somente em produção. Workbox faz precache de todos os arquivos estáticos e chunks das rotas; navegação offline usa index.html. IndexedDB mantém o conteúdo. Não há runtime cache de dados remotos, backend ou dependência de imagens externas.
- Atualização em modo prompt: worker novo fica aguardando; Atualizar ativa e recarrega, Agora não conserva a sessão. Nada ativa automaticamente por abandono ou mudança de rota. Verificar ao reconectar, voltar à janela e a cada hora enquanto visível/online. Workbox limpa caches antigos na ativação. No deploy futuro, servir HTML/SW com revalidação e assets com hash; não configurar cache imutável em sw.js/index.html.
- Manifest completo com nome Atlas, descrição solicitada, pt-BR, standalone, atalhos e ícones 192/512/maskable. Marca vetorial monocromática local, rasterizada por Sharp via npm run icons. O navegador controla a disponibilidade do prompt; Safari recebe instrução textual de instalação. Nenhuma instalação no sistema operacional foi feita em nome do usuário.
- Offline tem aviso discreto com ícone e texto, sem bloquear ações. Atualização tem uma faixa sólida com foco e nomes explícitos; vidro não foi usado no conteúdo. Referências: `liquid-glass.md > Review checklist`, `app-icons.md > Icon shape`, `accessibility.md > Vision`.
- Playwright passou a usar build/preview de produção na porta 4180 para testar o worker real, em contextos novos. O teste de atualização serve duas versões isoladas numa porta temporária, sem alterar dist durante os demais testes. Instalabilidade usa perfil temporário não anônimo e CDP; ausência de erros não prova instalação física.
- O Edge de teste mantém o bloqueio de rede, mas pode reportar navigator.onLine=true após navegar pelo SW. O teste primeiro exige falha de fetch não cacheado; depois aplica Network.overrideNetworkState para representar a mesma desconexão no estado exposto pelo navegador. Não substitui fetch, IndexedDB nem a implementação do service worker.
- Arraste usa Pointer Events com captura, indicação da origem e registro de gesto já iniciado; rolar entre origem/destino não cancela a operação quando as coordenadas da janela coincidem. Alças aceitam mouse, toque e caneta; botões equivalentes permanecem disponíveis. Teste de ponteiro cobre arraste com rolagem, foco e ordem do DOM.
- Testes existentes de Foco agora aguardam Pausar estar habilitado antes de avançar o relógio falso ou usar Escape: o clique inicia uma transação assíncrona e o build otimizado expôs essa corrida em dois casos. As esperas foram acrescentadas nos fluxos equivalentes. Todas as asserções de duração e recuperação foram mantidas. Nenhum teste anterior foi removido ou relaxado.
- Editar uma tarefa importada já concluída não gera XP retroativo. Falha ao gravar o ledger reverte a ação inteira; testes verificam atomicidade e ausência de efeitos parciais.
- Verificar atualização reabre um aviso adiado na mesma sessão; a ação fica desabilitada offline. Testes unitário e de worker real cobrem o retorno ao aviso sem ativação automática.
- Lighthouse encontrou role=status aplicado ao main de abertura, retirando o landmark principal. A correção mantém main e põe status no parágrafo interno, sem mudar a arquitetura ou o fluxo de dados. Teste novo preserva a semântica durante o carregamento. A primeira coleta parcial foi preservada separadamente. Coletas exploratórias com espera de 10 s também ficam nos relatórios anteriores; as medições finais usam parâmetros padrão, perfil temporário novo e confirmação de que Hoje foi renderizado.
- Restringir a descoberta Tailwind a src e index.html. O relatório Lighthouse HTML contém nomes de classes; a descoberta automática estava incorporando essas classes ao CSS do produto e tornando o build dependente de docs. `source(none)` e fontes explícitas seguem a documentação oficial: https://tailwindcss.com/docs/detecting-classes-in-source-files. Nenhuma classe ou token da UI foi removido.
- A coleta da rota carregada mostrou atraso de renderização e deslocamento do rodapé durante o fallback. Hoje inicia seu import em paralelo à abertura do IndexedDB somente no endereço inicial, mantendo o code splitting. Registro do SW aguarda o primeiro main com h1 e um período ocioso, para o precache não disputar rede com a primeira tela. Rodapé fica invisível apenas enquanto a rota lazy abre, evitando salto visível para fora da tela. Nenhuma operação ou assinatura do repository foi alterada.
- O audit experimental label-content-name-mismatch identificou metadados dentro dos botões de tarefas/hábitos que não apareciam no nome acessível e texto de Adiar interrompido pelo título. Metadados agora ficam adjacentes e associados por aria-describedby; títulos continuam botões de 44 px. Adiar tem nome “Adiar para amanhã: título”, contendo o rótulo visível inteiro. O seletor exato correspondente do E2E foi atualizado; a ação e todas as asserções anteriores foram preservadas. Novo teste ativa explicitamente a regra de nomes visíveis.
- Benchmark distingue primeiro acesso de retorno após preparação. O primeiro acesso usa perfil vazio, sem navegar ao Atlas antes da coleta; esperar 10 s em about:blank estabiliza o processo recém-aberto do Edge, sem criar cache ou dados do produto. Retorno faz um acesso online e aguarda o SW antes de auditar. Ambos têm relatórios reais e cenário explícito; não usar o resultado do retorno como promessa sobre a primeira abertura. A meta de desempenho acima de 90 no primeiro acesso ainda não foi atingida.
- Lembretes futuros: introduzir um contrato de agendamento separado do repository de conteúdo, com adaptador de capacidade por navegador. Pedir permissão somente após o usuário criar/ativar um lembrete, explicando o benefício e oferecendo continuação sem permissão. Negativa não bloqueia tarefas/foco; exportação deve conservar a intenção por ID, sem prometer entrega com o app fechado. Nenhum adaptador, permissão, Notification API ou push foi implementado agora.

## 009A.1 — Perfil privado e atividade, 2026-10-03

- Rota /perfil lazy, acesso secundário pelo avatar/rodapé, sem autenticação nem publicação. ProfilePreferences e ActivityEvent são metadados auxiliares no Dexie existente; nenhuma cópia de entidades. Backup JSON/Markdown recebe profile null e activity [] opcionais para versões antigas. Import preserva perfil já configurado e usa o importado quando não há perfil; histórico mescla por chave. Limpeza total apaga perfil, imagem, fixados e eventos, sem rascunhos/undo no backup.
- Dia ativo: pelo menos uma conclusão de tarefa, registro positivo de hábito, encerramento de foco com tempo real ou revisão de flashcard. Cada origem conta uma vez; hábito/cartão uma vez por data. Intensidade fixa: 0, 1, 2–3, 4–6, 7+ ações. Hoje pode ficar em aberto para sequência; melhor sequência usa dias de calendário. Visitas, XP, pausas e exemplos não contam. Não inferir datas antigas de conclusão de tarefa por updatedAt: só o estado concluído entra no total, sem inventar linha do tempo. Etapas antigas não entram sem evento confiável.
- Atividade independente do ledger XP, registrada na mesma transação da ação. Chaves estáveis sobrevivem refresh, undo e import. Registros existentes de hábitos/foco/revisão são derivados; persistência preserva dias antigos de revisão/conclusões apagadas. Conteúdo duplicado não gera evento ao importar. Métricas representam o histórico disponível, sem reconstrução especulativa.
- Avatar aceita PNG/JPEG/WebP até 2 MB, até 24 MP, recorte central 256 px WebP com limite 350 mil caracteres. Canvas retira metadados; sem SVG/URLs remotas, fallback de iniciais, nenhuma transmissão. Imagem faz parte do backup privado.
- Até três fixados por type/id no perfil. Referência sem registro aparece como indisponível com ação de desafixar; desfazer volta a mostrar o item na posição original. Não mudar entidades ou resultados de metas por fixar.
- O modelo aceita até 100.000 eventos de atividade, sem descarte silencioso de histórico. Bases que alcançarem esse limite ou o limite de backup exigirão uma estratégia futura de arquivo/streaming; nesta fase, validação e transações evitam gravação parcial.
- Referências: design-principles.md > Agency, Responsibility; layout.md > Visual hierarchy; accessibility.md > Vision, Mobility; liquid-glass.md > The two layers. Perfil é conteúdo sólido, sem vidro atrás de leitura. Calendars/search/navigation não existem como arquivos no catálogo; usar pickers/searching/sidebars/tab-bars para esses temas.
- Cobertura anterior preservada. Testes que exigiam arrays vazios agora também exigem profile null; teste de remoção de hábito exige preservar activity assim como experience, sem reduzir asserções sobre entidades ou undo.

### 009A.2 — Linguagem editorial e camadas

Fundo profundo, superfícies sólidas de leitura e navegação discretamente translúcida. Os tons de texto, accent e bordas de controles AA foram preservados; fundos escuros ficaram mais profundos. Raios de superfícies passaram a 18 px e agrupamentos a 14 px. Hoje usa divisores e respiro, incluindo estados vazios, em vez de mais caixas. Eyebrows e rodapé deixam de usar caixa alta permanente. Tipografia de sistema, largura de leitura, ícones e funções existentes permanecem.

Resposta direta em 150 ms e mudanças de contexto em 220 ms, com os mesmos fallbacks de movimento e transparência reduzidos. HIG: `design-principles.md`, `layout.md > Best practices`, `typography.md`, `materials.md`, `liquid-glass.md` e `motion.md`. Decisão de craft: hierarquia pela composição e pelo espaço, sem adicionar fontes, imagens ou dependências.

### 009A.3 — Prévia contextual de notas

A prévia visual é gerada apenas após 600 ms de intenção com mouse fino, limitada a 1.200 caracteres e sem renderizar todas as notas antecipadamente. O Markdown reaproveita o renderer seguro (HTML omitido, imagens não carregadas, URLs filtradas); a miniatura é tipográfica, feita com o conteúdo e os tokens locais. Movimento usa CSS em 150 ms e as preferências existentes. Rolagem, seleção, arraste, resize e saída cancelam a prévia; posicionamento é limitado à viewport.

A prévia flutuante é visual, inert e não recebe foco. A ação explícita “Prévia” abre uma sheet para teclado e touch, sem informação essencial exclusiva de hover. Módulo e renderer sob demanda; sem GSAP, imagens ou nova dependência. HIG: `accessibility.md > Best practices`, `motion.md`, `popovers.md` e `sheets.md`; referência de interação: ObsidianUI Hover Image, adaptada sem copiar sua implementação.

### 009A.4 — Captura contextual e tabela

Capturas de Tarefas e Notas começam em uma linha com input pronto; foco expande opções, sem alterar Ctrl/Cmd+K. Escape recolhe, pedindo descarte se existe texto. Enter cria, Shift+Enter não cria uma tarefa multiline. Parser, repositories, atualizações otimistas e feedback de falha permanecem. Contexto e repetição são escolhas explícitas: não foi inventada nova sintaxe no parser existente. Notas abre diretamente o editor e mantém o fluxo de modelos já testado.

Tabela é a quarta visão, carregada sob demanda. Filtros de situação têm contagens calculadas após busca/contexto, antes do filtro de situação. Usa tabela semântica, controles nomeados, relações por IDs, cabeçalho fixo e região de rolagem focável no mobile. Decisão de desempenho/acessibilidade: tabela limita cada página a 200 registros com navegação explícita; listas existentes continuam virtualizadas acima de 200. A função de filtro foi extraída para `src/lib/task-filter.ts` preservando seu comportamento e coberta por teste. Kanban mantém sua alternativa de mover por select e ganha adicionar por coluna e rolagem horizontal controlada no mobile.

HIG: `text-fields.md`, `search-fields.md`, `searching.md`, `lists-and-tables.md`, `keyboards.md`, `feedback.md`. Referências: Searches Bar.txt e Filter Table.txt fornecidos pelo usuário; Bencho Seek e Coss UI observados no navegador. Nenhum código, estilo ou biblioteca foi copiado.

### 009A.5 — Calendário, confirmações e movimento útil

DateField compartilhado conserva entrada nativa e FormData, adicionando calendário lazy em sheet adaptativa. Seleção, Hoje, limpeza opcional, limites e grade mensal PT-BR têm teclado (setas, Home/End, Page Up/Down, Enter, Escape), foco no dia e devolução ao acionador. Tarefas, Metas, compromisso de Hoje, avaliações/provas/entregas e registros de hábitos usam o mesmo componente. Grade ampliada tem rolagem interna explícita, sem comprimir os alvos de 44 px.

Por solicitação explícita do usuário, exclusões comuns e de registros acadêmicos abrem confirmação específica com nome real, consequência e Cancelar como foco inicial. Escape/Enter em Cancelar não excluem; handlers e desfazer existentes continuam responsáveis pela transação e vínculos. Tarefas com vínculos protegidos continuam exigindo desvinculação. A limpeza total mantém frase e checkbox fortes, agora com exportação visível dentro da confirmação. Não há promessa de desfazer para limpeza irreversível. Remoções em rascunhos não salvos continuam sendo edição local; arquivamento mantém desfazer.

Persistência não espera animação. Check tem feedback discreto; listas pequenas usam transição de posição/saída, listas maiores não animam todas as posições e virtualização permanece. Foco de item filtrado volta ao botão de criar, sem pousar numa linha em saída. Sheets usam fade de 220 ms; preferências e media queries desligam movimento. HIG: `pickers.md`, `keyboards.md`, `sheets.md`, `alerts.md`, `motion.md`, `feedback.md`, `undo-and-redo.md` (lida nesta revisão). O HIG recomenda evitar confirmações em ações facilmente reversíveis; o requisito explícito desta etapa prevalece. Referências Bencho Confirm/todo-motion e Coss Date Picker observadas, sem copiar código.

### 009A.6 — Importação local de Markdown

O importador adicional é carregado sob demanda em Notas e Dados. Processa UTF-8 no navegador; até 20 arquivos .md, 1 MB por arquivo e 10 MB por lote, preservando o limite de 500.000 caracteres do modelo de nota. HTML ativo é rejeitado fora de blocos de código; o renderizador existente continua sem executar HTML nem carregar imagens. Reconhece frontmatter simples (id, title, tags, archivedAt); metadados desconhecidos e [[links]] permanecem no texto. Título ausente recebe o nome do arquivo com aviso.

A interface do repository ganha importMarkdownNotes: valida novamente dentro de uma transação, detecta conflitos por ID global ou título+conteúdo e exige ignorar ou criar cópias com novos IDs. Nunca sobrescreve uma nota. Remover um arquivo da seleção confirma o descarte e mantém o original no dispositivo. Nenhum rascunho intermediário entra no backup.

O backup JSON passa de 5 MB a 50 MB para restaurar lotes maiores que 5 MB sem perder dados. Mantemos o limite e os testes de 5 MB para Markdown legado; para bases grandes, a interface orienta JSON como backup completo. Teste cobre exportação, limpeza e restauração de JSON acima de 5 MB. Dados importados deixam de ser exemplos, conforme a regra já existente da etapa 2.

HIG: sheets.md, feedback.md, accessibility.md e undo-and-redo.md. A exigência explícita do usuário de confirmação prévia prevalece sobre a preferência geral do HIG por desfazer em ações reversíveis.

### 009A.7 — Regressões verificadas

A expansão pertence a um botão com aria-expanded/aria-controls, não ao textbox (Axe identificou atributo proibido). O campo continua expandindo ao receber foco, imediatamente. O nome acessível do link do perfil inclui os textos visíveis, também para comandos de voz. O campo Data dos hábitos preserva seu nome anterior. O teste virtualizado mantém a mesma posição 210, consultando o ancestral semântico listitem depois da inclusão do wrapper de prévia; nenhuma asserção foi removida.

Itens em saída animada ficam inertes e sem data-task-id; isso impede foco em cópias temporárias quando a tarefa muda de coluna no Kanban. A rolagem por wheel também cancela previews em páginas sem deslocamento. Medidas de contraste são recalculadas a partir dos tokens, sem estimar por screenshot.

Um commit adicional de funcionalidade foi necessário para a Parte 7 (importação Markdown), antes dos commits de testes e documentação, mantendo os sete grupos solicitados e separando o novo fluxo de importação da alteração visual.

Fixados mantêm referências durante uma exclusão para reaparecer na posição original ao desfazer. Se o registro não estiver disponível, o perfil mostra esse estado com ação de desafixar; a referência nunca fica invisível consumindo um dos três lugares. Nenhuma entidade duplicada é criada.

A troca de tema aplica texto e fundo simultaneamente, sem interpolar essas cores. A regressão Axe detectou contraste transitório de 4,28:1; sombras/bordas/pressed mantêm movimento discreto. Não foi adicionada espera nem desativada regra de contraste nos testes.

O link de perfil usa seu texto como nome nativo, sem override ARIA. No modo recolhido, nome e frase ficam visualmente recortados, não display:none: isso preserva o nome na árvore acessível. A regressão da sidebar ganhou uma asserção adicional, sem retirar as anteriores. Em mobile, a ação Prévia fica depois do texto da nota para preservar leitura a 200%; títulos de sheets usam o papel headline nessa largura.

### 009A.8 - Carregamento medido e agrupamento do build

O primeiro build da revisão gerou 39 requisições na medição fria e Lighthouse 57, abaixo dos 67 da etapa 8. O waterfall mostrou dependências pequenas de Hoje esperando sucessivas rodadas de rede; não se tratava de custo de animação ou de imagens. O relatório anterior à correção foi preservado como lighthouse-stage9a-before-bundle-fix.report.json/html.

Usamos as opções codeSplitting/groups documentadas nos tipos do Rolldown já instalado: storage/validation mantêm prioridade 30, React/router ficam em react-core com prioridade 25, o núcleo estático usa a tag $initial com prioridade 20 e a cadeia estática de TodayPage fica no grupo today com prioridade 10. Dependências recursivas são o comportamento padrão. Isso agrupa código que Hoje já usava, sem redesenhar os módulos nem acrescentar dependências. Perfil, formulário de perfil, prévia, renderer Markdown, Tabela, DatePicker, importador e command palette continuam como imports dinâmicos separados; todos entram no precache offline existente.

A importação dinâmica de note-links no repository não tinha efeito: data-integrity já importava o mesmo módulo estaticamente. Foi explicitada como import estático, evitando o warning sem suprimir diagnósticos ou acrescentar conteúdo ao carregamento real. Build sem warnings. A medição final válida de primeiro acesso atingiu 73 de desempenho e 100 de acessibilidade, sem avisos. A meta acima de 90 continua pendente; o retorno preparado permanece separado. O throttling mobile original foi preservado. O critério de encerramento foi corrigido conforme 009A.9, sem preparar caches ou dados antes da navegação fria.

### 009A.9 - Prontidão real do Lighthouse e preparação dos testes

A inspeção da filmstrip revelou que duas medições aparentemente boas terminavam antes da tela Hoje pronta: 90 ainda em “Abrindo seus dados locais” e 85 no fallback “Abrindo seu espaço”. Ambas são inválidas para comparar o produto carregado. Os arquivos incomplete-startup e before-paint-guard preservam essas coletas, sem usá-las como resultado final. O texto do commit 714fdf3 menciona 90; esta decisão corrige explicitamente aquela conclusão preliminar.

O auditor usa o callback de navegação documentado do Lighthouse com a conexão Puppeteer já disponível na dependência de auditoria; não há pacote novo ou mudança no bundle. O registro começa antes do primeiro goto e termina após a tela Hoje visível, dois frames e 1 segundo de rede ociosa. Isso inclui inicialização assíncrona de IndexedDB e pintura no mesmo trace; não constitui visita prévia, prewarming ou novo throttling. A imagem final foi inspecionada e mostra Hoje carregado. A etapa 8 também mostra Hoje carregado; a mudança do critério de término deve ser considerada na comparação. Relatórios identificam primeiro acesso e retorno separadamente. O retorno começa em about:blank depois da preparação online, conservando SW/cache/IndexedDB; isso evita reutilizar a composição visual da visita de preparação. Um timeout HTTP na preparação do retorno não é uma medição e não fornece pontuação.

Três beforeAll novos importam componentes lazy de confirmação/prévia para preparar os testes. Sob carga, suas importações excederam o limite de 10 segundos antes de executar quatro casos. A tentativa com 30 segundos também falhou e foi revertida: os limites originais e todas as asserções foram preservados. A configuração do Vitest limita a concorrência do runner local a um worker, sem alterar o código do produto, os tempos de interação, fake timers ou regras Axe. Os relatórios de falha de preparação ficam preservados; a suíte completa passou com 812/812 testes, incluindo os casos que falhavam na preparação.

### 009A.10 - Preloads pertencem à coleta do módulo de teste

A rodada serial de 812 testes passou, mas outra repetição fria ainda estourou o hook de importação de ConfirmDialog e o caso de navegação de 5 s. A rodada foi interrompida após essas falhas; não é contada como aprovada. Limitar workers reduz pressão, mas não elimina o tempo variável de transformação do Vite no Windows.

Os mesmos preloads dos três testes novos passam de beforeAll/import dinâmico para imports estáticos na coleta do módulo. O teste de rotas também prepara Hoje/Hábitos nessa fase: sua finalidade é teclado, navegação e foco, não medir transformação fria do bundler. Os controles continuam usando React.lazy; nenhum componente, repository ou comportamento do app é mockado por isso. Nenhuma asserção, tempo de interação, limite de teste, caso ou regra de acessibilidade foi removido. As importações de produção continuam lazy, verificadas no build/E2E e no fluxo offline real. A suíte completa passou com a preparação corrigida: 812/812, 59 arquivos, sem falhas ou skips; lint, typecheck e build também passaram. A última execução de build não emitiu warnings.

## 009A-R1 — Navegação conforme anotações finais

A sidebar é substituída por dock inferior fixo, centralizado e com links reais. Esta decisão substitui a sidebar descrita no primeiro prompt do rebuild porque as anotações posteriores pedem explicitamente o dock. O perfil entra no dock; Preferências entra no agrupamento de Aparência no cabeçalho. Em mobile são cinco controles: Hoje, Tarefas, Hábitos, Perfil e Mais, que contém Notas/Metas/Estudos. Nenhum módulo ou URL foi removido; o campo legado de sidebar recolhida continua compatível com backups, sem função visual nova.

HIG: tab-bars, toolbars, layout, accessibility e liquid-glass. O exemplo fornecido foi adaptado à arquitetura existente, usando Framer Motion, React Router e Radix. Não foi criado projeto shadcn novo e nenhuma dependência foi instalada.

## 009A-R2 — Captura Seek e recuperação do feedback

A captura do cabeçalho ganha transição compacta de ícone para input. O campo encaminha o texto à command palette existente; parser, navegação global e Ctrl/Cmd+K permanecem na mesma camada. Escape preserva o rascunho e devolve foco. A captura de Tarefas/Notas revela opções somente com interação.

Toasts de sucesso/desfazer duram oito segundos e pausam quando o usuário interage com eles ou oculta a janela. Erros permanecem até resolução. Expirar a apresentação não apaga undo nem vínculos: Tarefas conserva recuperação em Última exclusão, e os repositories continuam com suas regras existentes. O aviso de Hoje passa a depender de uma ação recente, evitando um bloco vazio permanente ao reabrir com undo disponível. HIG: feedback, keyboards, accessibility e undo-and-redo.

## 009A-R3 — Composição e carga sob demanda

Hoje mantém a ordem DOM dos widgets e aplica duas colunas apenas quando a sequência visível inicial é Prioridades/Compromisso/Meta. Pendências sem conteúdo não ocupam espaço. Notas tem coleção + leitura em desktop e navegação por etapas no mobile. Metas/Projetos ganha segmentação sem duplicar dados. Estudos reúne próximo compromisso e revisão na primeira área.

Editor de notas, Kanban, calendário e data picker são carregados sob demanda. A tabela e preview mantêm os imports dinâmicos existentes. Data picker ancorado no desktop usa Radix Popover; em mobile preserva EntrySheet. Regras de data, foco, teclado e repositories não foram alteradas. HIG: layout, lists-and-tables, pickers, sheets e popovers.

## 009A-R4 — Menus acessíveis e testes preservados

Situação por tarefa e filtros/captura passam a combobox com listbox, escolha explícita, setas, Home/End, pesquisa por letra e Escape. No Kanban esse controle fornece a alternativa ao arraste. Os testes antigos que usavam selectOption nesses controles passam a escolher opções reais do menu, mantendo assertivas de status, contagens, foco, persistência e relacionamentos. Formulários de configuração que ainda usam select nativo permanecem funcionais.

## 009A-R5 - Foco, feedback transitório e evidências

A montagem tardia de uma rota não toma foco de campos do cabeçalho nem de diálogos já em uso. Menus restauram foco ao acionador ao fechar por teclado, sem tomar foco de outro campo alcançado por clique. Isso evita que uma escolha de aparência ou captura seja fechada pelo carregamento lazy de Hoje. O título continua recebendo foco em navegação normal.

O viewport dos toasts tem altura limitada ao espaço entre cabeçalho e dock e rolagem interna quando necessário, inclusive com texto a 200%. Desfazer após recarregar permanece em disclosures em Tarefas, Notas, Metas/Projetos e Estudos. Ao recuperar, o foco retorna ao registro ou link de recuperação. Os registros de undo e seus relacionamentos não mudam.

A altura do cabeçalho é medida por ResizeObserver para limitar o viewport de feedback mesmo quando os controles quebram em linhas com texto ampliado. Os botões compactos conservam mínimos de 44×44 px. Uma recompilação simultânea ao E2E substituiu arquivos de service worker durante uma navegação e causou um 404; essa rodada não é aprovação. A validação final usa dist estável, sem builds durante os testes de browser ou Lighthouse.

As verificações anteriores que pressupunham calendário/Kanban síncronos esperam agora a visão e a célula focada antes de medir alvos ou enviar teclas. Nenhuma asserção de contraste, tamanho, estado, persistência, dados ou foco foi removida. A reprodução do arraste usa o grip e destino no mesmo eixo visível para não arrastar um item vizinho após scroll automático do driver.

O sistema não recebe dependências novas. Editor, calendário, Kanban, Tabela e preview continuam lazy; o dock usa Framer Motion já instalado, que passa a integrar o chunk inicial. Bundle total e visita fria/retorno são medidos separadamente em PERFORMANCE-REDESIGN-9A.md. Screenshots e relatórios anteriores são preservados; os novos usam o prefixo redesign-9a. Referências: accessibility, keyboards, feedback, layout, pickers e lists-and-tables.

## 009A-R6 - Encerramento medido do rebuild

A suíte final com dist estável passou com 97/97 E2E. Foram preservados os 91 casos existentes e acrescentados seis; os unitários passaram de 812 em 59 arquivos para 825 em 64. As evidências que os testes antigos regeneram são copiadas para redesign-9a-regression-* antes de restaurar os arquivos de etapas anteriores, sem apagar o histórico.

O Lighthouse de primeiro acesso, sem visita preparatória, marcou 91 de desempenho e 100 de acessibilidade; o retorno preparado marcou 100/100. Ambas as coletas não tiveram avisos. A screenshot final extraída do trace frio mostra Hoje carregado. A baseline imediatamente anterior marcou 73 e a etapa 8 marcou 67. Assets totais cresceram 1,52%, enquanto a transferência fria cresceu 0,93%; não há dependências novas. Números, método e limites ficam em PERFORMANCE-REDESIGN-9A.md e nos relatórios reais JSON/HTML. A etapa 9B não foi iniciada.

## 9B — Concorrência e confirmação de persistência

- Direção visual congelada em `eb7c770`; nenhum layout, token ou animação é alterado para esta correção.
- Formulários de tarefa, compromisso e hábito carregam a versão original (`updatedAt`) até o repository. A comparação acontece dentro da mesma transação de escrita; atualização ou exclusão concorrente recusa o rascunho antigo, que permanece no formulário. Timestamps dessas entidades avançam monotonamente, inclusive no mesmo milissegundo. Chamadas internas legadas continuam compatíveis com o parâmetro opcional; editores da interface passam explicitamente versão ou `null` para criação.
- Perfil compara os campos editáveis com o estado original da sheet. Referências fixadas são conservadas a partir do banco no momento de salvar, pois pertencem à operação independente de fixação. Processamento assíncrono do avatar mescla somente a imagem no estado atual, conservando texto digitado enquanto o arquivo abre.
- Leitura auxiliar de disponibilidade de Desfazer não pode reverter visualmente uma transação de conteúdo já confirmada. Falha real de escrita ainda restaura o snapshot anterior e informa recuperação; conflito recuperável atualiza o snapshot a partir do banco e preserva o rascunho local.
- Os novos testes de navegador reutilizam as funções reais de seed/SM-2/XP em vez de duplicar modelos. Três imports locais receberam extensão `.js`, compatível com Vite e com a resolução NodeNext usada nos testes; nenhuma arquitetura de módulo foi substituída.
- Orientação HIG aplicada ao feedback de erro recuperável: `feedback.md > Best practices`, `undo-and-redo.md > Best practices` e `design-principles.md > Agency`. Sem mudança estética.

### 9B — Registros quantitativos, fixação e carregamento

- A auditoria reproduziu também edição obsoleta de quantidade registrada: sheets de dia conservam a versão inicial, validada atomicamente no repository. Atalhos binários continuam comandos sobre o estado atual, sem alterar a contagem de XP. Versões dos logs avançam mesmo no mesmo milissegundo.
- Fixar/desafixar informa o estado observado. Duas intenções de fixar baseadas no mesmo estado não podem se anular por um toggle atrasado; conflito é recuperável e não altera referências.
- Medições do baseline apontaram 81 KB comprimidos de JavaScript não utilizado no chunk inicial e download tardio da rota Hoje. O motor completo `domMax` do Framer Motion existente passa a um chunk dinâmico via LazyMotion; as quatro superfícies usam a API leve `m` com as mesmas propriedades. Nenhuma duração, spring, CSS, texto ou layout foi alterado. O chunk permanece no precache do Workbox. Não foi adicionada dependência.
- O HTML de produção antecipa o download de JS/CSS de Hoje. O CSS usa preload, sem ativar estilos de outra rota; atributos crossorigin coincidem com os recursos gerados pelo Vite. Demais rotas continuam lazy-loaded. Testes e Lighthouse final determinam a manutenção da otimização; probes são registrados separadamente, sem selecionar a melhor execução como resultado final.
- Um prefixo opcional `ATLAS_EVIDENCE_PREFIX` separa artefatos de novas auditorias. Asserções e cenários E2E anteriores permanecem intactos; sem prefixo, os caminhos históricos continuam compatíveis.

### 9B - Resultado e limite de publicação

- Três execuções frias e três de retorno por versão, todas com o mesmo Lighthouse 13.5.0/Edge 154/configuração mobile padrão. Baseline 80/85/86, final 89/87/87; medianas frias 85/87. Retorno mediano 100 nas duas versões. A meta fria de 90 continua pendente; não se declara prontidão para publicação. Não há deploy nesta etapa.
- A divisão do engine e preload da rota mantêm o visual/CSS e foram aprovados pelos 840 unitários e 103 E2E, incluindo precache/offline e duas versões reais do worker. Entrada caiu 20,4%; assets totais cresceram 0,33% e transferência fria 0,96%. Não se esconde esse custo nem se promete redução de todo o trabalho JS.
- Backups JSON e Markdown completo restauram dez coleções, perfil/pins, atividade e XP. O Markdown completo usa um snapshot de restauração embutido; a nota Markdown individual não preserva todos os vínculos. Preferências de aparência/widgets/foco/contextos em localStorage continuam fora do backup de conteúdo e não são apagadas pela limpeza de registros. Sem alterações de formato ou novas funcionalidades na auditoria.
- Auditoria Axe/layout automatizada não equivale a leitor de tela humano, zoom nativo ou instalação física. Esses testes permanecem explicitamente pendentes em REVIEW-ETAPA-9B.md.

## 9C — Markdown fora da inicialização

- O diagnóstico real de chunks confirmou `unified/remark-parse/micromark` na entrada por `note-links`, proteção de exemplos e conteúdo da sheet de dados. Foram separadas apenas essas fronteiras: `data-records.ts` mantém validação, IDs, merge e referências leves; `note-identity.ts` mantém normalização/resolução de título. Os exports síncronos antigos de `data-integrity.ts` e `note-links.ts` continuam disponíveis. Algoritmos de parsing/sanitização e schemas não foram reescritos.
- `saveNote` e `removeExamples` resolvem imports antes de abrir a transação Dexie. A leitura e a decisão de conflito/renomeação/remoção continuam dentro da transação sobre os dados atuais; não há espera de rede dentro de uma transação. Falha de carga não grava parcialmente. Seed, migrações, atividade, XP, backup e interface AtlasRepository foram conservados.
- A otimização visual de remoção conserva resposta síncrona para um conjunto inteiramente de exemplo. Se houver registro pessoal, mantém `busy` imediato e espera o grafo completo de wikilinks antes de ocultar exemplos; erros restauram o snapshot. O novo teste força carga tardia, reenvio e falha de escrita, mantendo links pessoais transitivos. Não se remove proteção para melhorar desempenho.
- O botão e o contrato acessível de Seus dados continuam no cabeçalho. Apenas o conteúdo/transferência/cálculo de exemplos da sheet é lazy; título, descrição e saída continuam imediatos. O browser testa Escape/foco durante download bloqueado e abertura offline. CSS e composição pronta da sheet são preservados. HIG: `loading.md > Best practices` e `feedback.md > Best practices`; revisão React: imports diretos, fronteira Suspense pequena e carga condicional.
- A hipótese de Markdown foi testada primeiro. O engine de animação, seus parâmetros, validação e fluxo de inicialização não foram alterados; não houve refatoração ampla nem biblioteca nova. Chunks dinâmicos continuam no precache. O probe frio de 93 é exploratório, não uma mediana nem aprovação da release.
- Baseline novo da 9C: 81/86/81 no frio, mediana 81, e 100/100/100 no retorno. Mesmo código e assets finais da 9B, cujo resultado anterior era 87/100. Essa variabilidade é publicada; comparações finais usarão as seis coletas atuais e manterão os históricos separados.
- Checklist de instalação física, NVDA, zoom nativo e dispositivos fica em MANUAL-RELEASE-CHECKLIST.md. Automação não preenche evidência humana; os passos dependentes de staging HTTPS permanecem separados. Nenhum push/deploy/publicação nesta etapa.

## Fechamento medido da etapa 9C — 06/10/2026

As três coletas finais frias deram 84/86/89 (mediana 86), e as de retorno 100/99/99 (mediana 99), com a mesma configuração dos seis baselines atuais. O LCP frio mediano passou de 3,658 s para 3,149 s; a entrada diminuiu 80.076 bytes e a transferência fria mediana diminuiu 23.792 bytes. A meta de 90 permanece **não aprovada**. O probe 93 não substitui a mediana. O histórico 9B de 87/100 também continua registrado, sem apresentar 86 como melhora sobre 87.

Mantemos o corte de dependências, validado por 843 unitários e 105 E2E, mas não alteramos o timing do engine, validação nem leituras transacionais sem outra hipótese e medição. O trabalho de main thread não diminuiu na mediana e o TBT de retorno aumentou nesta rodada; os relatórios registram isso. Próxima investigação sugerida: atribuir custo de inicialização/assinaturas e carga do engine com trace, seguida de uma única experiência controlada. Não repetir Lighthouse até obter uma execução favorável.

A preparação documental da 10A pode usar os artefatos locais, mas o fechamento técnico da release depende de atingir 90 ou de o usuário aceitar explicitamente a limitação de 86 para uma versão inicial, além das verificações humanas pendentes. Recomendação: continuar a otimização direcionada antes de aprovar o critério. Nenhum push, staging, deploy ou instalação física foi executado.

## 10A — documentação sem aprovação de release

- README/ARCHITECTURE/DATA-AND-PRIVACY/RELEASE-CHECKLIST consolidam o estado atual; reviews anteriores continuam como evidências históricas. Documentação não altera modelos, formatos, CSS, dependências ou funcionalidades. Frio 86/retorno 99 são resultados 9C, sem nova medição ou aceite presumido.
- Sete imagens de apresentação usam contexto Edge descartável e registros fictícios. Hoje recorta widgets para excluir a saudação pessoal fixa; não se altera DOM/CSS para uma captura mais favorável. Evidências antigas não foram apagadas. O caso de portfólio identifica desenvolvimento assistido por IA e não atribui domínio independente de toda a stack.
- JSON/Markdown completo preservam conteúdo/metadados via snapshot; nota .md individual tem contrato menor. Preferências/rascunhos/undo continuam fora do backup. Troca de origem exige exportar/importar e reconfigurar preferências; staging não migra dados automaticamente.
- .env/.env.* passam a ser ignorados, com exceção para .env.example de placeholders. Não foi criado ambiente nem encontrada variável obrigatória. Busca de padrões em texto não garante ausência de segredos no histórico/binários. Referências pessoais, log antigo, licenças/atribuições exigem revisão do titular; nada removido nem licença escolhida.
- Preflight local detectou HTML/200 também em asset JS ausente no preview. Futuro host deve distinguir fallback SPA de 404 de assets; nenhuma configuração de hospedagem foi criada. Escopo raiz, MIME, revalidação e recursos lazy/offline devem ser validados na futura URL HTTPS, após autorização.
- HIG aplicado à clareza documental/descrições acessíveis: references/hig/writing.md e accessibility.md, via hig-lookup. Sem novo redesign/auditoria integral. Checks 10A repetem lint/typecheck/843 unitários/build; sete capturas e preflight são smoke, não a suíte de 105 E2E da 9C. Testes humanos continuam não executados.
- A entrega para em documentação. Autorizar futura 10B depende de decisão explícita de performance, checklist humano, conteúdo/licença e destino/ações permitidas; não há push, tag, release ou deploy nesta etapa.

## Preparação 10B — staging sem publicação

- Hoje deriva saudação de profile.name já persistido, trim/fallback neutro. O placeholder de identificador usa exemplo fictício. Sem modelo, onboarding, composição, CSS, animação ou arquitetura novos. Quatro testes unitários e um browser verificam reação ao perfil, ausência/remoção de nome, escape de marcação, F5, mobile/Axe; teste de perfil existente ampliado. HIG: writing.md > Getting started (Be clear/Write for everyone), privacy.md > Best practices (Process data on the device where possible); React best-practices: derivação em render/imports diretos, sem novo effect ou memoização artificial.
- Candidatos textuais foram lidos localmente e classificados sem reproduzir valores pessoais; originais brutos/história não foram eliminados. Dois públicos corrigidos, cinco anonimizáveis, 85 locais e quatro decisões do titular, conforme disclosure-review-pre10b.json. Coleção antiga sem OCR integral permanece local por recomendação. .gitignore não retira commits/arquivos já versionados; novas evidências privadas e futuros metadados .vercel passam a ter regras específicas.
- A família do snippet Dock corresponde ao beUI público, licenciado MIT. Correspondência estrutural/SPRING_LAYOUT confirmada nas fontes; commit exato/cadeia do material recebido não fornecidos. Aviso integral de terceiros acompanha dist e não licencia o Atlas. COMPONENT-PROVENANCE documenta limites das outras referências e alternativa de implementação independente se a origem exata continuar necessária. Nenhuma biblioteca nova ou contato externo enviado.
- Destino proposto: Vercel Preview isolado/protegido, upload apenas de dist/config revisado, sem integração Git inicialmente. Exemplo de rewrites/headers está somente em docs, não ativo. Scope raiz exige origem estável para worker A/B; URL diferente a cada versão não testa atualização/persistência na mesma origem. Protection é do host e deve ser testada em dispositivos, não login do app. Sem domínio/conta/projeto remotos criados.
- Regex local exclui assets/icons/extensões de fallback SPA; não prova matcher/HTTP da Vercel. Cabeçalhos propostos têm motivos específicos; HTTPS/MIME/cache/404 e efeito da proteção permanecem checklist hospedado. Assets 404 não devem receber cache longo por override. Sem alterações de Vite/Workbox para esconder comportamento do preview.
- A última medição 9C permanece frio 86/retorno 99, sem nova medição/aceitação. Staging pode ser autorizado para medir/testar sem aprovar release. Ações externas futuras discriminadas em STAGING-PLAN; sem push, deploy, visibilidade, tag, release ou migração automática de dados. Licença própria, referências intencionais e autorização de conta/destino/proteção continuam humanas.

## Teste pessoal - manifest em hospedagem protegida

- `useCredentials: true` adiciona crossorigin ao link do manifest: configuração documentada pelo plugin para buscar com a sessão do host. Não cria autenticação do Atlas nem altera o escopo offline. Regressão local usa cookie fictício e service worker bloqueado para testar a requisição real do navegador sem confundir com precache; critérios de instalação/offline existentes continuam passando. Vercel e instalação física permanecem pendentes.
- O titular permite teste pessoal com performance fria ainda pendente; isso não é aprovação de release. Proposta usa Hobby/All Deployments autenticado, conforme disponibilidade pública atual, sem ativar pagamento/exceções. Cada dispositivo conserva seu banco independente. Pacote isolado apenas com build/config é preparado antes da confirmação; nenhuma ação remota de escrita foi executada.

## Marca fornecida pelo titular (2026-10-06)

- A bússola azul/prata fornecida substitui somente a marca do cabeçalho, favicon e ícones de instalação. O SVG e o ICO são preservados byte a byte, incluindo metadados de procedência do SVG; as imagens de referência não são carregadas pelo app. Não foram adicionadas dependências, modelos, migrações ou alterações nos dados.
- A marca tem tamanho de 2rem, proporção quadrada e fundo semântico `--brand-surface`, fixo e escuro, para preservar a arte e seu contraste nos dois temas. O link mantém o nome acessível e o alvo mínimo de 44px; a imagem decorativa não repete o anúncio. HIG: branding.md > Best practices (“Ensure branding always defers to content”); layout.md > Visual hierarchy; accessibility.md > Vision / Mobility; dark-mode.md > Icons and images.
- PNGs 180/192/512 são derivados do SVG sobre fundo opaco, sem máscara de cantos. O PNG maskable usa a arte centralizada em 448px dentro do canvas de 512px: o raio externo fica abaixo do círculo seguro de 204,8px. HIG: app-icons.md > Icon shape (“Keep primary content centered to avoid truncation”); icons.md > Best practices (vetores para nitidez). A aplicação web usa manifest/PNG, sem simular requisitos de app nativo Apple.
- Favicon SVG usa a mesma arte com fundo opaco; o ICO fornecido é fallback. Ambos entram no precache. Mantidos `useCredentials`, atualização por confirmação e proteções de hospedagem. O build atualizado é apenas local: o pacote e alias anteriormente autorizados não foram modificados nem reenviados.

## Rotina semanal local e hábitos por dia

- Programação é funcionalidade genérica; a configuração pessoal fica em `local-private/`, ignorada pelo Git e nunca aplicada como seed. A sheet permite revisar sete dias e associar IDs explicitamente, preservando hábitos não associados. Transação e versões observadas mantêm rollback/conflitos entre abas; importar não concede XP nem atividade.
- Campos opcionais `Habit.scheduleVersions` e `Snapshot.routine` usam os stores Dexie existentes. Uma versão por data de vigência preserva frequência, alvo/unidade e variações anteriores; hábitos antigos têm fallback diário/flexível. Não se misturam unidades de streak ao mudar entre semanas e ocorrências. Backup JSON/Markdown completo conserva os campos; nota Markdown individual não.
- Calendário é local; Hoje acompanha meia-noite e retorno ao app, enquanto Ontem/data histórica e formulário aberto ficam fixos. `dayOffset: 1` explicita madrugada vinculada ao dia anterior, com atribuição visível antes de salvar. Opcionais não reduzem progresso e dias sem obrigatórios são neutros. Regras e limites detalhados em `WEEKLY-ROUTINE.md`.
- Preservada a composição aprovada, com controles existentes DateField/sheets, listas e detalhes progressivos, sem agenda em checkboxes. HIG consultado: `accessibility.md`, `pickers.md`, `sheets.md`, `entering-data.md`, `lists-and-tables.md`, `keyboards.md`, `layout.md`, `typography.md` e `color.md`; prioridade para data explícita, foco/Escape, texto ampliado e informações opcionais sob demanda. Revisão React aplicada a imports diretos, carregamento condicional da sheet e cleanup dos timers/listeners. Nenhuma dependência nova.


## Lumen to Atlas - Stage 9C (2026-10-10)

- Strict single-note protocol separate from full backups and legacy Markdown conversion. SHA-256 framing/UTF-16 limits match the Lumen version-1 contract; full YAML/Markdown remains unchanged. The user approved `yaml` 2.9.1 as the sole added runtime dependency.
- Dedicated injected-database repository writes only one note and `meta.lumenTransferHistory.v1`; ordinary saveNote/link renaming, lifecycle actions, drafts, other entities and archive/delete undo remain untouched.
- The user explicitly approved local recovery with unchanged backup format. Complete before/after records and operation/version hashes commit atomically. Guarded restore retains prior fields with a fresh revision timestamp. Retention is 100 operations/20 MiB with no pruning; writes block at capacity.
- Current backups exclude recovery metadata. Restoring into a fresh database loses previous-version/identity evidence and blocks further updates. No schema/table migration, portable history format, UI, real-data import, sync or deployment in this stage. Details and executed evidence: LUMEN-ATLAS-STAGE9C.md.


## Lumen Stage 9D — interface e isolamento explícitos

Transferência manual em diálogos próprios da área de notas, reutilizando o
contrato, planner e repository Stage 9C. O único acesso novo no repository é a
consulta validada e somente leitura das operações recuperáveis. A edição não
muda de arquitetura: guard de drafts consulta schema/chave existentes e memória,
falhando conservadoramente sem apagar/salvar rascunhos. Não se promete atomicidade
localStorage/IndexedDB. A origem 127.0.0.1:4189 exige sessão de teste explícita e
banco distinto; testes de navegador usam contexto efêmero, sem perfil pessoal.
Schema/backup/retention permanecem intactos. Ver [Stage 9D](LUMEN-ATLAS-STAGE9D.md).

## Captura Lumen e ambiente de trabalho — 2026-11-03

Captura e processamento ficam no Lumen; Atlas solicita a operação e mostra sua
fila por uma ponte restrita a localhost, com token de sessão e origens exatas.
Não há credenciais Notion no frontend nem mudança no banco do Atlas. A validação
é estrutural e não concede revisão factual. Reutilizamos EntrySheet e tokens de
layout existentes, com estados textuais de conexão, fila e falha. Voz é uma
entrada opcional por clique com vocabulário fechado, sem escuta permanente.
Veja [configuração e limites](CAPTURE-WORKSPACE.md).

## Da captura à prática

A fila Lumen pode fornecer uma sugestão de exercício e o link de uma publicação
confirmada no Notion. A ação explícita no Atlas salva uma nota de referência e
abre TaskForm com vínculo interno já existente no schema. A tarefa só é gravada
ao confirmar o formulário; cancelar mantém a referência, conforme informado na
interface. IDs determinísticos evitam recriar a referência e o conteúdo editado
localmente não é sobrescrito. Não são inferidos estudo, minutos ou conclusão.

## Interface compartilhada e contexto — 2026-11-03

Atlas e Lumen compartilham a paleta preto/azul descrita em
`DESIGN-SYSTEM-ATLAS-LUMEN.md`. O Atlas mantém seus componentes e schemas;
o resumo do dia usa eventos reais e exclui exemplos das métricas pessoais.
O registro diário reutiliza notas com gravação explícita e controle de conflito.
O Lumen reúne captura, biblioteca, arquivos e contexto em uma janela. Informações
de agentes ficam numa pasta dedicada do Obsidian, fornecidas explicitamente;
não se lê todo o vault nem se envia esse contexto automaticamente.
Voz usa ações permitidas e não aceita comandos arbitrários do sistema.
Hermes e Orca foram instalados, mas autenticação do Hermes foi adiada pelo usuário.

## Redesign dos quadros, navegação preservada — 2026-11-03

O prompt anexo do Atlas orienta apenas a apresentação das telas existentes.
Nenhum dado real foi substituído por mocks e nenhuma integração foi desativada.
Os tokens novos são herdados somente em `#main`, preservando os estilos do dock
e toolbar. Hoje, tarefas, hábitos, notas, metas/projetos, estudos e foco receberam
quadros com bordas discretas, espaçamento e hierarquia consistentes. O anel de
foco representa o tempo restante da sessão real, com denominador na duração
registrada da sessão, sem modificar o timer. O mapa do dia ganhou papéis ARIA
compatíveis com seus rótulos.

O frontend novo do Lumen usa serviços tipados simulados conforme o novo prompt,
em paralelo ao aplicativo operacional Python. Essa fronteira evita transformar
o redesign em uma migração não solicitada de dados e integrações.

## Serviço local operacional e verificação completa
Atlas e Lumen agora compartilham um processo local que serve os builds compilados, sem depender do terminal Vite. Atlas mantém 127.0.0.1:4180 e seu armazenamento; rotas SPA têm fallback e assets ausentes retornam 404. Os testes unitários usam vitest.config.ts, separado dos plugins de produção, para evitar o bloqueio de coleta observado no Windows. A suíte completa passou com 1048 testes em 85 arquivos. Voz pt-BR usa um catálogo local de aplicativos, sem interpretar texto como shell. A navegação inferior foi preservada.

## GitHub Pages e testes - 05/11/2026
O build com GITHUB_PAGES=true usa /atlas/ para assets, preload e PWA. HashRouter evita depender de fallback do servidor em rotas diretas; builds locais mantêm BrowserRouter e suas origens. Workers isolados em threads evitam a coleta bloqueada observada no Windows. A suíte completa passou com 1048 testes; nenhuma asserção ou limite foi removido. Dados pessoais continuam fora do repositório e não são migrados para o site automaticamente.
