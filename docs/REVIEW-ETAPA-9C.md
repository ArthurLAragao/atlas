# Atlas — fechamento de performance e validação 9C

Data: 06/10/2026. Baseline de código `ca17792`, Git inicialmente limpo. Direção visual aprovada preservada: CSS, tokens, composição, recursos e parâmetros das animações. Nenhuma biblioteca adicionada, módulo funcional novo, push, deploy ou publicação. Perfis/bancos descartáveis; dados pessoais e aba do usuário não foram usados nos testes.

## Diagnóstico e mudança pequena

[Plano anterior às mudanças](PERFORMANCE-PLAN-9C.md). O build confirmou Markdown no caminho estático por duas cadeias: `data-store → repository → note-links → unified/remark-parse/micromark` e `Shell → DataPanel → cálculo de exemplos/transferência → data-integrity → note-links`. O botão fechado calculava wikilinks a cada snapshot mesmo sem abrir a sheet.

Apenas essas fronteiras foram separadas. Funções de validação, IDs, merge e referências vão para `data-records.ts`; identidade de título vai para `note-identity.ts`. Os contratos síncronos antigos continuam reexportados; parsing, sanitização, schemas e algoritmos não foram reescritos. Repositories resolvem os imports antes das transações e mantêm leitura, validação, conflito e escrita atômicos sobre o estado atual.

O conteúdo da sheet Seus dados é lazy. Botão, título, descrição e saída continuam disponíveis; loading acessível fica restrito às ações da sheet, sem adiar Hoje. Remoção otimista de um seed inteiramente de exemplo continua imediata. Com registros pessoais, aguarda o grafo completo antes de ocultar exemplos, com bloqueio de reenvio e rollback. Não houve perda de proteção de referências para melhorar a nota.

Zod, Dexie e React foram identificados nos chunks iniciais e preservados. `readSnapshot` já lê coleções em paralelo; inicialização transacional e liveQuery fazem leituras com finalidades diferentes. Não se eliminou a leitura do liveQuery sem comprovar segurança de concorrência. O engine completo de movimento continua no timing/contrato da 9B; nenhum ajuste adicional foi necessário para a primeira hipótese.

Referências HIG aplicadas: `loading.md > Best practices`, `feedback.md > Best practices`, `motion.md > Providing feedback` e fundamentos de acessibilidade/layout/tipografia/cor traduzidos para web. Revisão React: imports diretos, carga condicional e Suspense pequena; sem memoização especulativa ou refatoração ampla.

## Performance e bundles

**Meta fria >= 90 não atingida.** Baseline reproduzido nesta etapa: **81**; final: **86**. Retorno: **100 → 99**. O LCP frio mediano caiu de **3,658 s para 3,149 s** (13,9%). Esses ganhos não equivalem a aprovar o critério e o retorno perdeu um ponto nesta rodada.

| Cenário | Baseline: nota / LCP | Final: nota / LCP |
| --- | --- | --- |
| Frio 1 | 81 / 3,777 s | 84 / 3,411 s |
| Frio 2 | 86 / 3,312 s | 86 / 2,897 s |
| Frio 3 | 81 / 3,658 s | 89 / 3,149 s |
| **Mediana fria** | **81 / 3,658 s** | **86 / 3,149 s** |
| Retorno 1 | 100 / 0,063 s | 100 / 0,060 s |
| Retorno 2 | 100 / 0,065 s | 99 / 0,056 s |
| Retorno 3 | 100 / 0,061 s | 99 / 0,054 s |
| **Mediana retorno** | **100 / 0,063 s** | **99 / 0,056 s** |

Medianas são calculadas por métrica, independentemente; a execução de nota mediana não precisa ser a de LCP mediano. Acessibilidade Lighthouse: 100 nas doze execuções; nenhuma run warning. Isso não substitui leitura humana com leitor de tela.

Evidência completa e configuração de cada execução: [baseline JSON](performance-9c-baseline.json), [final JSON](performance-9c-final.json). Relatórios Lighthouse HTML (cada um tem o JSON homônimo):

