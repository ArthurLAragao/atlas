# Rotina semanal e programação de hábitos

Implementação no checkout original, com configuração pessoal separada do código. Sem push, deploy ou aplicação automática a qualquer banco pessoal. A cópia pública permanece intacta.

## Datas e programação

- Cada hábito conserva um ID. `scheduleVersions` adiciona versões por data local de vigência, com modo diário, dias específicos ou frequência flexível semanal. Dias específicos contam ocorrências; frequência flexível continua contando semanas, sem exigir dias fixos.
- Cada variação contém dia da semana (domingo = 0), label, horário opcional, `dayOffset` (0 ou 1), ordem e opcionalidade. Horários são planejamento; nunca concluem registros. Sem horário significa “Ao longo do dia”, ordenado consistentemente entre manhã e tarde, sem impor prazo.
- `HabitLog.date` continua sendo a data de atribuição. Um horário após meia-noite com `dayOffset: 1` pertence à rotina da data anterior. “Registrar em Ontem” abre o formulário com essa data visível; não há troca automática de atribuição.
- Hoje segue o calendário local do dispositivo. Um timeout para a próxima meia-noite, foco, `pageshow`, retorno de visibilidade e verificação periódica atualizam o dia. Ontem/data histórica fixa não muda após suspensão ou meia-noite; um formulário aberto também conserva sua data. Tarefas e demais widgets continuam usando o dia real.
- Obrigatórios e opcionais são separados; opcionais ficam recolhidos e não reduzem o progresso obrigatório. Um dia sem obrigatórios é neutro. O heatmap informa o denominador, dias sem programação e registros de descanso; há alternativa textual e teclado.
- Dias de intervalo e opcionais não interrompem sequências de ocorrências. Descanso preserva a sequência sem incrementá-la. Quando o modo muda entre semanal e diário/fixo, as unidades de sequência não são somadas; a programação anterior continua disponível nas consultas históricas.

## Modelo e compatibilidade

`Habit.scheduleVersions` é opcional. Hábitos antigos usam `timesPerWeek`: 7 corresponde a diário, demais valores a frequência flexível. A primeira alteração captura a definição antiga (incluindo alvo e unidade) antes de acrescentar a versão de hoje. Datas anteriores são preservadas; alterações no mesmo dia substituem somente a versão desse dia. A granularidade é diária, não por horário de edição.

O resumo semanal fica em `Snapshot.routine` / chave `weeklyRoutine` do store `meta`, com versões por vigência. Os stores e índices Dexie v3 permanecem compatíveis; não foi necessário reescrever o banco nem migrar IDs. Importação da configuração e suas associações é uma transação atômica. Versões observadas de rotina/hábitos impedem sobreposição silenciosa por outra aba; erros de escrita fazem rollback. Registros, vínculos, XP e atividade não são gerados ao trocar data ou aplicar programação.

Backup JSON e backup Markdown completo Atlas incluem rotina e versões. Backups antigos continuam aceitos. Ao mesclar backups, IDs existentes e a rotina atual prevalecem; restaurar integralmente requer banco vazio e confirmação de limpeza. Uma nota `.md` individual não representa a rotina. Preferências gerais em localStorage continuam fora do backup de conteúdo, como antes.

## Revisar e aplicar a configuração pessoal

1. Exporte um backup pelo menu **Seus dados** antes de alterar sua organização.
2. Abra o build local (`npm run dev`) e entre em **Hábitos → Importar rotina semanal**.
3. Selecione `local-private/rotina-aprovada.json`. Esse arquivo está fora do Git e contém a rotina aprovada; não é seed público e não foi aplicado automaticamente.
4. Revise os sete dias, aulas, planejamento e variações. Para cada hábito, associe explicitamente um histórico existente compatível ou escolha **Criar novo hábito**. Não há associação por similaridade de título. Históricos quantitativos exigem a mesma unidade; não são convertidos silenciosamente em binários.
5. Confirme **Confirmar e aplicar rotina**. A vigência começa na data local da confirmação. Hábitos não associados continuam disponíveis; nada é removido. Escolher “Criar novo” em outra importação cria outro histórico: revise os IDs para evitar duplicação intencional.
6. Confira Hoje/Ontem e **Biblioteca**. Para ajustes, selecione o histórico, **Editar hábito → Dias, horários e variações**.

A configuração genérica aceita JSON de até 1 MB, formato `atlas-weekly-routine`, `schemaVersion: 1`, sete dias e até 100 hábitos; tipos/horários/versões são validados localmente. O esquema está em `src/data/routine-models.ts`. Fixtures de testes são fictícias e não copiam horários ou disciplinas pessoais. Arquivos privados e backups contendo rotina não devem ser publicados.

## Validação e limites

Os testes cobrem sete dias, labels com ID estável, dias fixos/flexíveis, opcionais, madrugada, histórico versionado, ida/volta JSON/Markdown, banco antigo, rollback, conflito entre abas, idempotência de XP/atividade, meia-noite e retorno após suspensão. Os cenários de browser usam perfis descartáveis, seleção Hoje/Ontem, aplicação/cancelamento, edição, persistência e offline, teclado/Escape, Axe, 375/768/1280 px, claro/escuro, movimento reduzido e texto a 200%.

- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados. `npm run test`: 871 testes em 73 arquivos aprovados, mantendo os 847 anteriores e adicionando 24 regressões.
- `npm run test:e2e`: 114 cenários exercitados, incluindo os 109 anteriores e cinco novos. A execução completa final aprovou 113/114; o restante falhou no helper de diagnóstico, que navegava para Preferências antes de injetar erro. O helper passou a ler IndexedDB na mesma página e a reexecução `npm run test:e2e -- --last-failed --repeat-each=2` selecionou/aprovou 1/1. Não há falha pendente, mas não se declara uma execução completa única com 114/114. Na primeira execução, 112/114 passaram; as esperas de persistência foram reforçadas, mantendo todas as asserções anteriores.
- O sandbox restringiu o carregamento nativo de Vite/Tailwind (`spawn EPERM`); testes/build foram executados com a permissão local necessária. Isso não exigiu dependências novas nem acesso externo a dados.

Instalação física, leitura humana com leitor de tela e aplicação à rotina pessoal não foram validadas nesta tarefa. O app hospedado/instalado permanece na versão anterior; atualização exige autorização separada para preparar pacote e deploy. Computador e celular têm bancos independentes, sem sincronização.

## Fechamento para revisão da atualização genérica — 2026-10-09

O titular aprovou o conteúdo da configuração pessoal para aplicação local, mas fará a associação de históricos e a confirmação pela interface. Essa aprovação não aplica o arquivo automaticamente e não autoriza upload, push ou deploy. A cópia pública não foi modificada.

- Regressões explícitas: com `timesPerWeek: 7`, tanto no modo diário quanto no flexível, cinco dias obrigatórios e dois opcionais exigem somente cinco conclusões; registros opcionais não alteram o denominador nem quebram a sequência. Um fim de semana apenas opcional permanece neutro.
- Registro genérico às `02:30` com `dayOffset: 1` usa a data explícita da noite anterior; repetir a gravação não cria outro log, XP ou atividade. O teste usa banco descartável, não a configuração pessoal.
- Ordem testada com valores conflitantes: horário + deslocamento de dia prevalecem sobre `order`; este desempata horários iguais, seguido do ID. Um item às `02:30` do dia seguinte vem depois de `23:30` da data de atribuição. Itens sem horário continuam na posição estável já definida.
- Teste de browser ampliado verifica que concluir um opcional do fim de semana persiste o registro sem aumentar o contador obrigatório. Nenhuma asserção anterior foi removida.
- Checks locais: lint, typecheck e build aprovados; 875 testes unitários em 73 arquivos aprovados (259,33 s). Os 24 testes direcionados de programação/repository passaram. Suíte E2E integral: **114/114 aprovados em uma única execução de 10,9 min**, depois da última correção do helper e da ampliação das asserções de opcionais. Sem `--last-failed`, retries, testes removidos, pulados ou enfraquecidos. Os cinco cenários de rotina, regressões existentes, ida/volta de backup, duas abas, Axe, offline/rotas lazy e atualização real de service worker passaram.

Pacote de revisão local: `.vercel/routine-preview-20261009/`, **71 arquivos / 1.531.129 bytes**. Contém somente os arquivos de `dist` e `vercel.json` preservado byte a byte da configuração anteriormente revisada. Relação de nomes, tamanhos e SHA-256 em `.vercel/routine-validation/package-inventory.json`; hash SHA-256 desse inventário: `78efed9c156e9f1a0e5fd5a8b9430f45531ac6de7f0d2e79fb00f7a8b134509a`.

O pacote e suas evidências são locais e ignorados pelo Git. Lista permitida e comparação integral com o build verificadas; sem fontes, `.git`, `.vercel` interna, `.env*`, dados, bancos, backups, logs, relatórios ou arquivo pessoal. Inspeção textual direcionada não detectou conteúdo da rotina pessoal nem padrões de credenciais; não representa garantia absoluta de ausência de segredos. Os 75 recursos de precache existem, incluindo a rota Hábitos e a sheet lazy de importação. Manifest conserva escopo/início `/`, ícones existentes e credenciais; nenhuma configuração de proteção foi alterada.

Eventual envio precisa de nova autorização para este pacote. Proposta conserva o projeto `atlas-staging`, espaço `arthurlacerdaaragao-3036`, Preview protegido por Vercel Authentication em All Deployments, sem exceções públicas ou recursos pagos, e o alias estável já existente. Nenhuma configuração remota foi consultada/revalidada ou alterada nesta preparação. Após autorização, conferir o estado real da proteção antes de qualquer upload e validar a atualização na mesma origem com nota/timer ativos. Não incluir a rotina pessoal no upload nem migrar dados automaticamente. Performance histórica continua 86 frio / 99 retorno, sem nova coleta; instalação física permanece pendente.
