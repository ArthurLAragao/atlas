# Atlas — QA e integridade, etapa 9B

Auditoria iniciada em 05/10/2026 sobre `eb7c770`, com Git limpo. Última correção de produto anterior: `78dabf4`. A composição, os tokens, CSS e movimentos da 9A permanecem congelados. Sem publicação, backend ou novas funcionalidades.

## Baseline e distinção de falhas

| Verificação anterior às correções | Resultado real                                         |
| --------------------------------- | ------------------------------------------------------ |
| Lint, typecheck e build           | Aprovados                                              |
| Unitários                         | 825 testes, 64 arquivos; 246,48 s com `--pool=threads` |
| Browser                           | 97 testes; 10,2 min                                    |
| Lighthouse                        | Três frios: 80/85/86; três retornos: 99/100/100        |

As tentativas unitárias inicialmente interrompidas por falta de saída intermediária não produziram falhas de asserção; não são contabilizadas como testes reprovados. O comando padrão depois concluiu com 838 testes/66 arquivos em 238,73 s. Um comando de diagnóstico sob sandbox encontrou `spawn EPERM` ao carregar Vite/Tailwind; a execução local autorizada resolveu a restrição sem alterar dependências.

Novos testes reproduziram quatro falhas de concorrência antes do primeiro fix e outras duas antes do segundo. Dois testes adicionais reproduziram falso feedback de falha após escrita confirmada. Logs locais: `audit-9b-reproduction.log`, `audit-9b-feedback-reproduction.log`, `audit-9b-additional-reproduction.log`. São descobertas da auditoria sobre código existente, embora a suíte anterior estivesse verde.

Problemas introduzidos no trabalho de auditoria foram separados: imports de fixture incompatíveis com NodeNext e tratamento genérico da nova classe de conflito foram corrigidos. Os primeiros E2E novos também tinham um seletor inexistente de edição de hábito e recarregavam antes da confirmação de Retomar; corrigiu-se a sequência do teste, mantendo todas as asserções de persistência.

## Achados e correções

| ID / severidade       | O quê                                                                        | Por quê                                                                         | Correção / regressão                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 — Crítica          | Editor antigo de tarefa sobrescrevia título, estado e vínculos de outra aba  | Escrita genérica não comparava a versão carregada                               | Versão original comparada na transação; token monotônico; teste de duas conexões no mesmo milissegundo e browser                                                     |
| C2 — Crítica          | Editor antigo de hábito substituía conteúdo novo ou recriava hábito removido | Ausência de comparação de versão/ausência                                       | Compare-and-save com versão ou `null` de criação; rascunho preservado                                                                                                |
| C3 — Crítica          | Sheet de perfil substituía edição de outra aba                               | Formulário enviava snapshot antigo completo                                     | Compara campos com perfil original; recusa conflito recuperável                                                                                                      |
| C4 — Crítica          | Salvar perfil apagava referências fixadas durante a edição                   | Pins antigos eram gravados junto com os campos do formulário                    | Preserva os pins atuais da transação; teste unitário e duas abas reais                                                                                               |
| C5 — Crítica          | Quantidade de hábito salva em outra aba era substituída por editor antigo    | Log não tinha versão esperada                                                   | Sheet conserva versão inicial; comparação atômica e timestamp monotônico; unitário e browser                                                                         |
| A1 — Alta             | Duas intenções de fixar o mesmo item se anulavam                             | Toggle operava sobre estado mais recente sem conferir intenção observada        | Estado observado enviado ao repository; conflito não altera a fixação                                                                                                |
| A2 — Alta             | Tarefas/hábitos gravados apareciam revertidos com mensagem de falha          | Leitura auxiliar de Desfazer lançava erro após transação de conteúdo confirmada | Isola leitura de metadata; sucesso permanece; falha real de escrita ainda faz rollback                                                                               |
| A3 — Alta             | Nome/frase digitados enquanto avatar abria podiam desaparecer                | Callback assíncrono mesclava estado capturado antes do processamento            | Atualização funcional somente da imagem; teste com bitmap deliberadamente pendente                                                                                   |
| M1 — Média / anterior | Hábitos não oferecem arquivamento                                            | Modelo e UI não implementaram esse recurso nas etapas anteriores                | Registrado como lacuna; sem acrescentar funcionalidade na auditoria                                                                                                  |
| M2 - Média / pendente | Primeiro acesso mobile abaixo da meta 90                                     | Rota crítica tardia e JavaScript inicial excessivo                              | Resource hints de Hoje e motor completo de animação separado; mediana fria 85 → 87, retorno 100 → 100. Critério não aprovado; diagnóstico em PERFORMANCE-AUDIT-9B.md |

