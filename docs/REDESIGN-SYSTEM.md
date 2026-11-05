# Sistema visual — 9A rebuild

Um centro de comando silencioso: conteúdo editorial sobre um canvas profundo, controles curtos e navegação que flutua sem ocupar uma coluna permanente.

## Composição

As anotações mais recentes substituem a sidebar pelo dock fixo central inferior. Destinos são links reais; o perfil pertence ao dock. No mobile, Hoje, Tarefas, Hábitos e Perfil ficam diretos; Notas, Metas e Estudos ficam em Mais, mantendo cinco controles no dock. Preferências ficam agrupadas com Aparência no cabeçalho. O rodapé passa a ser apenas assinatura. O espaço reservado ao dock impede que controles finais fiquem cobertos.

Hoje usa prioridades como área dominante, compromisso e direção semanal como coluna complementar e hábitos abaixo. A ordem personalizada prevalece: a composição editorial só se aplica à sequência padrão. As demais telas mantêm listas e leitura sólida, com hierarquia menor de caixas.

## Tokens

Espaçamento: 4/8/12/16/20/24/32/40/48/64 px. Controles: 44 px ou mais. Raios: 10/14/18/24 px, usando 24 apenas em captura e superfícies especiais. Títulos: 32–40 px; corpo: 16 px; informações auxiliares: 12–14 px. Números tabulares em métricas, datas, progresso e cronômetro.

Canvas, superfície, superfície elevada/selecionada/hover, linhas, texto, foco e accent são variáveis semânticas. As novas variáveis derivam da paleta existente para manter contraste em todas as cores e nos dois temas. Vidro fica somente em navegação, popovers e sheets.

| Papel                             | Escuro  | Claro   | Uso                                        |
| --------------------------------- | ------- | ------- | ------------------------------------------ |
| canvas / bg                       | #101010 | #fafafa | Página e áreas de leitura                  |
| surface                           | #191919 | #f2f2f2 | Controles e agrupamentos reais             |
| surface-raised / surface-elevated | #242424 | #ffffff | Superfícies transitórias elevadas          |
| line-subtle / border              | #383838 | #d8d8d8 | Divisores decorativos                      |
| line-strong / control-border      | #858585 | #707070 | Limites de controles; mínimo medido 4,21:1 |
| text-primary                      | #f2f2f2 | #1c1c1c | Conteúdo principal                         |
| text-secondary / tertiary         | #ababab | #616161 | Metadados; mínimo medido 5,53:1            |
| accent / focus-ring               | #a3c4ff | #245aaa | Ação primária, seleção e foco              |
| success                           | #aad6b7 | #28663d | Confirmação acompanhada de texto/ícone     |
| danger                            | #ffb4b4 | #ae2929 | Erro/destruição com texto/ícone            |

Hover mistura 5% de text-primary na superfície; seleção, 8%; accent-soft, 12% de accent. warning deriva de text-primary e sempre tem texto/ícone. Os componentes referenciam variáveis, nunca repetem esses valores de cor. Contraste medido e limites: `contrast-redesign-9a.json`.

| Papel tipográfico  | Token                           | Tamanho base     |
| ------------------ | ------------------------------- | ---------------- |
| Overline / caption | type-overline / type-caption    | 12 px            |
| Label              | type-label                      | 13 px            |
| Auxiliar / callout | type-body-sm / type-callout     | 14 px            |
| Corpo              | type-body                       | 16 px; linha 1,6 |
| Headline           | type-title3 / type-headline     | 18 px            |
| Title 2            | type-title2 / type-title        | 24 px            |
| Title 1            | type-title1                     | 32 px            |
| Display            | type-display / type-large-title | 32–40 px         |

Valores em rem permitem ampliação de texto. Pesos 400/500/600; tracking do título −0,045 em. Largura de conteúdo 78 rem (1248 px na base), leitura 42 rem (672 px). Desktop usa respiro horizontal de 32–48 px; compacto conserva uma coluna de leitura. Tabelas e Kanban têm regiões de rolagem identificadas, sem overflow da página.

Primitives: links no Dock, input/form em Seek, Radix Popover + combobox/listbox em SelectMenu, portal e região anunciada em feedback, Radix Dialog em sheets/confirmações. O mesmo DatePicker usa apresentação ancorada ou sheet conforme largura. Formulários secundários podem conservar controles nativos; não trocar sem preservar teclado, rótulos e validação.

Evitar painéis aninhados e sombras em linhas de lista. Uma única sombra semântica serve às superfícies flutuantes; conteúdo fica em canvas/surface com divisores. Reserve elevação para navegação, controle transitório ou agrupamento que realmente precise dela.

## Interações

Seek abre imediatamente um campo utilizável, com recorte de 240 ms. Enter encaminha o texto à command palette existente; Ctrl/Cmd+K mantém seu fluxo. Escape recolhe e preserva o rascunho. Não existe um segundo parser ou mecanismo de captura.

Feedback passageiro dura 8 segundos, pausando com foco, mouse ou documento oculto. Erros ficam disponíveis até resolução. A duração visual não altera os registros de desfazer no repository. Toasts ficam à direita em desktop e acima do dock em mobile.

## Dependências e referências

Dock adaptado ao React Router e Framer Motion já instalados. O exemplo fornecido usa `motion`, `clsx` e `tailwind-merge`; não precisamos acrescentar esses pacotes para construir a mesma interação. Coss usa Base UI: adotar o kit completo duplicaria Radix e os controles existentes. A análise da CLI/componentes resulta em aproveitar a referência de interação, sem instalar o kit. Não há fontes ou imagens externas.

Referências HIG consultadas: design-principles, accessibility, layout, typography, color, materials, liquid-glass, motion, feedback, keyboards, sheets, alerts, popovers, tab-bars, toolbars, pickers e cross-platform. Referência Seek observada no navegador. O portfólio local 4173 estava indisponível nesta execução.