- Baseline frio: [1](lighthouse-9c-baseline-cold-1.report.html), [2](lighthouse-9c-baseline-cold-2.report.html), [3](lighthouse-9c-baseline-cold-3.report.html).
- Baseline retorno: [1](lighthouse-9c-baseline-return-1.report.html), [2](lighthouse-9c-baseline-return-2.report.html), [3](lighthouse-9c-baseline-return-3.report.html).
- Final frio: [1](lighthouse-9c-final-cold-1.report.html), [2](lighthouse-9c-final-cold-2.report.html), [3](lighthouse-9c-final-cold-3.report.html).
- Final retorno: [1](lighthouse-9c-final-return-1.report.html), [2](lighthouse-9c-final-return-2.report.html), [3](lighthouse-9c-final-return-3.report.html).
- [Probe exploratório único](lighthouse-9c-parser-probe.report.html): não entra na mediana final.

| Mediana | Baseline frio | Final frio | Baseline retorno | Final retorno |
| --- | --- | --- | --- | --- |
| FCP | 2,844 s | 2,343 s | 0,040 s | 0,038 s |
| LCP | 3,658 s | 3,149 s | 0,063 s | 0,056 s |
| TBT | 26 ms | 21 ms | 9 ms | 109,5 ms |
| CLS | 0 | 0 | 0 | 0 |
| Transferência | 319.376 B | 295.584 B | 0 B | 0 B |
| Trabalho JavaScript | 616,4 ms | 611,4 ms | 359,9 ms | 318,4 ms |
| Main thread | 1.304,0 ms | 1.423,7 ms | 722,0 ms | 825,4 ms |

A transferência fria caiu 7,45%, porém o trabalho total da main thread aumentou e o TBT de retorno piorou. Não se atribui causalidade automaticamente a uma mudança apenas pela variabilidade de uma rodada. Mantemos esses resultados, sem reruns seletivos. A configuração JSON das doze coletas é idêntica. A medição ocorre no Edge local com simulação mobile; não é teste de celular físico ou servidor hospedado.

Método da 9B: Lighthouse 13.5.0, Edge 154, build estável em 4180, configuração mobile padrão/CPU ×4/throttling simulate, perfis novos e nenhum teste/build concorrente. Frio sem cache/IndexedDB/SW; retorno em perfil separado preparado online. Hoje real aguardado até pintura/rede quieta, sem loading usado como LCP. Todas as execuções são publicadas, sem escolher a melhor.

Histórico 9B: mediana fria 87, retorno 100, LCP frio 3,018 s. A reprodução anterior às mudanças da 9C deu 81/86/81 (mediana 81) e retorno 100/100/100. Assets da 9B final e baseline 9C são idênticos; essa variabilidade não é escondida e o histórico não substitui o baseline atual. O probe único após a separação marcou 93, FCP 2,183 s e LCP 2,834 s; é exploratório, não aprovação.

Entrada: 325.595 → 245.519 bytes; gzip Node: 101.388 → 77.612 bytes. Módulos na entrada: 374 → 302. O grafo estático da entrada e Hoje não contém unified/remark-parse/micromark. Código fica nos chunks dinâmicos de wikilinks/preview, também no precache. Nenhum CSS mudou de hash ou tamanho.

Inventários: [baseline](bundle-9c-baseline.json), [probe](bundle-9c-parser-probe.json), [final](bundle-9c-final.json). O diagnóstico baseline capturou nomes de alguns chunks antes dos últimos hooks do Vite; isso está marcado no JSON. Tamanhos finais prevalecem no inventário de assets de `performance-9c-baseline.json`; o coletor final usa writeBundle e lê arquivos reais depois do build. Não se comparam tamanhos intermediários com tamanhos finais.

