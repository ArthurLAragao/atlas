# Atlas — caso de portfólio

## Problema e proposta

Organizar tarefas, hábitos, notas, estudos e projetos frequentemente exige configurar e manter a própria ferramenta. O Atlas oferece uma estrutura pronta, captura rápida por teclado e conexões entre conhecimento e ações. Não há estudo formal de mercado ou comprovação de ganho de produtividade nesta entrega.

## Decisões de produto

Hoje apresenta poucos próximos passos e widgets ajustáveis. Heatmaps tornam registros legíveis, com alternativa textual. Markdown mantém escrita simples; metas preservam resultados-chave manuais. Perfil e XP são locais e discretos. A direção monocromática/editorial e os fluxos aprovados foram congelados; não houve redesign para encerrar a entrega.

## Decisões técnicas e dificuldades

React/TypeScript por feature, Zustand, repositories/Dexie, validação Zod e funções puras isolam responsabilidades. Relações usam IDs. Timer usa timestamps para recuperação sem inventar sessões concluídas; atividade e XP são deduplicados. Concorrência entre abas, falhas de escrita, rascunhos e backups exigiram transações, conflitos explícitos e testes de regressão.

PWA exige validar duas revisões reais do worker e recursos lazy offline. Parsing/editor Markdown foi separado do caminho inicial, com imports resolvidos antes das transações; validação/sanitização não foram retiradas para melhorar a nota. A performance fria continua abaixo da meta, sem outra rodada de otimização nesta entrega.

## Resultados e limites

O [resumo de validação](VALIDATION.md) registra os checks da cópia pública. Medição histórica local: mediana Lighthouse **86 frio / 99 retorno**, LCP frio **3,149 s**, três execuções por cenário. A meta 90, instalação física e verificações humanas continuam pendentes. Capturas no README usam registros fictícios; não foram inventadas adoção, depoimentos ou métricas pessoais.

## Processo e autoria

Desenvolvimento assistido por IA/Codex, com direção de produto, requisitos, revisão de código/testes e decisões do autor. Código gerado, volume de recursos e número de testes não demonstram domínio pessoal independente de todas as tecnologias. O projeto documenta o processo; a apresentação de habilidades individuais deve se apoiar no que o autor compreende, revisa e consegue explicar/reproduzir.

O código próprio tem MIT autorizada; o dock e dependências conservam suas [atribuições](COMPONENT-PROVENANCE.md). A entrega usa uma cópia pública revisada com histórico novo, preservando o checkout privado e suas evidências. A hospedagem pessoal protegida não é uma demo pública. Próximos passos ficam limitados ao backlog do README, sem nova etapa automática.
