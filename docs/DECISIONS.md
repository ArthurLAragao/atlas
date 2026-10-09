# Decisões selecionadas da primeira entrega

- Interface, tokens, layouts e animações aprovados permanecem congelados. Materiais translúcidos estão nas camadas funcionais; conteúdo de leitura tem superfície sólida. Teclado, foco e preferências de movimento/transparência continuam presentes.
- A organização por feature separa UI, regras puras e repositories. Dexie é o adaptador local; não há sincronização ou Supabase implementados.
- Relacionamentos usam IDs sem copiar tarefas/notas entre módulos. Resultados-chave manuais são independentes do progresso complementar de tarefas.
- Datas de calendário são locais; timestamps de eventos são ISO. Timer usa timestamps, recupera estado após refresh e exige encerramento explícito. Pausas não viram tempo de foco.
- Flashcards usam uma variante pequena de SM-2: qualidade 0–5, primeiro intervalo 1 dia, segundo 6, facilidade mínima 1,3; intervalos seguintes usam a facilidade anterior com arredondamento para cima e dias de calendário. Qualidade abaixo de 3 reinicia repetições. Implementação e testes: src/lib/sm2.ts e sm2.test.ts; não é garantia de eficácia educacional.
- Markdown é renderizado sem HTML ativo; links são restringidos, imagens remotas não são carregadas. Wikilinks usam AST para respeitar código. Imports lazy são resolvidos antes de transações.
- PWA precacheia também recursos lazy e pede confirmação de atualização. Cache de assets e IndexedDB têm funções distintas; mudar de origem não migra dados.
- Atividade é diferente de XP e dos heatmaps de hábitos. Só ações significativas contam; visualização de páginas não conta. Perfil, avatar e fixados são locais.
- A cópia pública tem história nova; o checkout original, histórico, bancos e evidências permanecem intactos. Fixtures pessoais foram anonimizadas sem retirar asserções. O único literal de exemplo do runtime alterado foi o contexto padrão “Trabalho”, autorizado pelo titular.
- MIT foi autorizada para o código próprio, com copyright 2026 ArthurLAragao. Avisos/atribuições de terceiros são preservados. A publicação do código não torna a hospedagem protegida uma demo pública.
- Performance histórica 86 frio / 99 retorno é uma limitação documentada. Não houve novo Lighthouse, redesign, módulo novo ou aprovação automática de release/tag.

## Programação semanal de hábitos

- `Habit.scheduleVersions` e `Snapshot.routine` são aditivos e tipados; reutilizam os stores existentes do IndexedDB v3, sem duplicar hábitos nem reescrever repositories. Cada vigência preserva a definição anterior; edição no mesmo dia substitui somente essa versão.
- Calendário local e data de atribuição são explícitos. Hoje acompanha meia-noite/retorno ao app; datas históricas e formulário aberto permanecem fixos. Madrugada com `dayOffset: 1` pertence à data planejada anterior.
- Opcionais ficam fora do denominador obrigatório, mesmo com `timesPerWeek: 7`. Dias não programados não são faltas; frequência flexível e dias fixos mantêm unidades de sequência próprias. Alterar programação/data não gera XP ou atividade.
- Configurações pessoais são arquivos privados, não seed; revisão e mapeamento por ID são explícitos. Importação é atômica e recusa versões obsoletas de outra aba. JSON/Markdown completo preservam rotina e versões; nota individual não.
- Interface existente preservada; controles de data, sheets e detalhes progressivos mantêm teclado/foco. HIG: accessibility, pickers, sheets e lists-and-tables. Sem agenda completa, notificações ou sincronização.
