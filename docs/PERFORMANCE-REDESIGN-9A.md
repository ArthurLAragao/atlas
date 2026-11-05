# Performance — 9A rebuild

## Bundle de produção

Mesma stack, sem bibliotecas novas, fontes externas ou imagens remotas. Os inventários contam todos os arquivos de `dist/assets`, sem compressão; não equivalem à transferência da primeira visita nem ao tamanho completo do precache. Evidências: `bundle-before-redesign.json` e `bundle-after-redesign.json`.

| Medida           |     Antes |    Depois |                                    Variação |
| ---------------- | --------: | --------: | ------------------------------------------: |
| Assets JS/CSS    |        47 |        50 |                       +3 chunks sob demanda |
| Bytes de assets  | 1.315.248 | 1.335.195 |                            +19.947 / +1,52% |
| index JS         |   281.412 |   408.994 |     Framer Motion passa à navegação inicial |
| today JS         |   209.463 |    89.175 | Dependências comuns passam ao chunk inicial |
| index + today JS |   490.875 |   498.169 |                             +7.294 / +1,49% |
| index CSS        |    28.184 |    30.957 |                                      +2.773 |
| today CSS        |    21.841 |    24.028 |                                      +2.187 |

Não houve instalação dos pacotes `motion`, `clsx` ou `tailwind-merge` do exemplo do dock. Usamos Framer Motion já instalado, Router e CSS com tokens. O crescimento de index isolado não representa um pacote novo: a maior parte é uma mudança de agrupamento de código que Hoje já carregava.

O editor de notas ganhou chunk próprio de 8.961 bytes; Kanban, 2.195; Calendário, 4.901; DatePicker, 3.698. Tabela, preview, renderer Markdown, perfil e formulários grandes mantêm imports dinâmicos. As rotas continuam no precache para navegação offline após o primeiro carregamento online. Build sem warnings de tamanho ou imports conflitantes.

## Decisão Coss / Geist / Seek

O comando `npx @21st-dev/cli add @coss` foi avaliado, sem executá-lo para instalar um kit. Coss utiliza Base UI; incorporá-lo duplicaria os primitives Radix que já atendem aos fluxos. Geist/21st e Bencho foram observados como referências de interação; nenhum CSS global, fonte, asset ou componente copiado desses sites entra no bundle.

Primitives próprios de apresentação resolvem os problemas: Dock, SeekCapture, SelectMenu e TransientToast. DateField reutiliza o mesmo DatePicker dentro de Popover no desktop e EntrySheet no mobile. Não há outra camada de estado, parser ou repository.

## Método Lighthouse

Preview de produção em `http://127.0.0.1:4180/`, Edge headless, perfil temporário novo, cache e IndexedDB vazios no primeiro acesso. Throttling mobile preservado em `scripts/lighthouse.config.mjs`. O registro começa antes da primeira navegação e termina com Hoje visível, dois frames e um segundo de rede ociosa; não há visita preparatória na coleta fria.

O retorno é medido separadamente, após preparação online e navegação para about:blank, conservando SW/cache/IndexedDB. Não usar esse número como primeiro acesso. Relatórios JSON e HTML ficam em docs. O script rejeita uma coleta que termina apenas no fallback de carregamento.

Comandos: `node scripts/audit-lighthouse.mjs --redesign --cold` e `node scripts/audit-lighthouse.mjs --redesign`. As medições finais ocorrem com dist estável e sem E2E, captura ou testes unitários concorrentes.

| Cenário anterior                        | Desempenho | Acessibilidade | Observação                                                |
| --------------------------------------- | ---------: | -------------: | --------------------------------------------------------- |
| Etapa 8, primeiro acesso                |         67 |            100 | Relatório original da etapa 8                             |
| 9A anterior ao rebuild, primeiro acesso |         73 |            100 | `lighthouse-stage9a.report.json`; mesma prontidão de Hoje |
| 9A anterior ao rebuild, retorno         |        100 |            100 | Caches preparados; cenário separado                       |

| Cenário final                 | Desempenho | Acessibilidade | Boas práticas | SEO |
| ----------------------------- | ---------: | -------------: | ------------: | --: |
| Primeiro acesso, perfil vazio |     **91** |        **100** |           100 |  91 |
| Retorno, caches preparados    |    **100** |        **100** |           100 |  91 |

As duas coletas terminaram sem avisos. A screenshot final da coleta fria foi extraída do próprio relatório e inspecionada: mostra Hoje pronto, tarefas e dock, não um fallback. O resultado frio melhora 18 pontos sobre a versão imediatamente anterior e 24 sobre a etapa 8. Isso satisfaz a ausência de regressão e supera 90 nesta execução local; não garante essa pontuação em todos os dispositivos.

| Métrica fria                | Antes do rebuild |  Depois |
| --------------------------- | ---------------: | ------: |
| FCP                         |           2,86 s |  2,58 s |
| LCP                         |           4,14 s |  2,83 s |
| Speed Index                 |           9,53 s |  3,66 s |
| TBT                         |            89 ms |    0 ms |
| CLS                         |                0 |       0 |
| Requisições no trace        |               13 |      13 |
| Bytes transferidos no trace |          313.413 | 316.341 |

O crescimento da transferência fria foi 2.928 bytes (+0,93%). O maior custo de index é compensado em grande parte pela redução de today. Lazy loading e composição visual foram refinados; a diferença de tempos também está sujeita à variação da máquina, portanto não se atribui a melhora inteira a uma única alteração.

Relatórios finais: [primeiro acesso JSON](lighthouse-redesign-9a.report.json), [HTML](lighthouse-redesign-9a.report.html), [retorno JSON](lighthouse-redesign-9a-return.report.json), [HTML](lighthouse-redesign-9a-return.report.html). Métricas extraídas: `lighthouse-comparison-redesign-9a.json`. Reprodução da extração: `node scripts/redesign-lighthouse-evidence.mjs`.

![Tela final do trace frio](screenshots/redesign-9a-lighthouse-after-cold.png)

## Limites

Lighthouse é uma execução local com simulação, sujeita a variação da máquina. Screenshots de rotas e testes E2E comprovam funcionalidade/semântica nos cenários exercitados, não FPS em hardware móvel real. O aumento de 1,52% no inventário total é pequeno e documentado; o critério de ausência de regressão inicial depende da medição fria, não apenas do tamanho dos arquivos.
