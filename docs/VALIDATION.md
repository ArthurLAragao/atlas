# Validação da primeira entrega de portfólio

Snapshot local validado em 07/10/2026. Escopo congelado, visual e funcionalidades preservados. Publicação do código, hospedagem e tag/release são ações independentes; este relatório comprova checks locais, não aprovação automática de ações externas.

## Verificação desta cópia

Ambiente: Windows, Node 25.3.0, npm 11.6.2 e Microsoft Edge. A suíte foi executada exclusivamente contra o build desta cópia, em origem local separada e contextos descartáveis.

| Check | Resultado |
| --- | --- |
| npm ci --no-audit --no-fund | Aprovado; 783 pacotes instalados com o lockfile. |
| npm run lint | Aprovado, saída 0. |
| npm run typecheck | Aprovado, saída 0. |
| npm run test | 847 testes, 69 arquivos, saída 0; 300,04 s. |
| npm run build | Aprovado, saída 0; 74 entradas de precache. |
| npm run test:e2e | 109 aprovados, saída 0; 10,8 min, um worker. |
| Links locais de README/documentos | 25 referências existentes; sem links locais quebrados. |

Não houve testes removidos, pulados ou enfraquecidos. A resolução/versões do lockfile original foi preservada; somente a declaração MIT foi acrescentada aos metadados. Os E2E exercitaram backup/restore, duas abas, Markdown, perfis, captura, teclado/Axe, layouts/temas/texto 200%, offline/lazy e duas revisões reais do worker. Ampliação CSS de texto não substitui zoom nativo humano.

A instalação informou depreciação transitiva de glob 11.1.0, usado por workbox-build. Essa versão é indicada como corrigida para [GHSA-5j98-mcp5-4vw2](https://github.com/isaacs/node-glob/security/advisories/GHSA-5j98-mcp5-4vw2); não foi feita uma auditoria completa de dependências nem alegada ausência de todas as vulnerabilidades. O runner também informou conflito ambiental NO_COLOR/FORCE_COLOR, sem falha de teste. Todos os testes existentes foram copiados, sem remoção/pulo/enfraquecimento de asserções. Só valores fictícios de identidade/contexto foram anonimizados. Testes usam bancos e perfis descartáveis.

## Performance histórica local

Medição de 06/10/2026, build de produção, Hoje real, cenário mobile Lighthouse, três execuções por cenário e configurações comparáveis. Frio começa com perfil, IndexedDB, cache e service worker vazios; retorno é preparado separadamente. As medianas são por métrica.

| Execução | Frio: desempenho / LCP | Retorno: desempenho / LCP |
| --- | --- | --- |
| 1 | 84 / 3,411 s | 100 / 0,060 s |
| 2 | 86 / 2,897 s | 99 / 0,056 s |
| 3 | 89 / 3,149 s | 99 / 0,054 s |
| Mediana | **86 / 3,149 s** | **99 / 0,056 s** |

Meta fria ≥ 90 pendente. Não houve nova rodada de Lighthouse nesta entrega; números não representam medição da cópia pública ou hospedagem HTTPS. Relatórios brutos foram conservados somente no checkout original, fora da distribuição pública.

## Limites da revisão pública

Uma lista explícita selecionou fonte, testes, assets, configuração, lockfile e documentação. A inspeção de conteúdo examinou nomes, padrões conhecidos de segredos, referências pessoais/caminhos e as sete capturas fictícias aprovadas. Uma busca textual não garante ausência absoluta de segredos nem substitui auditoria de dependências. Nenhum segredo identificado será exibido ou publicado.

Não são incluídos histórico original, .vercel, ambientes, bancos, backups, perfis, logs, fontes de referências externas ou evidências brutas. Atribuições legítimas foram preservadas. Configurações e scripts selecionados usam caminhos relativos. O histórico novo usa o identificador público e e-mail noreply do GitHub, sem e-mail pessoal.

## Hospedagem e testes humanos

Estado conhecido em 06/10/2026: Preview pessoal protegido por Vercel Authentication em All Deployments, sem exceções públicas. HTTPS, rotas/refresh, assets ausentes 404, manifest, ícones, worker e navegação offline foram exercitados. O roteiro hospedado de gravação offline ficou pendente após timeout/autenticação; gravação, refresh e reconexão passaram localmente. A publicação GitHub não modifica deploy, alias ou proteção e não apresenta essa hospedagem como demo pública.

Instalação física Android/Windows, NVDA, zoom nativo a 200% e dispositivos adicionais não foram comprovados por resposta humana. Automações Axe/Playwright não equivalem a esses testes. Esses limites não impedem a publicação do código de portfólio quando informados.
