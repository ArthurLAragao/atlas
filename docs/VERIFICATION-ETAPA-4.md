# Revalidação da etapa 4

Executada em 2026-10-01 antes de implementar a etapa 5. Commit confirmado: `67d28ef feat: adiciona tarefas com parser, kanban e calendario`; checkout sem alterações.

- `npm run lint`: aprovado, sem warnings.
- `npm run typecheck`: aprovado.
- `npm run test`: 12 arquivos, 208 testes aprovados.
- `npm run build`: aprovado, sem warnings; Vite 8.3.1.

Parser executado diretamente pelo carregador SSR do Vite. Referência local: 01/10/2026, 12h. `—` representa ausência; prioridade padrão é Média.

| Frase                                                  | Título                                   | Data       | Hora  | Tags      | Prioridade |
| ------------------------------------------------------ | ---------------------------------------- | ---------- | ----- | --------- | ---------- |
| estudar AWS amanhã 19h #faculdade !alta                | estudar AWS                              | 2026-10-02 | 19:00 | faculdade | Alta       |
| revisar algoritmos hoje 18h30 #unifor                  | revisar algoritmos                       | 2026-10-01 | 18:30 | unifor    | Média      |
| ler documentação depois de amanhã #cloud !baixa        | ler documentação                         | 2026-10-03 | —     | cloud     | Baixa      |
| entregar trabalho 15/10/2026 às 23:59 #faculdade !alta | entregar trabalho                        | 2026-10-15 | 23:59 | faculdade | Alta       |
| estudar redes próxima quinta 19:30 #redes              | estudar redes                            | 2026-10-08 | 19:30 | redes     | Média      |
| academia sábado 7h #pessoal                            | academia                                 | 2026-10-03 | 07:00 | pessoal   | Média      |
| revisar PR 19h #kyber !média                           | revisar PR                               | 2026-10-01 | 19:00 | kyber     | Média      |
| comprar livro #leitura !baixa                          | comprar livro                            | —          | —     | leitura   | Baixa      |
| prova 2026-11-03 14h #unifor !alta                     | prova                                    | 2026-11-03 | 14:00 | unifor    | Alta       |
| ler documentação 31/02/2026 25h !urgente               | ler documentação 31/02/2026 25h !urgente | —          | —     | —         | Média      |

Última frase emite três avisos: data inválida, horário inválido e prioridade não reconhecida; o texto original permanece no título.

Lista, Kanban, Calendário, subtarefas, repetição e contextos implementados. Contextos editam sugestões e aceitam texto livre; não renomeiam tarefas existentes em lote, e sugestões não entram no backup de conteúdo. Arraste nativo tem alternativa de situação por select para teclado/toque. Evoluções: séries mensais com dia fixo, desfazer conclusão composta, undo amplo/redo. Reabrir tarefa mantém o sucessor já criado, evitando duplicatas ao reconcluir. Pomodoro está previsto na etapa 7.