Nenhuma correção visual por gosto. As mensagens de conflito explicam como recuperar; inputs e rascunhos continuam abertos. O snapshot de outra aba é recuperado após conflito, em vez de fingir sucesso.

## Matriz dos fluxos reais

| Módulo           | Fluxos verificados                                                                                                                                                                                                                 | Evidência automatizada                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Hoje             | Prioridades, excesso sugerido, pendências e adiamento, compromisso manual, meta semanal explícita, hábitos, ordem/visibilidade/restauração de widgets, captura e atalhos                                                           | `today.spec.ts`, `preferences.spec.ts`; seleção e relógio em `src/lib/*.test.ts`                 |
| Tarefas          | Parser PT-BR, data/hora, tags/contextos, prioridade, repetição sem duplicar sucessor, subtarefas, Lista/Kanban/Tabela/Calendário, busca/filtros/contagens, menu e drag, excluir/cancelar/undo, vínculos                            | `tasks.spec.ts`, `stage9a.spec.ts`, `audit9b.spec.ts`; repositories, parser, filtro, calendário  |
| Hábitos          | Binário/quantidade, frequência diária/semanal, descanso sem conclusão, passado/futuro, edição e exclusão de log, sequência e intensidade, virada de semana/ano                                                                     | `habits.spec.ts`, `audit9b.spec.ts`, `habits.test.ts`; arquivamento ausente confirmado no código |
| Notas            | Criação/salvamento/rascunho, erro sem perder texto, arquivo/exclusão/undo, Markdown seguro, templates, título/conteúdo/tags, wiki/autocomplete/backlinks, rename e ambiguidades, preview mouse/foco/touch, importação e duplicatas | `notes.spec.ts`, `stage9a.spec.ts`; note-links, markdown-import, drafts e repositories           |
| Metas e projetos | KR manuais complementados por tarefas, prazos/estados, meta semanal exclusiva, relações por ID, criação contextual sem cópia, remoção e restauração de vínculos, pins                                                              | `directions.spec.ts`, `stage9a.spec.ts`, `audit9b.spec.ts`                                       |
| Estudos          | Avaliações/médias explicadas, faltas e unidade, eventos e tarefas, countdown, trilhas/próxima etapa/checklist, relações, flashcards 0–5 e SM-2                                                                                     | `study.spec.ts`, `focus.spec.ts`; `study.test.ts`, `sm2.test.ts`, LearningRepository             |
| Foco             | Start/pause/resume/restart/end, duração ativa real, foco separado de pausas, F5/segundo plano, horário previsto excedido, duas abas, idempotência e nenhuma tarefa concluída automaticamente                                       | `focus.spec.ts`, `audit9b.spec.ts`, `focus.test.ts`, focus-repository                            |
| Perfil           | Edição/avatar local, métricas, atividade distinta de XP, deduplicação, sequência, heatmap/texto, filtros/histórico e pins ausentes                                                                                                 | `stage9a.spec.ts`, `audit9b.spec.ts`; activity/profile tests                                     |
| Preferências     | Temas/destaques, normalização, movimento/transparência, widgets, foco, XP sem duplicata, import/export/limpeza, instalação/update                                                                                                  | `preferences.spec.ts`, `experience-design.spec.ts`, `pwa*.spec.ts`                               |

