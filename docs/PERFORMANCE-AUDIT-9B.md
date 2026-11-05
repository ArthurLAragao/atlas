# Atlas — Performance, etapa 9B

## Resultado e critério

**A meta mobile fria de 90 não foi atingida.** Mediana atual: **87**, contra **85** no baseline aprovado `eb7c770`. Retorno preparado: **100** em ambos. Acessibilidade Lighthouse: 100 nas doze coletas. Não houve avisos de execução.

Os 67/100 e LCP frio 5,4 s da etapa 8 são históricos. A coleta isolada de 91 do rebuild 9A também não substitui esta comparação: agora são três execuções por cenário e por versão, com todas as notas publicadas. Variação entre execuções existe; o ganho de dois pontos não demonstra uma causalidade isolada de cada otimização.

## Metodologia reproduzível

- Build de produção, `npm run preview -- --host 127.0.0.1 --port 4180`, dist estável durante cada conjunto. Nenhum build, Vitest ou E2E concorrente com as medições.
- Lighthouse **13.5.0**, Edge **154.0.0.0**, perfis temporários novos fora do modo anônimo, sem dados pessoais. URL `http://127.0.0.1:4180/`.
- Configuração Lighthouse mobile padrão: tela emulada 412 × 823, escala 1,75, throttling **simulate**, CPU ×4, RTT 150 ms, throughput 1638,4 Kbps. Todos os `configSettings` das doze execuções são idênticos. Não houve ajuste para aumentar a nota.
- Frio: perfil vazio em `about:blank`, dez segundos de estabilização do navegador sem visitar Atlas; primeira navegação com cache, IndexedDB e service worker vazios.
- Retorno: outro perfil novo carrega Hoje online, aguarda `navigator.serviceWorker.ready`, volta a `about:blank` e inicia a medição conservando os dados/cache. Não é uma recarga fria.
- O callback da navegação aguarda o título e `.today-page` reais, dois frames e o mesmo período de rede quieta de 1 s. O LCP inspecionado é a descrição real de Hoje, não a tela de espera. O filmstrip está no JSON/HTML.
- `disableStorageReset: true` mantém o retorno preparado; no frio a ausência de preparação é garantida pelo perfil novo. Cada perfil é removido ao terminar.
- Medianas calculadas por métrica, sem escolher a melhor execução. Valores de FCP/LCP/TBT abaixo são os resultados simulados do Lighthouse; tempos da waterfall são observados e não são intercambiáveis.

