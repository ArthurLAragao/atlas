# Atlas — um centro de comando pessoal

Caso baseado no candidato até 9C e preparação 10A. Não é relato de lançamento/adoção: capturas fictícias, resultados de testes/medições locais. Não foram inventados usuários, depoimentos ou ganhos pessoais de produtividade.

## Problema e proposta

Organizar tarefas, hábitos, notas, faculdade e projetos pode exigir manter a própria ferramenta antes de usá-la. Atlas oferece estrutura opinativa: abrir, anotar, escolher poucos passos e conectar conhecimento a ações. Público de referência: quem estuda computação e constrói software; sem estudo formal de mercado/usabilidade comprovado nesta entrega.

Hoje reduz a decisão inicial; captura atende criação/busca por teclado; heatmap torna constância visível; Markdown mantém escrita simples; metas/projetos/estudos compartilham IDs. Foco registra tempo e exige intenção de concluir. Não há conta/nuvem ou integração externa bloqueando o primeiro uso.

## Decisões de produto e design

- Estrutura pronta/exemplos removíveis; tags/vínculos/contextos sem editor de bancos customizados.
- Sugestão de três prioridades, meta semanal explícita e progresso manual preservado.
- Monocromia/editorial, fontes locais e materiais nas camadas funcionais. Visual aprovado foi congelado nas auditorias.
- Teclado/foco/feedback/alternativa textual do heatmap; testes automatizados não equivalem a acessibilidade humana completa.
- Perfil/XP privados/discretos, separados da atividade; sem punição por ausência ou comparação social.

[DECISIONS](DECISIONS.md) conserva o raciocínio e revisões. A documentação 10A aplica clareza de linguagem e descrições das capturas, sem outro redesign.

## Decisões técnicas

React/TypeScript/Vite por feature; Zustand coordena UI/snapshot; Dexie persiste atrás de AtlasRepository; Zod valida. Regras puras cobrem parser, streaks, médias/progresso, SM-2 e timer. Workbox precacheia rotas/recursos lazy e espera escolha de atualização.

Timer usa timestamps, não a frequência de intervalos em aba ativa. AST reconhece wikilinks respeitando código; renderer ignora HTML e limita links/imagens. Backup completo e nota individual têm contratos distintos. [Arquitetura](ARCHITECTURE.md) · [Dados](DATA-AND-PRIVACY.md).

## Dificuldades e correções

Concorrência reproduzida entre abas exigiu conflitos de versão, preservação de rascunho/feedback, relações atômicas e deduplicação. Atualização PWA exigiu teste entre revisões reais com nota/timer. Na 9C, Markdown chegava à entrada por repositories e sheet fechada: separar fronteiras e resolver imports antes da transação reduziu bytes sem retirar proteção.

Medição também exigiu correção: loading não representa LCP do produto; coletas inválidas anteriores foram identificadas. Finais aguardam Hoje real, publicam todas as execuções e separam frio/retorno. Um teste de download tardio foi inicialmente contornado pelo SW; separar simulação controlada de offline real verificou ambos sem enfraquecer a suíte.

## Resultados e limites

| Evidência 9C      | Resultado local                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Qualidade         | 843 unitários/105 E2E, lint/typecheck/build aprovados.                                        |
| Backup            | Snapshot igual após exportar/limpar/importar JSON/Markdown completo em banco descartável.     |
| PWA               | Offline/lazy/atualização com nota/timer por automação Edge; instalação física não comprovada. |
| Entrada JS        | 325.595 para 245.519 bytes; gzip 101.388 para 77.612.                                         |
| Lighthouse frio   | Baseline reproduzido 81, final 86; meta 90 não atingida. Histórico 9B: 87.                    |
| Retorno preparado | Baseline 100, final 99; não confundir com primeiro acesso.                                    |
| LCP frio mediano  | 3,658 para 3,149 s; não é medição em host público/celular físico.                             |

[Relatórios individuais/método](REVIEW-ETAPA-9C.md) · [Galeria fictícia](../README.md#capturas-de-apresentação). Não há evidência de ganho real de produtividade ou auditoria humana completa.

## Processo e autoria

Desenvolvimento assistido por IA/Codex, com direção/requisitos do usuário, etapas, revisão/testes e decisões registradas. Código gerado, volume de recursos e contagem de testes **não provam domínio pessoal independente de todas as tecnologias**. O caso descreve o projeto; para apresentar habilidades individuais, o autor deve explicar o que revisou/compreendeu/consegue reproduzir, sem atribuir automaticamente a si todo trabalho gerado.

## Próximos passos

Decisão humana de performance, instalação/NVDA/zoom nativo/dispositivos, conteúdo/licença e autorização separada de staging com validação HTTPS. Arquivamento de hábitos continua no backlog. Nuvem/grafo/integrações são possibilidades futuras, não recursos da release atual.

A 10A prepara materiais locais e para: sem push, tag, release, staging/publicação ou aceitação da limitação pelo usuário.
