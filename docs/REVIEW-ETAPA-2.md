# Revisão — etapa 2: dados locais

## Resumo

Avaliação apple-design: **Good** no escopo entregue. O painel mantém o controle de dados em um único lugar, explica o que será importado e permite remover/desfazer exemplos sem configurar o aplicativo. UI web React com princípios do HIG, não uma reprodução de convenções nativas.

Referências desta etapa: `sheets.md`, `file-management.md`, `entering-data.md`, `undo-and-redo.md`, `onboarding.md`; fundamentos e roteamento da skill já carregados na etapa 1 (accessibility, layout, typography, color, liquid-glass, feedback, keyboards).

## Achados e correções

### High — evitar perda de conteúdo durante importação

- **O quê:** sobrescrever silenciosamente registros com o mesmo ID tornaria uma restauração arriscada.
- **Por quê:** `file-management.md › Saving work`: “Help people be confident that their work is always preserved unless they cancel or delete it.”
- **Correção:** prévia com quantidades, confirmação explícita, importação aditiva, preservação de existentes, revalidação dentro da transação. Uma falha no meio da escrita causa rollback integral.

### High — remoção de exemplos não pode alcançar registros pessoais

- **O quê:** apagar por tag apagaria conteúdo pessoal com a mesma tag; apagar referências deixaria vínculos quebrados.
- **Por quê:** Agency em `design-principles.md` e recuperação em `undo-and-redo.md › Best practices`.
- **Correção:** marcador dedicado `isExample`, promoção ao editar, proteção transitiva de referências e desfazer armazenado no IndexedDB. Atualização otimista volta ao estado anterior em caso de erro.

### Medium — feedback acessível dentro e fora da sheet

- **O quê:** fechar o painel durante uma operação poderia esconder o resultado.
- **Por quê:** `feedback.md › Best practices`: “Make sure all feedback is accessible.”
- **Correção:** regiões de status/erro e aviso dispensável com desfazer, renderizado via portal fora das superfícies com blur. Desfazer continua disponível no painel e após recarregar.

### Medium — texto e interação do seletor de arquivo

- **O quê:** o controle nativo mostrou textos em inglês no navegador de teste.
- **Por quê:** clareza de entrada (`entering-data.md › Best practices`) e requisito de interface pt-BR.
- **Correção:** botão “Escolher arquivo” aciona o seletor nativo; nome e instruções do campo têm rótulos acessíveis. Escape retorna o foco a “Seus dados”. A sheet rola com fonte a 200% sem transbordamento horizontal.

## Verificações

- Etapa 1 revalidada antes da implementação: lint/typecheck/build aprovados; commit `e1f6d49` existente; árvore inicialmente limpa.
- 38 testes unitários/integração: modelos, JSON/Markdown, caracteres especiais, rejeição de versões/arquivos inválidos, vínculos/IDs/datas/URLs, seed concorrente, reabertura, CRUD, proteção de conteúdo pessoal, undo durável, import idempotente, transação com falha injetada e rollback otimista.
- Cinco fluxos Edge: downloads reais, cancelamento/prévia/confirmação, reimportação sem duplicar, persistência, atualização entre abas, bloqueio de IndexedDB, temas, teclado, texto a 200%, larguras 375/768/1280 e axe WCAG A/AA.
- Fluxos também executados contra o build de produção. Exportação/importação Markdown testadas sem rede com a página já carregada. Não equivale à recarga offline/PWA.
- Build passou sem warnings após separar chunks estáveis de Dexie e Zod; pacote principal em aproximadamente 363 kB, sem aumentar o limite de warning. Lint e typecheck limpos, incluindo testes E2E.
- Capturas em `docs/screenshots/etapa-2-*`; registros históricos da etapa 1 preservados.

## Limites explícitos

Não é a auditoria final da etapa 9. Não houve ensaio manual com leitor de tela, Lighthouse nem carga com dezenas de milhares de registros. Preview de listas limitado a cinco itens; o cadastro/edição completos e a virtualização das listas futuras pertencem às etapas seguintes. Importação limitada a 5 MB; notas de até 500 mil caracteres. Preferências visuais e histórico interno de desfazer não fazem parte do backup. Markdown comum cria nova nota por importação; Markdown Atlas reconstitui o bloco de restauração, não as edições da leitura humana.