Reprodução, após gerar a versão a medir:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
# Em outro terminal, sem outras suítes concorrentes:
foreach ($auditRun in @(1, 2, 3)) {
  node scripts/audit-lighthouse.mjs --cold "--report-name=lighthouse-9b-final-cold-$auditRun"
}
foreach ($auditRun in @(1, 2, 3)) {
  node scripts/audit-lighthouse.mjs "--report-name=lighthouse-9b-final-return-$auditRun"
}
node scripts/summarize-audit-9b.mjs final
```

## Todas as execuções

| Versão / cenário | Run | Desempenho | FCP (s) | LCP (s) | TBT (ms) | Relatório HTML                                       |
| ---------------- | --- | ---------: | ------: | ------: | -------: | ---------------------------------------------------- |
| Baseline frio    | 1   |         80 |   2,915 |   3,785 |       26 | [Abrir](lighthouse-9b-baseline-cold-1.report.html)   |
| Baseline frio    | 2   |         85 |   2,814 |   3,482 |       24 | [Abrir](lighthouse-9b-baseline-cold-2.report.html)   |
| Baseline frio    | 3   |         86 |   2,583 |   2,987 |        0 | [Abrir](lighthouse-9b-baseline-cold-3.report.html)   |
| Baseline retorno | 1   |         99 |   0,074 |   0,130 |   118,25 | [Abrir](lighthouse-9b-baseline-return-1.report.html) |
| Baseline retorno | 2   |        100 |   0,075 |   0,133 |     8,50 | [Abrir](lighthouse-9b-baseline-return-2.report.html) |
| Baseline retorno | 3   |        100 |   0,073 |   0,128 |    41,60 | [Abrir](lighthouse-9b-baseline-return-3.report.html) |
| Final frio       | 1   |         89 |   2,553 |   3,071 |       23 | [Abrir](lighthouse-9b-final-cold-1.report.html)      |
| Final frio       | 2   |         87 |   2,518 |   3,018 |       21 | [Abrir](lighthouse-9b-final-cold-2.report.html)      |
| Final frio       | 3   |         87 |   2,741 |   2,986 |       14 | [Abrir](lighthouse-9b-final-cold-3.report.html)      |
| Final retorno    | 1   |        100 |   0,035 |   0,062 |    16,29 | [Abrir](lighthouse-9b-final-return-1.report.html)    |
| Final retorno    | 2   |        100 |   0,040 |   0,063 |    38,96 | [Abrir](lighthouse-9b-final-return-2.report.html)    |
| Final retorno    | 3   |         99 |   0,035 |   0,062 |      148 | [Abrir](lighthouse-9b-final-return-3.report.html)    |

Cada HTML tem o JSON de mesmo nome. Dados sem arredondamento, horários, user agent, configurações e inventários: [baseline](performance-9b-baseline.json) e [final](performance-9b-final.json).

## Medianas e comparação

| Métrica            | Frio baseline | Frio final | Retorno baseline | Retorno final |
| ------------------ | ------------: | ---------: | ---------------: | ------------: |
| Desempenho         |            85 |     **87** |              100 |       **100** |
| Acessibilidade     |           100 |        100 |              100 |           100 |
| FCP (s)            |         2,814 |      2,553 |            0,074 |         0,035 |
| LCP (s)            |         3,482 |      3,018 |            0,130 |         0,062 |
| TBT (ms)           |            24 |         21 |            41,60 |         38,96 |
| CLS                |             0 |          0 |                0 |             0 |
| Bytes transferidos |       316.341 |    319.376 |                0 |             0 |
| Requisições        |            13 |         14 |               12 |            13 |
| Trabalho JS (ms)   |        476,82 |     500,40 |           343,50 |        343,16 |
| Main thread (ms)   |      1.117,92 |   1.085,74 |           771,94 |        781,59 |

LCP frio mediano caiu aproximadamente 13,3%; FCP, 9,3%. Transferência fria cresceu 0,96% e trabalho JS mediano cresceu 4,95%; a divisão de código reorganiza o caminho crítico, não elimina todo o trabalho. Cache local explica zero transferência no retorno; não se promete zero tráfego em um ambiente hospedado.

## Bundle e diagnóstico

| Asset                    |           Antes (bytes) |          Depois (bytes) | Gzip antes/depois (bytes) |
| ------------------------ | ----------------------: | ----------------------: | ------------------------: |
| Entrada `index`          |                 408.994 |                 325.595 |         127.402 / 101.388 |
| Engine `motion-features` |  incorporado na entrada |                  86.821 |                — / 28.398 |
| React/core               |                 258.514 |                 258.514 |           81.389 / 81.389 |
| Dexie/storage            |                  95.202 |                  95.202 |           31.022 / 31.022 |
| Zod/validation           |                  89.696 |                  89.696 |           25.158 / 25.158 |
| Hoje                     |                  89.175 |                  90.111 |           26.442 / 26.684 |
| Todos os assets JS/CSS   | 1.335.195 (50 arquivos) | 1.339.590 (51 arquivos) |       Inventário nos JSON |

Gzip calculado com `node:zlib.gzipSync`, método idêntico para ambos, separado do tamanho transferido medido pelo navegador. Entrada diminuiu 20,4% em bytes brutos e gzip; total de assets cresceu 0,33%. Todos os CSS conservaram nomes/hash e tamanhos. Não foram instaladas dependências nem adicionadas imagens/fontes externas.

O baseline run frio 2 mostrou download de Hoje JS/CSS começando aproximadamente aos 754 ms, após a entrada. No final run 2 ambos começam aproximadamente aos 20 ms por hints no HTML. O CSS é apenas pré-carregado, sem aplicar regras de outra rota. Baseline `unused-javascript`: cerca de 81 KB gzip não utilizados na entrada; final: 59,6 KB na entrada e 23,4 KB no engine. O motor completo `domMax` agora é importado por LazyMotion; mesmas propriedades, gestos, springs e durações, sem substituir conteúdo.

Gargalos remanescentes: entrada de 325,6 KB ainda reúne infraestrutura de dados, validação e dependências de parsing de notas; React, Dexie e Zod continuam no caminho de inicialização. O engine dinâmico é solicitado durante a montagem e ainda disputa rede antes de Hoje pintar. A waterfall observada final run 2 termina entrada aos 1.409 ms, Hoje JS aos 2.055 ms e engine aos 2.371 ms. Isso justifica investigar postergação seletiva do parsing e engine, sem atribuir toda a latência ao seed ou ao banco sem instrumentação adicional.

O chunk de Workbox-window aparece após a renderização na waterfall (aproximadamente 3,87 s baseline e 6,14 s final run 2). Não houve evidência suficiente para culpar o registro do worker pelo primeiro download crítico. Desativar precache prejudicaria rotas offline e não foi adotado. Não há evidência de gargalo que justifique mudar fontes, blur, CSS, composição ou animar menos conteúdo.

Dois probes exploratórios, `lighthouse-9b-preload-probe` (84) e `lighthouse-9b-motion-probe` (85), estão arquivados e não entram nas medianas. O primeiro identificou um atributo de preload inconsistente, corrigido antes do candidato final. Não foram escolhidos resultados intermediários superiores para declarar sucesso.

## Offline, limites e próximo passo

Precache passou de 65 para **66 entradas**; o engine dinâmico permanece disponível offline. Os 103 E2E finais validaram recarga offline, oito rotas adicionais ainda não visitadas, recursos lazy, edição local/reconexão e atualização com duas revisões reais de service worker, rascunho e timer.

O próximo alvo é medir e separar dependências de Markdown alcançadas pela inicialização de dados, preservando validação, atomicidade e atualizações otimistas; depois medir o momento de carga do engine completo. São mudanças de arquitetura que exigem novo diagnóstico e testes, não uma refatoração ampla incorporada silenciosamente à auditoria. **O critério frio permanece pendente e a publicação não está recomendada nesta entrega.**
