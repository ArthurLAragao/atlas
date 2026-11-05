# Revisão de design e qualidade — etapa 6

Data: 2026-10-02. Base anterior confirmada: `cc94842 feat: integra hoje e captura global com atalhos`. Revisão com a skill apple-design, roteada por `references/hig-lookup.md`, e checklist React Best Practices.

## Resumo

Atlas é uma aplicação web React, para estudo e organização pessoal. A tese de Notas é abrir, anotar, conectar e encontrar sem preparar um workspace. O caderno editorial mantém o heatmap como assinatura do produto: sistema tipográfico, listas com divisórias e texto em superfície sólida, sem barra de ferramentas extensa.

Avaliação: **Good**. Os achados de acessibilidade detectados foram corrigidos. A verificação cobre código, testes automatizados e capturas reais; leitor de tela humano, Lighthouse, dispositivos físicos e o limite máximo de conteúdo não foram medidos. As convenções nativas do macOS orientam teclado e clareza, sem impor menus do sistema a uma aplicação web.

## Acessibilidade — achados corrigidos

- **Crítico — O quê:** checkboxes de listas Markdown não tinham nome acessível. **Por quê:** `accessibility.md > Vision`: "Describe your app's interface and content for VoiceOver." **Correção:** o renderer associa cada checkbox ao texto do item e anuncia concluído/pendente; mantém o controle desabilitado na prévia. Teste de componente e Axe verificam os nomes, sem excluir regras.
- **Crítico — O quê:** uma opção de autocomplete continha um botão focável dentro de `role=option`. **Por quê:** leitores de tela podem ocultar controles aninhados; julgamento de implementação ARIA, alinhado a `accessibility.md > Speech`. **Correção:** uma única opção/botão com ID, seleção e nome; foco permanece no textarea com `aria-activedescendant`, setas/Enter/Escape e alternativa por clique/Tab. Axe não encontra `nested-interactive`.
- **Crítico — O quê:** desfazer a última exclusão desmontava o botão focado. **Por quê:** `undo-and-redo.md > Best practices`: "Show the results of an undo or redo." **Correção:** mostrar e focar o link da nota recuperada. Enter abre edição nas notas ativas; o teste de navegador verifica foco e conteúdo após reload/undo.

Contraste calculado por luminância sRGB nos tokens reais:

| Combinação                                                |  Escuro |   Claro |
| --------------------------------------------------------- | ------: | ------: |
| Texto principal / bg                                      | 16,46:1 | 16,33:1 |
| Texto secundário / surface-elevated escuro, surface claro |  6,59:1 |  5,53:1 |
| Accent azul / bg                                          | 10,44:1 |  6,45:1 |

Superam 4,5:1 para texto comum. Botões, campos, opções, links da prévia/backlinks e summary usam o token mínimo de 44 px. Foco visível, seleção além de cor, tabela rolável por teclado, listas virtualizadas com posição/tamanho anunciados. Não houve overflow nos testes de 375, 768 e 1280 px, inclusive ao duplicar o tamanho de texto. Reduced motion/transparency, contraste aumentado e temas usam a base existente; a suíte anterior continua cobrindo esses estados.

## Plataforma e interação — achados corrigidos

- **Médio — O quê:** completar um link fechado antes de `]]` ou com caret no meio deixava fechamento/sufixo duplicado; barras escapadas em pares não ofereciam sugestão. **Por quê:** a captura deve ser previsível; julgamento de produto. **Correção:** reutilizar o parser para excluir código/links externos e substituir todo o intervalo até o fechamento. Regressores cobrem ambos os carets, escapes ímpares/pares e Unicode.
- **Médio — O quê:** a criação por palette aceitava títulos reservados que o editor depois recusava. **Por quê:** `search-fields.md > Best practices`: "Use placeholder text to help people know what they can search for." Validação consistente é julgamento de produto. **Correção:** factory/preview recusam `[[` e `]]` em títulos de nota, com orientação visível; tarefa/hábito mantêm seu contrato.
- **Alto — O quê:** duas gravações no mesmo milissegundo mantinham o mesmo token de versão. **Por quê:** preservar trabalho é requisito de responsabilidade, e não uma preferência visual. **Correção:** timestamp monotônico em save, referências renomeadas e archive; transações recusam a versão desatualizada, preservando o rascunho e oferecendo cópia.
- **Alto — O quê:** conteúdo/exportação reinterpretavam tags importadas contendo vírgula ou `#`. **Por quê:** dados do usuário precisam manter significado; julgamento de dados. **Correção:** preservar array original enquanto o campo não muda. Testes puros e browser verificam edição só de conteúdo, exportação e reimportação com tags exatas.
- **Alto — O quê:** remover exemplos ignorava notas de exemplo referenciadas por Markdown pessoal. **Por quê:** dependências devem sobreviver à limpeza; julgamento de integridade. **Correção:** incluir arestas wiki resolvidas na proteção transitiva existente. Nove testes cobrem ciclos, ambiguidade, código, fonte arquivada e dependências de outros tipos.