As telas usam dados reais de um seed descartável ou fixtures importadas; não se assume implementação de itens só por estarem nos prompts. Sem grafo, IA, integrações, notificações ou login.

## Integridade, migrações e backups

- Dez coleções IndexedDB + metadata. IDs globais, referências, versão do envelope, tipos, timestamps, limites e duplicatas são validados antes de persistir. Operações com relações usam transações Dexie, com testes de rollback e estado inválido. Versões v1 → v3 e v2 → v3 têm regressões, sem duplicar seed ou reintroduzir exemplos removidos.
- Testes de duas conexões garantem um vencedor para a mesma versão; testes de duas abas preservam o rascunho perdedor. Cliques rápidos, revisão repetida, recorrência, foco e ledgers de XP/atividade têm verificações de idempotência. Não se promete resolução automática de conflitos: a intenção antiga é recusada.
- Datas de hábito, revisão e prazo são locais; instantes operacionais usam ISO timestamps. Testes incluem meia-noite, semana, mês, ano e ano bissexto. Médias de estudos normalizam cada avaliação para 0–10; com qualquer peso explícito, pesos omitidos valem 1. Faltas são encontros/aulas, não horas convertidas automaticamente da carga horária. Isso não declara uma política acadêmica da UNIFOR.
- Quota e bloqueio de armazenamento têm mensagens recuperáveis e testes de falha de escrita; não foi esgotado o disco real do usuário. Bancos de testes usam nomes `audit-9b-UUID`; browser usa contextos novos sem perfil/storageState pessoal.

### Ida e volta efetivamente executada

Conjunto representativo: 3 tarefas, 6 hábitos, 1 log, 2 notas, 1 meta, 2 projetos, 2 disciplinas, 3 trilhas, 1 flashcard e 1 sessão; perfil/pins, atividade e XP. Exportar → limpar **somente banco descartável** → importar → comparar snapshot integral → F5/reabrir → comparar novamente. Unitários incluem avatar, metadata e reimportação idempotente; browser exercita a confirmação forte e arquivo real baixado. Evidências: `roundtrip-9b-json.json`, `roundtrip-9b-md.json`.

| Formato               | Preserva                                                                    | Limite/observação                                                                        |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| JSON Atlas            | Dez coleções, campos e relações por ID, perfil/avatar/pins, atividade e XP  | Envelope v1; merge conserva registros existentes; exemplos importados tornam-se pessoais |
| Backup Markdown Atlas | Texto legível e snapshot equivalente ao JSON dentro de bloco de restauração | A restauração vem do bloco; editar só o texto humano não atualiza esse snapshot          |
| Nota `.md` individual | Título, tags, arquivamento, conteúdo e wiki links                           | Não restaura projetos, metas, sessões ou todos os relacionamentos                        |

Tema, duração de foco, contextos e organização dos widgets são preferências em localStorage: **não entram no snapshot JSON/Markdown atual** e são mantidos pela limpeza total. Rascunhos e undo não são backups. Limpeza total remove registros, perfil/histórico/XP e rascunhos, com frase `APAGAR TUDO`, confirmação adicional e exportação prévia disponível; não é uma exclusão com undo.

Importações são locais. JSON completo aceita até 50 MB; entrada Markdown de backup tem limite de 5 MB. Notas Markdown: até 20 arquivos, 1 MB cada, total 10 MB, 500 mil caracteres por nota. Duplicatas têm decisão explícita. Markdown renderizado não executa HTML/iframes/scripts, não carrega imagens externas e recusa URLs ativas. Os testes verificam extensão inválida, limites, conflitos, cancelamento e persistência.

## Acessibilidade e revisão apple-design

