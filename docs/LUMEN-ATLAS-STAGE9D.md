# Lumen → Atlas — Stage 9D

Stage 9D expõe o núcleo aprovado nas interfaces. Stage 9E (aceitação manual
completa) e transferência de pesquisas reais permanecem fora desta autorização.
Nenhuma nota, base ou configuração pessoal foi usada nos testes.

## Arquitetura e limites

Em Notas, **Importar do Lumen** e **Histórico Lumen** são entradas próprias,
distintas de Markdown e restauração de backup. Os componentes são carregados sob
demanda e reutilizam EntrySheet, campos, botões e tokens do Atlas. EntrySheet
ganha somente uma opção de impedir fechamento durante escrita confirmada; os
usos anteriores mantêm o comportamento padrão.

LumenTransferSession controla seleção, leitura limitada, prévia, confirmação,
cancelamento e resultados. O domínio continua em decodeLumenPackage,
planLumenImport e LumenAtlasRepository. O repository ganha somente operations(),
consulta validada e somente leitura para selecionar o histórico existente.
Nenhuma regra do contrato, operação transacional, schema ou backup foi alterada.

A prévia apresenta operação, título, identidade, hash do pacote, baseline,
campos afetados, avisos, conflitos e Markdown atual/proposto completo com YAML.
Textareas somente leitura permitem seleção, cópia e rolagem, sem renderizar
HTML, código, embeds ou recursos externos. Como todo textarea, a apresentação
DOM pode normalizar finais de linha; a operação usa a string validada do pacote,
não o texto recuperado do campo. A persistência mantém o conteúdo do contrato.

Não há merge, força, adoção por título, recriação silenciosa ou renomeação
contrária ao contrato. Resultados distinguem criação, atualização, reimportação
idêntica sem escrita/timestamp, conflito, pacote inválido, evidência insuficiente,
limite, cancelamento e falha. Falhas usam diagnósticos fixos, sem reproduzir
exceções arbitrárias ou corpos de notas.

Confirmação explícita é uma fase separada. Troca do arquivo/plano ou notificações
de notas/drafts invalidam a prévia. Ao confirmar, o File é lido novamente e seu
hash comparado; o repository mantém a revalidação transacional. Retornar à aba
também invalida a prévia para exigir nova conferência. Durante a escrita
confirmada, campos/fechamento ficam bloqueados para evitar dupla submissão.

## Drafts reais, sem alteração na arquitetura do editor

readLumenDraftStatus usa o schema e a chave existentes
atlas.note-drafts.v1 e a store useDrafts. Faz união dos IDs persistidos e em
memória. JSON corrompido, armazenamento negado ou erro de persistência produzem
checked: false. Não limpa, salva ou migra drafts.

O guard é consultado novamente pela operação dedicada. A store do editor, sua
proteção de versão obsoleta e seu comportamento de gravação permanecem intactos.
**Não existe atomicidade entre localStorage e IndexedDB**: uma outra aba pode
iniciar um draft após a última consulta. Eventos/foco invalidam a UI, e os
guards conservadores reduzem essa janela, mas não são um lock entre storages.

## Recuperação

O catálogo lista operações, título, data e possibilidade de restauração. Uma
atualização elegível mostra a versão anterior e a atual, o efeito em uma única
nota e exige revisão/confirmação explícitas. planRestore/restore continuam
verificando hashes, versão atual, drafts e evidência em transação. Criações não
oferecem reversão por exclusão, nem há adoção automática de candidatos.

A interface informa: histórico local deste navegador; não incluído nos backups
atuais; 100 operações/20 MiB; atualizações bloqueadas no limite; ausência de
limpeza automática; perda de evidência após restauração de backup pode bloquear
atualizações. Sem portabilidade ou sincronização.

## Ambiente explicitamente fictício

Exemplo público de raiz: C:\Projetos\Atlas. Não use origem de produção, banco
pessoal, perfil persistente existente ou configuração de pesquisa real.

```powershell
Set-Location 'C:\Projetos\Atlas'
$env:VITE_LUMEN_TEST_SESSION = 'stage9d-revisao-01'
npm run dev -- --config vite.lumen-test.config.ts
```

Abra http://127.0.0.1:4189/notas em perfil temporário separado/InPrivate novo.
A configuração recusa início sem sessão explícita, fixa host/porta e evita
descoberta de .env na raiz. A composição seleciona
atlas-lumen-test-stage9d-revisao-01, e o diálogo mostra a sessão/banco. A guarda
recusa sessão de teste em origem diferente ou build de produção. Outra sessão
seleciona outro banco, sem limpar/substituir o anterior.

No Lumen, use o helper tools/stage9d_demo.py: gera um vault/nota/pasta de pacotes
fictícios numa área nova e abre sem carregar settings pessoais. Selecione a
origem impressa, categoria ferramentas e destino Pacotes-Ficticios; confirme a
preparação. A mensagem de pacote preparado nunca declara entrega confirmada.

Para teste automatizado real de navegador:

```powershell
npm run test:e2e -- --config playwright.lumen.config.ts
```

Esse runner usa contextos efêmeros do Edge, sem userDataDir/storageState
pessoal, origem 127.0.0.1:4189, sessão stage9d-fictional, servidor novo
(reuseExistingServer: false) e bloqueio de requisições externas. Nenhum perfil
pessoal é substituído. Scripts de fixture só abrem o banco de teste nomeado.

## Arquivos Stage 9D

Alterados:

- src/components/EntrySheet.tsx — bloqueio opcional durante escrita.
- src/data/service.ts — mesma base injetada nos repositories, opt-in de teste.
- src/data/repositories/lumen-atlas-repository.ts — consulta operations somente leitura.
- src/features/notes/NotesPage.tsx — entradas separadas.
- src/features/notes/draft-store.ts — adapter somente leitura, mesmo schema/chave.
- tsconfig.node.json — checagem dos dois novos arquivos de configuração.
- README.md e docs/DECISIONS.md — documentação adicional.

Novos:

- src/features/notes/LumenTransferButton.tsx e LumenTransferDialog.tsx.
- src/features/notes/lumen-service.ts, lumen-session.ts e lumen-presentation.ts.
- src/styles/lumen-transfer.css (somente o fluxo Lumen).
- src/features/notes/LumenTransferDialog.test.tsx, lumen-session.test.ts,
  lumen-drafts.test.ts.
- src/lib/lumen-test-environment.ts e lumen-test-environment.test.ts.
- e2e/lumen-transfer.spec.ts, playwright.lumen.config.ts, vite.lumen-test.config.ts.
- Este relatório.

Os arquivos de package/dependency e os trabalhos Stage 9C já estavam modificados
ou untracked antes desta etapa e foram preservados. Sem dependência nova.

## Evidências e checks

Baseline pertinente: 195 testes / 7 arquivos aprovados (67,14 s).
Novas suites isoladas: 18 testes de sessão/drafts/ambiente e 5 de componentes,
todos aprovados. Os testes usam fake-indexeddb; isso não é navegador real.

Duas jornadas automatizadas executadas no Edge real isolado, aprovadas
(47,2 s no run com diretório dedicado de evidências):

- criar, reimportar identicamente, atualizar e restaurar com confirmação.
- cancelamento, pacote inválido, drafts, confirmação obsoleta, conflito local e limite.

Comparam dados fictícios persistidos e verificam ausência de mudanças nas outras
coleções. Capturas de plano/confirmação e recuperação a 390×844 ficam em
test-results/lumen-stage9d/lumen-transfer-create-iden-89050-on-in-isolated-real-browser/.
A versão desktop usa viewport 1280×720. A geometria do botão de restauração foi
verificada; capturas são de testes automatizados e não aceitação manual.

O primeiro run completo sem progresso ficou sem retornar resultado e foi
interrompido. Não conta como aprovado. O novo run com reporter verbose concluiu: **1.042 testes / 81 arquivos**,
todos aprovados, em **333,97 s**. Nenhum teste comportamental foi removido.
Typecheck, lint, build e git diff --check concluíram sem erros. Git informa
somente os avisos existentes de conversão LF/CRLF na cópia Windows.
Após o ajuste final de posição das ações, os checks pertinentes de componentes,
tipos, lint, build e navegador serão registrados abaixo.

```powershell
npm run test -- --reporter=verbose
npm run lint
npm run typecheck
npm run build -- --config vite.lumen-test.config.ts
```

O build usa a mesma configuração-base, com envDir fictício e sem sessão de teste,
para evitar ler valores .env pessoais. Não é deploy nem teste PWA de produção.
Não foram instalados pacotes, alterados backups/schema, nem usados APIs de IA.

## Limitações e revisão manual pendente

- Stage 9E manual continua pendente, mesmo com jornadas automatizadas completas.
- Testar os pickers nativos, teclado/rolagem, alto contraste/leitor de tela,
  escalas reais do Windows e dispositivos físicos; não se declara acessibilidade completa.
- No Atlas, verificar título/operação/diferenças/avisos e Cancelar antes de confirmar.
- Conferir reimportação idêntica, draft bloqueado e restauração de uma nota fictícia.
- Registros Lumen perdidos/movidos exigem recuperação explícita, sem similaridade.
- Recuperação continua limitada ao navegador/origem; backups não carregam sua evidência.
- Transferências reais, sincronização e recibos dependem de autorização posterior.

## Fechamento da verificação — 2026-10-18

Após colocar as ações de revisão no rodapé fixo:
- **23 testes / 4 arquivos** de componentes, sessão, drafts e ambiente passaram
  (18,83 s), sem alteração nos testes comportamentais existentes.
- **2 jornadas no Edge real isolado** passaram (35,3 s), com capturas finais
  desktop 1280×720 e mobile 390×844. As capturas foram inspecionadas; os controles
  de revisão/confirmação permanecem acessíveis no rodapé.
- Lint passou novamente. O build final passou, incluindo o typecheck tsc -b,
  usando a configuração-base e envDir fictício. Sem deploy.
- A regressão completa anterior ao último ajuste de posição foi **1.042/1.042
  testes, 81/81 arquivos**. O ajuste final foi coberto pelos checks focados acima.
- Pickers/controles nativos seguem o idioma do navegador/Windows; a cópia do
  aplicativo é em português. Interação manual com pickers continua pendente.

Git: main, HEAD 5a113da inalterado; 9 arquivos tracked modificados no total e
arquivos untracked preservados/adicionados, nada staged. package.json e
package-lock.json já estavam modificados no baseline e não foram editados nesta
etapa. git diff --check passou (avisos LF/CRLF não são falhas). Nenhum commit,
push ou deploy foi realizado.

Nenhum acesso a vault, pesquisas reais, bancos pessoais do navegador, valores
.env ou skill. Os testes foram limitados a fixtures/diretórios temporários,
fake-indexeddb e contextos efêmeros no banco fictício nomeado. Stage 9D encerra
nesta revisão; Stage 9E e qualquer pesquisa real continuam pendentes.