| Recurso | Baseline bytes / gzip | Final bytes / gzip |
| --- | --- | --- |
| Entrada | 325.595 / 101.388 | 245.519 / 77.612 |
| Hoje | 90.111 / 26.684 | 90.100 / 26.683 |
| React | 258.514 / 81.389 | 258.514 / 81.389 |
| Storage/Dexie | 95.202 / 31.022 | 95.202 / 31.022 |
| Validação | 89.696 / 25.158 | 89.696 / 25.158 |
| Engine completo | 86.821 / 28.398 | 86.811 / 28.406 |
| AST/wikilinks separado | incorporado na entrada | 71.073 / 20.753 |

Gzip é calculado por Node sobre arquivos finais, separadamente do tamanho transferido observado. Total JS/CSS: **1.339.590 → 1.342.261 bytes** (+2.671 B, 0,20%), com **51 → 57** arquivos. A redução da entrada é redistribuição para uso sob demanda, não exclusão de recursos. Os **11 CSS** têm nomes, tamanhos e gzip idênticos. Arquivos de CSS, tokens, configuração de build, dependências e políticas PWA não foram editados.

Waterfall: entrada/React/storage/validação/Hoje começam no caminho inicial; o engine continua requisitado após avaliação da entrada. `note-links`, `DataPanelBody` e transferência não aparecem entre as 14 requisições frias observadas. O LCP é a descrição real de Hoje (`p.page-description`), e não uma espera. As tabelas completas de network requests/bootup/main thread e LCP estão em cada relatório; [diagnóstico estruturado](diagnosis-9c-final.json) reúne o grafo estático, invariantes e waterfalls representativos. Tempos de waterfall/trace observado e métricas Lighthouse simuladas têm semânticas diferentes; não foram somados ou intercambiados.

Gargalos restantes: React (258,5 KB), Dexie (95,2 KB), validação (89,7 KB), Hoje (90,1 KB) e engine (86,8 KB) continuam necessários no fluxo observado. Nos traces há custo de execução de storage/React e trabalho não atribuído; Puppeteer interno também aparece e não deve ser tratado como código do Atlas. A retirada do parser, sozinha, não garante redução proporcional de CPU nem nota 90. A leitura paralela do snapshot e a segunda leitura da assinatura têm contratos distintos; eliminá-las ou postergar o engine exige instrumentação/experimento próprios para proteger concorrência e interações. Não há evidência suficiente para uma refatoração ampla ou remoção de validação.

## Testes, integridade e PWA

Unitários: **843 testes / 68 arquivos**, 306,53 s. Os 840 anteriores foram preservados; três novos verificam inicialização/tarefa com parser indisponível, falha de carga sem escrita parcial e links pessoais transitivos/reenvio/rollback durante download tardio.

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | aprovado, saída 0 |
| `npm run typecheck` | aprovado, saída 0 |
| `npm run test` | 843/843, 68 arquivos, saída 0 |
| `npm run build` | aprovado, saída 0; 72 entradas de precache, 1.356,80 KiB |
| `npm run test:e2e` | **105/105**, 10,3 min, saída 0 |

[Resumo verificável](checks-9c.json). Todos os testes anteriores continuam no código, sem skip, enfraquecimento de asserções ou alteração de timeout para aprovar a suíte. A correção da simulação de download foi seguida de nova execução completa.

Matriz de regressão novamente aprovada: banco vazio/existente e migrações; snapshots e vínculos; captura, editor, preview, renomeação/backlinks, sanitização e erros; timer após F5/segundo plano/duas abas; motion/reduced motion; teclado/foco/Escape e Axe; layouts 375/768/1280 px, temas e texto aumentado por CSS. Aumento automatizado do texto não é evidência de zoom nativo ou leitura humana.

Backup em banco descartável: exportar, limpar, importar e comparar integralmente snapshot/campos/metadados, nos formatos [JSON](roundtrip-9c-json.json) e [Markdown completo do Atlas](roundtrip-9c-md.json): **iguais**. Essa restauração completa usa o formato de backup Atlas com metadados; um `.md` individual ou de outro editor não representa todo o banco.

PWA: worker real, recarga offline, rotas ainda não visitadas e recursos lazy (Markdown, prévia, tabela, datas, perfil e agora sheet Dados), criação/persistência offline e reconexão passaram. Atualização com duas revisões reais do SW passou: Agora não conserva a antiga; Atualizar ativa a nova, mantém rascunho de nota e o mesmo ID de timer em andamento, sem concluir tarefa ou duplicar sessão. Teste executado em servidor temporário/Edge, não em uma instalação física ou ambiente de staging.