`accessibility-9b.json`: 192 estados (12 telas/visões × 4 larguras × 2 temas × texto 100/200%), sem violações WCAG A/AA/2.1 AA, sem overflow de documento, sem pageerror. Movimento reduzido no navegador e transparência reduzida persistida. `contrast-9b.json`: 36 pares de tokens opacos aprovados; menor contraste textual 5,53:1. Isso não substitui avaliação humana de todos os blends e estados.

| O quê                              | Por quê (HIG lido)                                                             | Correção/validação                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Erros de concorrência recuperáveis | `feedback.md > Best practices`; `design-principles.md > Agency`                | Texto claro, rascunho mantido, sem fechamento ou sucesso falsos                                                  |
| Exclusões e limpeza                | `alerts.md > Best practices`; `undo-and-redo.md > Best practices`; `sheets.md` | Cancelar inicial, Escape, contenção/restauração de foco, undo normal e limpeza forte; E2E preservados            |
| Teclado e alternativas             | `keyboards.md > Best practices`; `focus-and-selection.md`                      | Palette/atalhos, ações equivalentes de mover, preview explícito, calendário por setas, tabelas/heatmaps em texto |
| Texto e larguras                   | `accessibility.md > Best practices`; `layout.md`, `typography.md`              | 375/768/1280/1440, 200% via tamanho raiz; tabelas em região de rolagem sinalizada; sem recomposição estética     |
| Temas, efeito e movimento          | `color.md`, `dark-mode.md`, `materials.md`, `liquid-glass.md`, `motion.md`     | Tokens preservados, opacidade quando reduzida, mesmos movimentos com API leve e engine completo no precache      |

A suíte E2E também cobre sheets, preview, importação, toolbar e campos de calendário em estados interativos com Axe/teclado, alvos de 44 px e foco. A matriz de 192 estados precedeu a separação final de JS; CSS e estrutura dos componentes não mudaram e o E2E integral foi repetido no build final. O crescimento de texto a 200% foi automatizado; não se declara zoom físico de navegador/dispositivo, VoiceOver/NVDA humano ou Safari validado. Capturas têm prefixos `audit-9b-*`.

## PWA e estado final

Resultado final: **lint, typecheck e build aprovados; 840 testes/66 arquivos (249,93 s); 103 E2E (10,1 min)**. Nenhum teste removido, pulado ou com timeout aumentado. Duas asserções exatas de timestamp de tarefa foram atualizadas para exigir avanço monotônico de 1/2 ms, mantendo a verificação integral dos campos. As mudanças nos E2E antigos somente acrescentam prefixo opcional ao caminho das evidências; a asserção de rascunho/timer no teste de atualização foi ampliada.

O candidato final tem 66 entradas no precache. Primeiro acesso online/preparação, recarga offline, acesso offline às oito rotas adicionais e recursos lazy (inclusive importação Markdown/calendário), escrita/reconexão sem perda, instalação validada por CDP e duas revisões reais do Workbox passaram. Uma cópia temporária do build com revisão de HTML distinta prova troca efetiva do worker; não se substituiu o teste por evento sintético. “Agora não” mantém o HTML anterior; “Atualizar” carrega o novo. Rascunho Markdown não salvo e timer em andamento persistem após atualização/F5. Outros formulários têm aviso para salvar antes da recarga; não se promete recuperação de todo campo não salvo.

`audit-9b-final-pwa-installability.json`: Edge em perfil temporário fora do modo anônimo, sem erros de instalabilidade; instalação física não executada. `audit-9b-final-*.log` guarda a saída local dos scripts. Logs são ignorados pelo Git; relatórios estruturados e screenshots ficam versionados.

Pendências manuais: instalação física Android/iOS/desktop, VoiceOver/NVDA, Safari/WebKit, zoom nativo, cenários de quota real e encerramento forçado do processo/sistema. Não houve instalação no perfil pessoal nem limpeza de dados do usuário.
