# Revisão — etapa 4: tarefas

## Contexto

Aplicação web React para rotina pessoal de estudo e software. Princípios e fundamentos do HIG se aplicam; convenções de menus/janelas nativas não são impostas. A tese da tela é transformar uma frase em um próximo passo, com os detalhes disponíveis quando necessários. Lista editorial e captura curta mantêm o conteúdo como protagonista; o heatmap continua a assinatura do Atlas.

Avaliação no escopo: **Good**. Achados críticos corrigidos; ensaio manual com leitor de tela e auditoria global permanecem como limites explícitos.

Referências carregadas via `hig-lookup.md`: accessibility, layout, typography, color, designing-for-macos, cross-platform, lists-and-tables, text-fields, sheets, buttons, segmented-controls, drag-and-drop, undo-and-redo, keyboards, motion; pickers consultado no calendário. Código revisado também com react-best-practices.

## Achados e correções

### Critical — alternativa ao arraste e continuidade do teclado

- **O quê:** arrastar sozinho impediria mover tarefas por teclado/toque. Trocar de coluna desmonta a linha, podendo perder o foco.
- **Por quê:** `drag-and-drop.md > Best practices`: “Offer alternative ways to accomplish drag-and-drop actions.” `accessibility.md > Speech` pede navegação pelo teclado.
- **Correção:** select Situação em cada linha executa a mesma operação transacional. Após mover, o foco vai para o mesmo controle na tarefa de destino; se o filtro a ocultar, retorna para Nova tarefa. Colunas realçam o destino aceito e informam a situação textualmente.

### High — feedback cobrindo ações

- **O quê:** aviso persistente após a captura cobria “Nova tarefa neste dia” quando a página rolava até a ação.
- **Por quê:** `layout.md > Visual hierarchy` diferencia controle e conteúdo; `accessibility.md > Mobility` exige controles confortáveis e disponíveis. Evitar sobreposição é aplicação desses princípios ao layout web.
- **Correção:** notificação com ação Desfazer fica no fluxo após a captura, sem sobrepor controles. Pode ser fechada explicitamente; erros em sheets permanecem junto ao formulário.

### High — capturar sem perder intenção

- **O quê:** descartar uma data ou prioridade inválida apagaria parte do que a pessoa escreveu. Mapas de palavras com propriedades herdadas também poderiam interpretar “constructor” como metadado.
- **Por quê:** agência, clareza e validação de `text-fields.md > Best practices`; comportamento específico do parser é decisão de produto.
- **Correção:** metadados separados em palavras, Maps sem propriedades herdadas, tokens inválidos/conflitantes preservados no título com aviso. Interpretação sempre visível antes da criação. Tags mantêm acentos e são normalizadas em NFC.

### High — recorrência e recuperação de dados

- **O quê:** duas conclusões simultâneas ou reabrir/reconcluir poderiam duplicar ocorrências; falha de escrita poderia aparentar sucesso.
- **Por quê:** recuperação previsível de `undo-and-redo.md > Best practices`: “Help people predict the results of undo and redo”. Atomicidade é decisão de engenharia que sustenta essa experiência.
- **Correção:** tarefa original, sucessor e marcador de ocorrência na mesma transação. IDs próprios, subtarefas desmarcadas e foco zerado no sucessor. UI otimista com rollback e erro acionável. Exclusão protege vínculos, guarda delta persistente e desfaz sem sobrescrever registros existentes.

### Medium — densidade e tamanho de texto

- **O quê:** detalhes extensos em cada linha, três colunas rígidas e um calendário comprimido reduziriam a leitura em celular/zoom.
- **Por quê:** `layout.md > Adaptability`: “Be prepared for text-size changes.” `lists-and-tables.md > Content` pede texto reconhecível e detalhes sob demanda.
- **Correção:** detalhes em sheet com Cancelar/Escape e retorno de foco. Linhas quebram metadados/select; nomes de tarefas têm descrição acessível com prazo, prioridade, contexto e progresso. Colunas empilham em telas estreitas. Grade mantém alvos de 44 px e rolagem interna, com campo de data equivalente e lista do dia. Listas acima de 200 itens virtualizadas em todas as visões, com setas/Home/End.

### Low — contexto e datas previsíveis

- **O quê:** contextos chamados “all”/“none” poderiam colidir com valores internos de filtro; sem prazo e meses curtos precisam de comportamento explícito.
- **Por quê:** clareza e hierarquia de `layout.md > Visual hierarchy`; semântica específica é julgamento de produto.
- **Correção:** filtros com prefixo para valores reais. Sugestões editáveis preservam os contextos existentes. Calendário oferece Sem prazo. Repetição pula atrasos e ajusta meses curtos; README explica limites da gramática e o fato de reabrir não apagar o sucessor.

## Craft e materiais

Uma cor de destaque, números tabulares e separadores discretos. Check combina ícone e estado, prioridade/prazo têm texto. Conteúdo e calendário sólidos; glass fica no cabeçalho da sheet e na navegação existente. Feedback breve de mola no check é desativado por reduced motion; texto nunca recebe fade. Tokens do tema preservam contraste nas duas aparências. `motion.md > Best practices`: “Make motion optional.”

## Verificação e limites

Lint e typecheck limpos; build de produção sem warnings. **208 testes unitários/integração aprovados**, incluindo 88 casos puros de parser/calendário/repetição, 18 transações de tarefas, 2 testes de rollback da store e validação de contextos; regressões das etapas anteriores preservadas. Tarefas usa rota carregada sob demanda (aproximadamente 31 kB, 10 kB gzip, além dos chunks compartilhados). O limite de warning não foi alterado.

Capturas em `docs/screenshots/etapa-4-*`. Sem alegação de Lighthouse ou ensaio manual com leitor de tela. PWA/recarga offline, captura global/atalhos e Pomodoro permanecem nas etapas 8, 5 e 7, respectivamente.

**20 testes E2E aprovados no build de produção com Edge**, em contextos descartáveis sem perfil pessoal. Oito fluxos novos de tarefas: captura e persistência, detalhes/subtarefas/repetição idempotente, adiar/excluir/desfazer após reload, arraste e teclado, calendário, sugestões e filtros de contexto, nove combinações de visão/largura (375/768/1280) com temas claro/escuro e texto 200%, listas de 210 tarefas nas três visões. Axe WCAG A/AA sem violações nos cenários verificados, alvos de 44 px e foco das sheets/ações. As doze regressões anteriores continuam aprovadas, incluindo exportar, limpar e importar JSON/Markdown sem perdas.

O campo textarea de contextos é encontrado pelo nome acessível com `getByRole`, pois `getByLabel` também incluía o conteúdo inicial do campo na busca do teste. O nome acessível real foi verificado explicitamente. As capturas foram revisadas; transparência e reduced motion usam as mesmas regras globais já verificadas na regressão e o hook useReducedMotion para checks.

Após os últimos ajustes de descrição acessível e texto do estado vazio, os oito fluxos de tarefas foram repetidos no novo build e passaram, incluindo assert da descrição de prazo, horário, prioridade e tags. Lint, typecheck e os 208 testes também foram repetidos e permaneceram limpos.

Undo guarda a última exclusão; não há histórico geral de undo/redo. Reabrir uma tarefa recorrente conserva seu sucessor. Marcadores de recorrência e sugestões de contextos são operacionais/preferências e não integram o backup de conteúdo. Importar uma tarefa já concluída e reabri-la evita duplicar sua ocorrência. Intervalos mensais usam como referência o prazo da tarefa concluída, sem modelo de série ancorada por dia do mês. Nenhum dado pessoal do navegador é usado nos testes.