[Critérios de instalação do navegador](audit-9c-final-pwa-installability.json): sem erros; `actualOsInstallationTested: false`. As **132 [capturas de regressão](screenshots/)** usam o prefixo `audit-9c-final-`; evidências anteriores foram preservadas.

O novo browser testa download propositalmente bloqueado em um contexto com SW bloqueado somente para essa simulação; o teste offline é separado e usa o worker real. Hoje abre sem requisitar o parser; a sheet anuncia loading, aceita Escape/restaura foco e passa Axe ao terminar de carregar. Outro contexto prepara o PWA e abre offline a sheet ainda não visitada.

Na primeira rodada, os 103 fluxos anteriores passaram, mas o teste novo de download falhou porque o SW respondeu pelo cache e contornou a interceptação de rede. A correção separou os dois cenários, sem remover asserts, aumentar timeout ou desabilitar SW na suíte PWA. Também foram corrigidos um import nomeado de Axe, um título duplicado involuntário na fixture de wikilinks e a asserção da causa original envolvida pelo mock do Vitest. São erros de implementação dos novos testes, não falhas de dados pessoais nem evidência de regressão visual.

Precache: **72 entradas**, incluindo wikilinks, proteção de exemplos e conteúdo/transferência da sheet. As políticas do worker/manifest não foram alteradas. Instalação física continua não executada; o relatório de critérios do navegador usa perfil Edge descartável e registra esse limite explicitamente.

## Checklist humano e limites

[MANUAL-RELEASE-CHECKLIST](MANUAL-RELEASE-CHECKLIST.md) tem ambiente, passo, esperado, observado/evidência e estado para instalação Windows, reabertura, offline/escrita/reconexão, atualização com nota/timer, teclado/Escape, zoom nativo 200% e NVDA. Celular físico e Safari/iOS ficam separados, dependem de staging HTTPS e dispositivo disponível. **Todos os resultados humanos permanecem Não testado.**

Arquivamento de hábitos continua no backlog. Preferências gerais permanecem fora do backup de conteúdo. Não se promete que nota Markdown individual restaure todos os metadados; os roundtrips JSON/Markdown completo e a sanitização continuam na suíte. Instalação física, Safari/WebKit, NVDA/VoiceOver e comportamento após encerramento forçado do sistema não são validados por esta automação.

## Commits e parecer

- `579840f` — `perf: carrega Markdown e ações de dados sob demanda`: fronteiras mínimas, três unitários e dois E2E novos, diagnóstico e decisões.
- `docs: registra validação da release e checklist manual`: este relatório, métricas individuais/resumos, backups, evidências e checklist. Seu hash é o commit local que contém este arquivo; consulte `git log --oneline -2`. Também será informado na entrega, sem tentar embutir o próprio hash no conteúdo que o gera.

**Parecer: a meta de performance continua reprovada; não há aprovação de release/publicação.** O ganho está medido e as regressões funcionais passaram. A preparação documental da 10A pode aproveitar estes artefatos, mas não deve declarar a release pronta nem iniciar deploy nesta etapa.

Decisão para fechar a pendência: **recomendo continuar uma rodada direcionada** de instrumentação de inicialização/assinaturas e engine, com nova hipótese pequena e medição comparável. Alternativamente, o usuário pode **aceitar explicitamente mediana fria 86 e retorno 99 para uma release inicial**, reconhecendo a meta não cumprida e mantendo o checklist humano pendente. Não foi tomada essa aceitação pelo usuário, nem repetidas medições para procurar uma nota favorável. Instalação física, NVDA, zoom nativo e dispositivos reais seguem sem evidência humana.

Não houve autorização nem execução de publicação nesta etapa. Preparar a próxima etapa não equivale a aprovar deploy; evidências humanas e riscos de ambiente hospedado precisam de validação própria.
