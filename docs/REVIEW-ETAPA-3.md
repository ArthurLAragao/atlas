# Revisão — etapa 3: hábitos e heatmap

## Resumo

Avaliação apple-design: **Good** no escopo desta etapa. A tela serve para registrar o dia e reconhecer constância sem exigir configuração. O histórico é o elemento de assinatura; listas, números e ações têm hierarquia discreta. Aplicação web React: os fundamentos do HIG orientam o desenho, sem reproduzir convenções de menus nativos.

Referências roteadas por `references/hig-lookup.md`: accessibility, layout, typography, color, designing-for-macos, charts, charting-data, motion, sheets, text-fields, buttons, toggles, lists-and-tables, undo-and-redo e cross-platform; materiais e glass previamente consultados no mesmo fluxo. A auditoria integral de todas as features continua na etapa 9.

## Acessibilidade — achados corrigidos

### Critical — gráfico precisa de interação e leitura equivalentes

- **O quê:** quadrados pequenos, uma parada de Tab por dia e informações apenas na cor dificultariam o uso por teclado, toque e leitores de tela.
- **Por quê:** `charts.md > Best practices`: “Make every chart in your app accessible.” `accessibility.md > Vision` pede alternativas à cor; `charts.md > Enhancing the accessibility of a chart` pede contexto e valores em rótulos.
- **Correção:** alvos de 44×44 px, foco único no gráfico, setas para dias/semanas, Home/End e Enter. ARIA inclui data extensa e valor/descanso. Check e traço diferenciam conclusão/descanso. A tabela textual oferece os mesmos dias e edição, paginados em 28 linhas. Datas futuras não podem receber registros.

### High — formulários e navegação de sheets

- **O quê:** nomes de campos longos poderiam incorporar ajuda/opções; o foco precisava retornar ao quadrado ou botão que abriu a sheet.
- **Por quê:** `text-fields.md > Best practices`: “Ensure that tabbing between multiple fields flows as people expect.” `sheets.md > Best practices` pede saída além de concluir.
- **Correção:** nomes explícitos em selects; ajuda por aria-describedby nos campos, sem aumentar o nome. Radix Dialog com foco contido, Cancelar, Escape e retorno ao controle anterior; fallback para Novo hábito quando o controle foi excluído. Fonte a 200% preserva o formulário rolável e as ações.

Contrastes calculados a partir dos tokens reais: texto secundário escuro na superfície elevada **6,59:1**, claro na superfície **5,53:1**; botão principal escuro **10,44:1**, claro **6,45:1**; bordas de controles escuros **4,62:1** e claros **4,42:1**. Axe WCAG A/AA sem violações nos cenários verificados.

### Critical — contraste durante animação de entrada

- **O quê:** o fade inicial também reduzia a opacidade dos rótulos; axe detectou contraste transitório de 3,66:1.
- **Por quê:** `accessibility.md > Vision` exige contraste suficiente e `motion.md > Best practices` não permite sacrificar informação por movimento.
- **Correção:** rótulos e legenda ficam totalmente opacos desde o primeiro quadro. Só as marcas recebem uma animação breve de escala, dentro dos alvos fixos de 44 px. Reduced motion desativa a entrada e o feedback de mola.

## Plataforma e craft — achados corrigidos

### Medium — eixo do gráfico em telas estreitas

- **O quê:** ao mostrar a semana recente no celular, os nomes dos dias saíam da área visível durante a rolagem horizontal.
- **Por quê:** `charts.md > Axes` e `Best practices` pedem contexto para interpretar as marcas; `layout.md > Adaptability` preserva função entre larguras.
- **Correção:** eixo dos dias sticky à esquerda, com fundo sólido cobrindo toda a linha de 44 px. Rolagem fica no gráfico, sem transbordamento global. Hover/foco abre tooltip; toque e Enter abrem edição.

### Medium — intensidade e dados reais

- **O quê:** somar litros, horas e minutos produziria um número sem significado; um check antes de 100% confundiria progresso com conclusão.
- **Por quê:** clareza de escalas em `charting-data.md` e `charts.md > Descriptive content`.
- **Correção:** geral usa contribuições relativas a cada alvo, limitadas a 100%, e exclui descansos do denominador. Nível 4 só aparece a partir de 100%. Legenda “Sem progresso” também cobre registro de zero. O seed permanece com seis sugestões e um único registro real de exemplo, sem histórico decorativo inventado.

