# Plano de staging — preparação 10B

**Proposta, não deploy.** Frio atual mediano 86, retorno preparado 99; meta fria >= 90 pendente, sem aceite de release definitiva. Checklist humano ainda não executado. Nenhum push, publicação de repositório, link de conta, projeto remoto, upload, alias, tag ou release foi realizado.

## Destino proposto e divisão da autorização

Vercel Preview em projeto separado, nome proposto `atlas-staging` sujeito à disponibilidade/conta escolhida. Sem integração Git inicialmente: não é necessário publicar o repositório nem enviar sua história para testar o app. Enviar somente um pacote de **dist revisado + configuração específica aprovada**, não a raiz do checkout. Nenhuma URL é anunciada como existente.

Preferir acesso restrito e uma **origem HTTPS estável** para validar F5, persistência e atualização entre revisões. [Deployment Protection](https://vercel.com/docs/deployment-protection) é controle do host, não login novo no Atlas. Método/escopo disponíveis e funcionamento em PWA/dispositivos exigem verificação na conta. URL de preview diferente a cada build não valida atualização na mesma origem; alias estável exige autorização explícita. Não desativar proteção para conseguir instalar sem decisão do usuário. noindex não é controle de acesso.

Staging pode servir para executar testes humanos ainda pendentes, sem aceitar a performance nem aprovar release. Nenhum dado pessoal será importado: usar perfil vazio e registros fictícios. Antes de qualquer troca voluntária de origem, salvar notas e exportar JSON; bancos não migram automaticamente, preferências/rascunhos/undo não viajam nesse backup. [Dados e privacidade](DATA-AND-PRIVACY.md).

## Configuração mínima proposta

Inspeção real: Vite SPA/BrowserRouter, build `npm run build`, saída `dist/`, sem variável obrigatória, root base e PWA scope/start/id `/`. O [exemplo específico](staging-vercel.example.json) está **somente em docs**, não é vercel.json ativo e não foi enviado/validado na Vercel. Não tem Git integration, CI, function, backend, domínio, analytics ou env novo.

Build local depois da autorização: npm ci/build e checks; revisar conteúdo de dist antes do upload. Para pacote estático já construído, host não precisa rebuild/npm install/output dist dentro de dist: index.html é a raiz do pacote. Para uma futura integração Git diferente, build seria npm run build/output dist, com nova revisão do conteúdo a enviar.

| Regra proposta                                      | Necessidade / verificação                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rewrite de navegação → index.html                   | Rotas diretas e refresh. Excluir assets/, icons/ e paths com extensão; recurso ausente permanece elegível a 404 real, não SPA. Desconhecido sem extensão pode mostrar página React/HTTP 200, distinção documentada.                              |
| HTML, sw.js, manifest e recursos sem hash: no-cache | Revalidar; não prender atualização do worker/index. Mantém conteúdo real/offline existente.                                                                                                                                                      |
| assets/:path*: cache longo immutable                | Diretório gerado contém arquivos com hash; não aplicar a HTML/worker nem a tudo. Verificar cabeçalhos de assets reais **e 404**, sem cache persistente de erro. Se o host aplicar immutable a 404, restringir/remover override antes de aprovar. |
| nosniff                                             | Não deixar HTML incorreto passar por JS; MIME real ainda precisa estar correto.                                                                                                                                                                  |
| no-referrer                                         | Evitar enviar URL de navegação/queries em links externos.                                                                                                                                                                                        |
| X-Robots-Tag noindex/nofollow/noarchive             | Staging não é divulgação/indexação; não controla quem pode abrir a URL.                                                                                                                                                                          |
| MIME estático do host                               | JS text/javascript ou application/javascript; manifest application/manifest+json; SW MIME JS; ícones image/png. Não mascarar um 404 de HTML forçando Content-Type de JS.                                                                         |

A [documentação Vercel](https://vercel.com/docs/project-configuration/vercel-json) descreve rewrites/headers e negative lookahead em capture group. A regra foi avaliada localmente como regex contra rotas/recursos do Atlas; **isso não comprova o matcher ou comportamento hospedado**. Não usar catch-all irrestrito: o preview Vite da 10A respondeu HTML/200 a um JS inexistente. Sem mudança de Vite/Workbox para ocultar esse comportamento local.

Não impor CSP ampla/unsafe-inline ou HSTS includeSubDomains sem testar recursos e controlar domínio. O host deve oferecer HTTPS. Headers adicionais dependem de objetivo e validação, não de copiar um template.

## PWA, atualização e origem

Manifest/ícones/atalhos existentes; SW prompt/skipWaiting false, precache inclui recursos lazy. O aviso beUI acompanha dist como terceiro, sem adicionar UI ou mudar estratégia do SW. HTML/assets precacheados e IndexedDB têm funções distintas. Não publicar uma segunda revisão trocando a origem para simular atualização.

Versões A/B precisam de build/worker diferentes, mesmo endereço estável e dados fictícios. “Agora não” conserva A; “Atualizar” deve ativar B preservando nota não salva e ID/tempo de timer, sem concluir tarefa/sessão automaticamente. Revalidar offline/rotas lazy depois. Proposta de rollback: recolocar artefato anterior na mesma origem mediante autorização; rollback não restaura banco e não deve limpar conteúdo.

## Checklist hospedado — todos não testados

Registrar para cada item: ambiente/dispositivo, URL/commit/revisão, passo, esperado, observado/evidência e aprovado/reprovado/não testado. Não preencher resultado por inferência.

| Passo                                                                                            | Esperado                                                                                                                       | Estado      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Abrir diretamente /, /tarefas, /habitos, /notas, /metas, /estudos, /foco, /perfil, /preferencias | Shell e conteúdo correto; queries de relações preservadas.                                                                     | Não testado |
| F5 em cada rota interna                                                                          | Documento e recursos carregam, dados persistem.                                                                                | Não testado |
| Rota desconhecida sem extensão                                                                   | Página não encontrada do Atlas; registrar status HTTP real.                                                                    | Não testado |
| JS/CSS/manifest/SW/icon inexistente: sem SW e depois com SW real                                 | 404 real para recursos, sem index.html disfarçado; não cachear erro longo. Testar fetch/script, não só navegação de documento. | Não testado |
| MIME/cache/HTTPS/manifest/ícones/escopo/atalhos                                                  | Tipos corretos, HTML/SW revalidam, assets versionados coerentes.                                                               | Não testado |
| Instalar Windows, fechar e reabrir                                                               | Instalação física registrada, origem/dados persistem.                                                                          | Não testado |
| Instalar em celular disponível                                                                   | Registrar dispositivo/navegador e método; não inventar Safari/iOS.                                                             | Não testado |
| Preparar online e recarregar offline                                                             | App utilizável após preparação, sem depender de acesso inicial offline.                                                        | Não testado |
| Criar/editar nota/tarefa offline; reconectar/F5                                                  | Mesmo conteúdo/IDs, sem cópias nem perda.                                                                                      | Não testado |
| Rotas/Markdown/Tabela/preview/calendário/Dados ainda não visitados offline                       | Chunks precacheados funcionam.                                                                                                 | Não testado |
| Versões reais A/B; Agora não                                                                     | A continua; preservar dados/rascunho/timer.                                                                                    | Não testado |
| Atualizar com nota não salva e timer ativo                                                       | B ativa; conteúdo, ID e timestamps corretos, sem duplicação/conclusão automática.                                              | Não testado |
| Teclado/Tab/Shift+Tab/Ctrl+K/?/Escape                                                            | Foco visível, diálogos contidos, retorno ao acionador.                                                                         | Não testado |
| Zoom nativo 200%, temas, 375/768/1280/1440, motion/transparência reduzidos                       | Sem overflow/controle inacessível; separar texto CSS de zoom real.                                                             | Não testado |
| NVDA Windows e dispositivos disponíveis                                                          | Registrar observação humana; automatização não substitui.                                                                      | Não testado |
| 3 Lighthouse frios + 3 de retorno, sem suites concorrentes                                       | Mesmo método 9C; perfil frio limpo; conteúdo real; publicar todos e medianas separadas.                                        | Não testado |

[Checklist humano existente](MANUAL-RELEASE-CHECKLIST.md) permanece a fonte para testes físicos; esta matriz acrescenta URL/headers/host. Não declarar resultados de localhost como validação Vercel.

## Ações externas exatas — dependem de autorização futura

1. Escolher conta/equipe/plano e criar ou vincular **somente** projeto de staging; isso cria metadados remotos.
2. Configurar método/escopo de proteção e quem acessa; decidir origem/alias estável e permissões/custo, se houver.
3. Upload do pacote dist/config revisado para Preview: transfere código cliente/ícones/avisos, nunca banco/backups/relatórios brutos. Mesmo URL restrita constitui hospedagem externa e exige aprovação.
4. Criar/alterar alias do staging; executar validação hospedada com dados fictícios e segunda revisão A/B; cada nova revisão transfere outro artefato.
5. Eventual rollback do staging ao artefato anterior, na mesma origem, sem apagar banco.

**Não incluídos:** push, criar/publicar repositório, mudança de visibilidade, tag, release, produção, domínio próprio ou migração de dados pessoais. Requerem outra autorização se desejados. Não foi pedido nem executado aceite automático de performance 86/99.

## Teste pessoal - preparação adicional em 06/10/2026

- Conta Hobby consultada; listagem no escopo padrão não contém projeto Atlas. Consulta explícita ao espaço retornou 403, portanto permissões de criação/configuração ainda não são presumidas. Identificação da conta e destino será apresentada privadamente ao titular antes de qualquer ação externa.
- Proposta permanece Preview isolado `atlas-staging`, com alias HTTPS fixo sujeito à disponibilidade. Conforme [mudança oficial de setembro](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan), Vercel Authentication em **All Deployments** não exige upgrade/add-on; o Hobby tem limites de uso. Password Protection é alternativa paga no Pro, não proposta para este teste. Nenhuma proteção será removida, exceção pública ou assinatura paga será ativada sem confirmação.
- Manifest usa `useCredentials: true`, correção técnica necessária para buscar o recurso com a sessão do host ([FAQ do plugin](https://vite-pwa-org.netlify.app/guide/faq)). Sem novo login do Atlas, alterações visuais, modelo, backend ou sincronização. Teste Chromium local bloqueia manifest sem cookie fictício e valida sua leitura com sessão; não comprova Vercel ou Android físico.
- Pacote local isolado e ignorado: 69 arquivos / 1.421.893 bytes, incluindo somente dist e exemplo de vercel.json. Lista/hash por arquivo em evidência local ignorada. Nenhum banco, backup, .git, relatórios internos ou conteúdo do perfil pessoal. Não enviado.
- Checks: lint, typecheck, build e 847 unitários passaram; três E2E direcionados de manifest com sessão, offline/rotas inéditas e critérios de instalação em perfil descartável passaram (41,7 s). Suíte integral anterior de 106 E2E não repetida nesta correção. Instalação física Chrome Android/Chrome ou Edge Windows e comportamento real da sessão protegida continuam não testados; não garantir instalação antes dessa verificação.
- Frio 86 / retorno 99 permanecem históricos; o titular permite testar pessoalmente com a meta pendente, sem aprovar release definitiva. Computador e celular terão bancos separados, sem sincronização. Não importar backups automaticamente. Autorizações externas seguem a lista acima, com nova confirmação antes do deploy.
