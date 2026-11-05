# Etapa 9C — diagnóstico antes das mudanças

Baseline de código: `ca17792`, Git inicialmente limpo. A direção visual continua congelada em `eb7c770`. Sem novos recursos, push ou deploy. Toda medição/teste destrutivo usa perfil/banco descartável.

## Cadeias confirmadas

1. `App → DataProvider → data-store → service → DexieAtlasRepository → note-links → unified/remark-parse/micromark`. A inicialização não usa AST Markdown, mas imports de renomeação tornam o parser estático.
2. `data-store/repositories → data-integrity → noteEdges → note-links`. Validação de snapshots e relações por ID não precisa do AST; somente a proteção de exemplos referenciados por wikilinks precisa.
3. `routes → Shell → DataPanel → removableExamples + DataTransfer`. Mesmo com a sheet fechada, DataPanel calcula o conjunto removível, percorrendo Markdown de notas. Exportação/importação são ações explícitas, não trabalho necessário para Hoje.
4. `App → LazyMotion → motion-features(domMax)` já é dinâmico, mas começa na montagem. Não alterar esse timing antes de medir a hipótese de Markdown.

Chunks de produção da 9B: entrada 325.595 bytes, Hoje 90.111, React 258.514, Dexie 95.202, Zod 89.696, engine 86.821. Waterfall e seis coletas anteriores em PERFORMANCE-AUDIT-9B.md. O diagnóstico de módulos do build atual está em `bundle-9c-baseline.json`; tamanhos finais dos arquivos prevalecem sobre código observado antes dos últimos hooks do bundler.

Validação e infraestrutura foram inspecionadas: `readSnapshot` já lê as dez coleções em paralelo e valida o snapshot; `initialize` verifica marcadores/seed numa transação e o liveQuery lê um snapshot depois da inicialização para acompanhar alterações. A segunda leitura não foi removida sem prova de ganho e segurança de concorrência. StrictMode duplica effects no desenvolvimento, não nesta medição de produção. Hoje monta dados reais e recursos compartilhados; nenhuma tela de loading ou widget foi usado para substituir o conteúdo medido. A carga sob demanda elimina também o cálculo de wikilinks no botão fechado, que antes se repetia a cada mudança de snapshot.

## Hipótese 1 e limites

Retirar AST/transferência do caminho estático e do botão fechado deve reduzir download/parse da entrada e antecipar conteúdo real de Hoje. Não reescrever o parser, não tirar Zod, não alterar schemas, seed ou migrações, não abrir transações enquanto um import externo está pendente.

Separar funções de validação/IDs e identidade de nota em módulos leves. Preservar os exports síncronos antigos para callers/testes. Carregar parser antes da transação de renomeação/remoção. Carregar conteúdo da sheet de dados somente ao abrir. Remoção otimista do seed inteiramente de exemplo continua imediata; havendo registros pessoais, esperar o cálculo completo de wikilinks antes de ocultar qualquer exemplo, com `busy` imediato e rollback em erro.

Riscos a testar: parser indisponível não bloqueia inicialização/tarefas; falha de carga não abre escrita parcial; wikilinks pessoais protegem exemplos inclusive transitivamente; envio duplicado durante import tardio; foco na sheet carregada; editor/preview/backlinks/renomeação/transferência e offline continuam íntegros.

## Ordem e critério de parada

1. Seis coletas do baseline atual (três frias, três retornos), configuração da 9B, sem outras suítes/build simultâneos.
2. Uma alteração de fronteiras de imports, build e inspeção real dos módulos/chunks; uma coleta fria exploratória identificada como probe.
3. Se o resultado justificar, manter essa alteração e rodar regressão integral/PWA. Se não justificar, registrar e reconsiderar a hipótese sem buscar uma rodada favorável.
4. Seis coletas finais comparáveis e medianas, após dist estável; nenhuma suíte concorrente.
5. Checklist humano com todos os itens inicialmente Não testado e separação local/staging; revisão, decisões e commit Conventional Commits após lint/typecheck/test/build.

O objetivo é mediana fria ≥90. Caso não atinja, entregar resultado real e a decisão entre uma nova otimização dirigida ou aceitar a limitação numa release inicial. Nunca declarar instalação física ou leitura humana por automação. HIG aplicado: `loading.md > Best practices`, `motion.md > Providing feedback`, `feedback.md > Best practices`; os fundamentos e a tradução web foram relidos.