### Low — textos de sequência e descanso

- **O quê:** “1 dias” e “0/0” em uma semana inteira de descanso prejudicavam a precisão do texto.
- **Por quê:** clareza de conteúdo e contexto do gráfico, seguindo `charts.md > Descriptive content`; escolha de redação é julgamento de produto.
- **Correção:** singular em dia/semana, texto “Semana de descanso” e distinção entre sequências diárias e semanais. Alteração de alvo/frequência informa que o histórico será recalculado.

## Interação — achados corrigidos

### High — exclusão, concorrência e recuperação

- **O quê:** excluir hábito sem seus registros deixaria órfãos; sobrescrever um registro do mesmo dia com novo ID perderia metadados; uma falha poderia aparentar sucesso.
- **Por quê:** agência e recuperação em `undo-and-redo.md > Best practices`; `feedback.md` consultado na base orienta feedback acessível.
- **Correção:** transações verificam vínculos, removem hábito+logs juntos e guardam o delta da última exclusão. Undo preserva edições posteriores e funciona após reload. Upsert por hábito/data preserva ID, criação, tags e links. UI otimista volta ao estado anterior em caso de erro, com instrução acionável; toast oferece Desfazer e a ação persiste na tela.

### Medium — movimento e materiais

- **O quê:** entrada do gráfico e feedback do check precisavam respeitar preferências de acessibilidade sem adiar ações.
- **Por quê:** `motion.md > Best practices`: “Make motion optional.” `liquid-glass.md` reserva materiais para a camada funcional.
- **Correção:** entrada de 180 ms por escala nas marcas e mola breve nos checks com Framer Motion, desativadas por reduced motion. Conteúdo e histórico opacos, glass apenas no cabeçalho da sheet; fallback sólido já existente para reduced transparency/manual.

## Verificações

- Etapa 2 revalidada: lint/typecheck/test/build passaram; 38 testes anteriores aprovados; commit `b5be769` confirmado antes da implementação.
- Ida e volta JSON e Markdown: teste em IndexedDB isolado compara todos os campos dos seis tipos, limpa inclusive meta, importa e reabre sem recriar exemplos. Teste adicional no IndexedDB real do Edge usa contexto explicitamente descartável com storageState vazio e compara 15 registros, incluindo subtarefas, repetição, foco, acentos, links e descanso após limpar todas as tabelas e recarregar. Nenhum perfil pessoal do navegador é usado.
- 99 testes unitários/integração aprovados. Incluem 39 testes puros: calendário local, datas inválidas, ano bissexto, virada de ano, semanas de segunda a domingo, futuro, cinco intensidades, metas parciais, descanso, quebra e tolerância do período atual. Repositories e stores cobrem concorrência, proteção de exemplos editados, rollback e undo durável.
- 12 E2E em produção com Edge: regressões de rotas, temas e dados; cinco fluxos de hábitos; duas restaurações completas JSON/Markdown. CRUD, vírgula decimal, descanso, persistência, exclusão/undo exato, teclado, foco, tooltip, texto alternativo, 375/768/1280 px, claro/escuro, texto 200%, reduced motion e transparência sólida.
- 210 hábitos testados: lista renderiza apenas a janela virtual e Home/End permite alcançar o primeiro/último item pelo teclado. Lookup de registros no heatmap é indexado por dia.
- Lint, typecheck e build limpos, sem warnings. Feature carregada por rota: aproximadamente 210 kB de JS (66 kB gzip); chunk principal aproximadamente 366 kB. Limite de warning preservado.
- Capturas `docs/screenshots/etapa-3-*` revisadas. Regressões agora escrevem em test-results, preservando as capturas históricas das etapas 1 e 2.

## Limites

Esta etapa não mede Lighthouse nem substitui ensaio manual com leitor de tela. Não houve teste de carga no limite de 50 mil logs/10 mil hábitos. Desfazer recupera a última exclusão; múltiplas operações e redo são evolução futura. Alvo/frequência não têm versionamento histórico. Backup de conteúdo não inclui preferências nem metadados de undo. A camada de dados funciona com a página carregada sem rede; instalação e recarga offline permanecem na etapa 8.