## Craft e conteúdo

- **Baixo — O quê:** a confirmação "Nota salva" aparecia duas vezes em celular. **Por quê:** `layout.md > Visual hierarchy`: "Order content by relative importance." **Correção:** manter uma confirmação inline no editor; feedback compartilhado fica para falhas, recuperação e ações destrutivas.
- **O que funciona:** `text-views.md > Best practices`: "Keep text legible." Editor nativo e prévia têm largura máxima de 42 rem, corpo de 16 px/1,6 e papéis tipográficos por hierarquia. Texto continua selecionável; código quebra linhas longas e tabelas têm região de rolagem.
- **O que funciona:** `segmented-controls.md > Best practices`: "provide closely related choices". Só Editar e Pré-visualizar, estado exposto por `aria-pressed`; templates numa sheet curta. `search-fields.md > Best practices`: "start search immediately when a person types". Busca local instantânea por título/conteúdo/tags; a global mostra tipo e arquivamento.
- **O que funciona:** `liquid-glass.md > The two layers`: "never Liquid Glass" no conteúdo. Vidro restrito ao shell, palette e sheets, com fallback opaco; editor, texto e sugestões são sólidos. O módulo não acrescenta animação frequente na digitação.
- **O que funciona:** vazio convida a escrever uma frase; links ausentes explicam como criar/diferenciar títulos. Sem tela de grafo, anexos, IA ou infraestrutura fora do escopo.

## Verificação

- Lint e typecheck sem erros; build de produção sem warnings.
- **400 testes unitários em 27 arquivos**, contra 266 em 17 na etapa anterior. Nenhum teste/assertion anterior foi removido. A fixture antiga de vínculos explícitos foi isolada do novo comportamento wiki; a captura E2E antiga ganhou asserções de abertura da nota.
- **38 testes E2E** executados contra `http://127.0.0.1:4180`, build de produção, em Microsoft Edge com contextos descartáveis. Dez novos cenários de Notas; os 28 anteriores continuam presentes.
- Autoria dos quatro templates; edição/prévia e rascunho após navegação/reload; autocomplete, backlinks e rename; busca conteúdo/tag/global; `nota:` abre edição; arquivo/exclusão/undo com foco; tags especiais; Markdown individual e backups completos.
- Ida e volta JSON e Markdown no IndexedDB real: exportar, limpar tabelas do contexto de teste, importar e comparar todos os campos das notas próprias ligadas/arquivadas. Os cenários de backup da etapa 2 também continuam passando. Importação classifica exemplos como dados próprios conforme o contrato anterior; os testes novos removem exemplos antes de comparar dados próprios integralmente.
- Texto de 120 seções em três larguras, temas claro/escuro, texto a 200% e Axe sem violações. Lista de 210 notas virtualizada, Home/End/setas alcançando extremos. HTML/URLs executáveis e imagens remotas não executam/carregam na prévia; console da aplicação sem erros nos fluxos testados.
- Capturas em `docs/screenshots/etapa-6-{editor,escrita,preview}-{375,768,1280}.png`, com inspeção visual de escrita mobile e prévia desktop.

## Limites explícitos

Conteúdo salvo é offline com a página aberta; instalação/recarga offline por PWA pertence à etapa 8. Rascunhos e histórico de undo não fazem parte do backup de conteúdo. Markdown individual é legível e importável pelo Atlas, não um parser YAML genérico. Grafo só tem contrato de arestas/pasta reservada. Nenhuma nota Lighthouse ou validação com leitor de tela real foi declarada.
