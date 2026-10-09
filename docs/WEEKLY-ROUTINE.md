# Rotina semanal e hábitos por dia

Funcionalidade genérica, sem rotina pessoal embutida ou agenda transformada em tarefas.

## Programação e atribuição

- Modos: todos os dias, dias específicos e frequência flexível por semana. Segunda/quarta/sexta é diferente de três vezes sem dias fixos.
- Cada variação tem dia, label, horário opcional, `dayOffset` (0 ou 1), ordem e opcionalidade. Mantém um ID e histórico por hábito; horário não comprova execução.
- Obrigatórios e opcionais são separados. Opcionais não reduzem progresso nem são exigidos com `timesPerWeek: 7`; dias sem obrigatórios são neutros. Heatmap explica a programação e tem alternativa textual.
- Ordem usa horário + deslocamento de dia; `order` e ID desempatarão horários iguais. Sem horário usa posição estável “Ao longo do dia”, sem prazo.
- Hoje acompanha a data local após meia-noite, foco, reabertura ou suspensão. Ontem/data histórica e formulário aberto não mudam silenciosamente. Outros widgets continuam usando o dia real.
- Madrugada com `dayOffset: 1` pertence à rotina da data anterior. “Registrar em Ontem” mostra a atribuição antes de salvar; não há conclusão ou mudança automática de data.
- Versões por data de vigência preservam definições anteriores, incluindo alvo/unidade. Mudanças no mesmo dia substituem somente essa versão. Dias de intervalo/opcionais não são faltas; semanas flexíveis e ocorrências fixas não somam unidades de sequência.

## Revisar e importar

1. Exporte um backup completo antes de alterar a programação.
2. Em Hábitos, escolha **Importar rotina semanal** e selecione seu JSON privado.
3. Revise os sete dias e variações. Associe cada hábito a um ID compatível ou escolha criar novo; não há fusão por similaridade de título.
4. Confirme **Confirmar e aplicar rotina**. Vigência começa na data local da confirmação; hábitos não associados e registros anteriores permanecem.
5. Use **Biblioteca → Editar hábito → Dias, horários e variações** para gerenciar todos os históricos, mesmo fora da programação do dia.

Formato `atlas-weekly-routine`, `schemaVersion: 1`, até 1 MiB, sete dias e até 100 hábitos; schema em [routine-models.ts](../src/data/routine-models.ts). Fixtures de testes são fictícias, não configurações pessoais. Mantenha seus arquivos fora do Git e da hospedagem.

## Compatibilidade e limites

Campos opcionais `Habit.scheduleVersions` e `Snapshot.routine` reutilizam o IndexedDB v3 existente. Hábitos antigos conservam frequência/histórico. Importação é atômica, valida tipos/unidades e recusa dados obsoletos observados em outra aba; aplicar programação ou trocar data não gera XP/atividade.

JSON e backup Markdown completo incluem rotina/versões e preservam IDs/relações. Backups antigos são aceitos; merge conserva IDs e rotina já existentes. Uma nota Markdown individual não restaura rotina; preferências/rascunhos continuam fora do backup de conteúdo.

Computador e celular conservam bancos separados, sem sincronização. Publicar código ou atualizar o PWA não importa configuração pessoal. Instalação física, leitor de tela humano e zoom nativo dependem de validação manual. Resultados automatizados desta cópia estão em [VALIDATION](VALIDATION.md).
