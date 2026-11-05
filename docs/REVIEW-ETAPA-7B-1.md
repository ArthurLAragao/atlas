# Revisão apple-design — etapa 7B.1

Produto web React, com tradução dos fundamentos HIG conforme `references/cross-platform.md`. Ordem: acessibilidade, plataforma, craft, interação e conteúdo. Estudos prioriza o próximo compromisso, listas de disciplinas e pequenos próximos passos de trilhas. Conteúdo sólido, largura de leitura limitada e detalhes sob demanda mantêm a linguagem editorial do Atlas.

## Achados corrigidos

- **[Alto] O quê:** abrir uma sheet deixava foco no botão de fechar; gravação lenta podia navegar após Escape. **Por quê:** `accessibility.md > Speech`: “Let people use the keyboard alone to navigate and interact with your app.” **Correção:** foco inicial no primeiro campo e guarda de componente ativo antes de callbacks de navegação, fechamento e remoção. Radix contém foco e Escape retorna ao acionador; salvar/remover/restaurar leva ao título correspondente.
- **[Alto] O quê:** faltas excedidas eram indicadas apenas por ícone e cor. **Por quê:** `accessibility.md > Vision`: “Convey information with more than color alone.” **Correção:** texto explícito “Limite de faltas excedido”, contagem/limite e ícone. Identificação de disciplina usa cor semântica e nome textual.
- **[Médio] O quê:** edição de avaliação/etapa podia mover o item para o final; observação e descrição aceitavam mais caracteres que o modelo. **Por quê:** `text-fields.md > Best practices`: “Validate fields when it makes sense.” **Correção:** preservar posição e ID; alinhar limites e explicar como corrigir nota, máximo, peso, URL e data. Texto permanece no formulário após falha.
- **[Alto] O quê:** remover falta ou item interno precisava de desfazer persistente; vínculos recebidos/embutidos não tinham ação de desvincular visível. **Por quê:** `undo-and-redo.md > Best practices`: “Show the results of an undo or redo.” **Correção:** deltas transacionais, proteção contra conflitos, história de Estudos compatível com Metas e links recíprocos/embutidos removíveis. Desfazer abre o registro recuperado. Exclusão de tarefa/nota vinculada mantém a proteção existente contra referência órfã.

## Evidências

Validação final em 2026-10-03: `lint`, `typecheck` e `build` concluídos sem erros; **675 testes unitários em 38 arquivos** e **57 testes e2e** passaram. A regressão completa usou o build estável em `127.0.0.1:4180`; o primeiro run anterior atingiu 404 durante reconstrução concorrente e foi substituído por esta execução completa, sem reconstruir durante os testes.

- Browser em contextos descartáveis: criar disciplina, avaliação, falta, entrega com tarefa; criar trilha, etapa, concluir; vincular tarefa/nota; arquivar/excluir/desfazer após refresh; exportar, limpar e reimportar JSON e Markdown com comparação integral.
- Axe WCAG A/AA sem violações nas telas e formulários; teclado, foco e Escape exercitados. Controles auditados com alvo mínimo 44 px.
- 375/768/1280 px, claro e escuro; texto a 200% com reflow e sem overflow; reduced motion, fallback opaco de transparência e conteúdo sem blur. 18 screenshots em `docs/screenshots/etapa-7b1-*`.
- Contraste calculado a partir dos tokens reais: texto secundário contra bg/surface/elevated mínimo **6,59:1 escuro / 5,53:1 claro**; texto principal mínimo **13,52:1 / 15,22:1**. Destaque/links acima de AA em ambos os temas. Cores de identificação não carregam informação exclusiva.
- A rota é carregada sob demanda; listas acima de 200 registros usam virtualização com setas/Home/End. Nenhuma mudança em métricas de sucesso de metas.

Avaliação: **Boa**, sem achados críticos pendentes nas verificações executadas. A utilidade calma e a hierarquia de leitura são intencionais. Leitor de tela real e Lighthouse não foram medidos; testes automáticos não substituem essa avaliação manual.
