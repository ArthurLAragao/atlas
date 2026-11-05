# Design review: Atlas — experiência diária

## Resumo

Revisão com a skill apple-design em 2026-10-03, na ordem acessibilidade, plataforma, acabamento, interação e conteúdo. Resultado: **Good**. O Atlas continua um caderno editorial de ações e progresso, com heatmap como assinatura. Preferências e instalação entram como opções secundárias; Hoje conserva cinco widgets iniciais, sem um painel congestionado.

Referências roteadas por hig-lookup: accessibility, layout, typography, color, designing-for-macos, cross-platform, settings, drag-and-drop, app-icons, motion, alerts e liquid-glass. Princípios traduzidos para React/web; não simulamos menu de aplicativo nativo. Escolhas explícitas de tema/movimento/transparência prevalecem sobre a recomendação de evitar controles redundantes do sistema, conforme o escopo solicitado.

## Acessibilidade — correções aplicadas

- **[High] O quê:** o estado inicial usava `<main role="status">`, substituindo o landmark principal enquanto o IndexedDB abria. Lighthouse detectou landmark-one-main nessa fase.
  **Por quê:** `accessibility.md > Vision` exige uma interface descrita para leitura assistiva; na web, a região principal e um anúncio de status têm funções diferentes.
  **Correção:** `<main>` conserva sua semântica e contém um `<p role="status">`. Teste de regressão exige ambas as regiões. A medição final aguarda a rota carregada; a primeira coleta, limitada à abertura, permanece em `lighthouse-startup-before.json` para evidência do achado.
- **[High] O quê:** o audit experimental de nome visível encontrou metadados dentro de botões omitidos no nome acessível, e “Adiar para amanhã” interrompido pelo título no aria-label. Isso dificulta comandos de voz pelo texto da tela.
  **Por quê:** WCAG 2.5.3, Label in Name, e `accessibility.md > Vision` orientam uma interface descrita de forma consistente. A detecção específica vem do Axe/Lighthouse, não de uma regra inventada do HIG.
  **Correção:** metadados adjacentes aos botões, associados por aria-describedby; botões conservam título e 44 px. Nome de adiar inclui “Adiar para amanhã” por inteiro, seguido da tarefa. Teste de browser ativa a regra experimental explicitamente, além das regras AA já existentes.
- **[High] O quê:** reordenar só por arraste excluiria usuários de teclado e esconderia a ordem real dos widgets.
  **Por quê:** `drag-and-drop.md > Best practices`: “Offer alternative ways to accomplish drag-and-drop actions.” `accessibility.md > Mobility` orienta acesso por teclado.
  **Correção:** botões nomeados Mover para cima/baixo, limites desabilitados, anúncio de posição e foco no título do widget. O DOM é renderizado na ordem persistida; nenhuma ordenação apenas visual. Teste de Enter, recarga, ocultação e reset aprovado.
- **[Medium] O quê:** movimento e transparência precisavam obedecer à escolha explícita e explicar seus efeitos também para leitura assistiva.
  **Por quê:** `motion.md > Best practices`: “Make motion optional.” `liquid-glass.md > Review checklist`, item Accessibility states, exige fallback opaco e redução de animação.
  **Correção:** modelo normalizado com system/reduce/allow, migração do antigo solid, datasets e hook compartilhado de Framer Motion. Descrições associadas por aria-describedby. Testes emulam as duas preferências do sistema, verificam backdrop-filter e escolhas explícitas; alto contraste mantém superfície sólida.
- **[High] O quê:** limpar todo o conteúdo é irreversível; uma ativação acidental não pode apagá-lo.
  **Por quê:** `alerts.md > Best practices` distingue ações comuns com undo de destruição incomum sem undo.
  **Correção:** confirmação em sheet com APAGAR TUDO, ciência da perda e foco inicial em Manter meus dados; Escape devolve foco. Transação limpa conteúdo e XP sem recriar exemplos; backup e reimportação restauram o conteúdo.

## Plataforma e interação — correções aplicadas

- **[Medium] O quê:** import da primeira rota após abertura dos dados e precache concorrente atrasavam Hoje; o rodapé saltava quando o fallback era substituído.
  **Por quê:** feedback rápido e continuidade espacial; `layout.md > Visual hierarchy` orienta ordem visual previsível. O diagnóstico de rede/renderização é técnico, medido no Lighthouse.
  **Correção:** import de Hoje em paralelo ao IndexedDB no endereço inicial, SW somente após a primeira tela e período ocioso, rodapé oculto durante o fallback da rota. Code splitting e repositories permanecem. Coleta anterior em `lighthouse-before-loading-optimization.json`; métricas finais no relatório de verificação.
- **[Medium] O quê:** rolar durante o arraste podia colocar origem e destino na mesma coordenada vertical da janela, cancelando um gesto válido.
  **Por quê:** a expectativa é mover o item até o destino, independentemente da rolagem; julgamento de interação, consistente com `drag-and-drop.md > Best practices`.
  **Correção:** Pointer Events guardam que o gesto já começou, capturam o ponteiro e identificam o destino ao soltar. Indicação visível na origem. Browser test executa o gesto real com rolagem e verifica a ordem e o estado vazio após esconder todos.
- **[Medium] O quê:** uma atualização automática pode interromper edição; um alerta modal de desconexão atrapalharia o app local.
  **Por quê:** `alerts.md > Best practices`: “Avoid showing an alert when your app starts.” `settings.md > Task-specific options` favorece escolhas no contexto afetado.
  **Correção:** faixa sólida e discreta com Atualizar/Agora não; worker espera consentimento. Aviso offline com texto/ícone mantém ações disponíveis. Teste troca duas versões reais, recusa primeiro, aceita depois e verifica dados intactos.

## Acabamento e conteúdo

- **[Medium] O quê:** aplicar vidro à faixa de atualização colocaria material translúcido no conteúdo.
  **Por quê:** `liquid-glass.md > Review checklist`, Layer discipline, restringe vidro à navegação e controles flutuantes.
  **Correção:** faixa com superfície sólida. Editor, listas, campos e resumo de XP continuam opacos; vidro fica na navegação e camadas funcionais.
- **[Low] O quê:** “instalado” ou “offline” sem condição validada criaria uma promessa imprecisa.
  **Por quê:** clareza de conteúdo e controle do usuário; julgamento de produto.
  **Correção:** mensagem de preparação somente após worker pronto; prompt de instalação somente quando oferecido pelo navegador e fallback com instruções. README distingue preparação, instalabilidade e instalação física. Falhas indicam como reconectar/permitir armazenamento/tentar novamente.

## Evidências

- Capturas de Hoje e Preferências: 375/768/1280 px, claro/escuro, em `screenshots/etapa-8-*`. Inspeção visual confirma uma coluna legível, campos sem overflow, hierarquia e ausência de cards repetidos. Seis áreas principais continuam na navegação; Preferências fica no rodapé e menu Aparência.
- Texto a 200% em todas as larguras/temas de Preferências e na regressão de Hoje. Axe WCAG A/AA sem violações nesses fluxos. Alvos de widgets e campos medidos com pelo menos 44×44 px. Sheets testam foco inicial, Escape e retorno ao acionador.
- `contrast-stage8.json`: 90 combinações de tokens em três superfícies, dois temas e três accents. Menor contraste textual 5,53:1; menor contraste de borda de controle 4,10:1. O cálculo cobre tokens, não toda composição possível; Axe complementa as telas.
- Recarga offline real após preparação online, navegação nas sete rotas, nota criada offline, backup comparado e persistência após reconectar. `pwa-installability.json` registra nenhum erro no Edge em perfil temporário não anônimo. Nenhuma permissão de notificação foi solicitada.
- Resultados finais de lint, typecheck, unitários, build, browser e Lighthouse ficam em `VERIFICATION-ETAPA-8.md` e nos relatórios reais vinculados ali.

## O que preservar

Listas e divisórias expressam grupos reais; títulos e espaços carregam a hierarquia. Widgets opcionais dão próximo passo concreto de Estudos/Foco, em vez de números isolados. XP fica discreto e ocultável, sem punições, ranking ou influência no domínio. A marca de instalação é uma bússola monocromática de bordas claras, gerada localmente; `app-icons.md > Layer design` recomenda bordas definidas, e `Icon shape` orienta base quadrada sem máscara prévia.

## Limites

**[High] Desempenho de primeira abertura pendente.** Lighthouse mobile registrou 67 no primeiro acesso, embora a acessibilidade esteja em 100 e não haja deslocamento de layout. O cenário de retorno foi medido separadamente e chegou a 100. O que corrigir: reduzir o carregamento inicial de JavaScript e confirmar o ganho em novo perfil com a mesma metodologia, na etapa 9. A latência local variou nas coletas; isso é uma limitação da interpretação, não justificativa para declarar a meta atingida. Os relatórios anteriores e finais permanecem disponíveis.

Não houve teste com VoiceOver/NVDA, Switch Control ou dispositivo físico; Axe e foco DOM não substituem essas verificações. Instalação no sistema operacional, Safari/iOS e arraste em tela física permanecem pendentes. Layouts foram emulados no Edge. A auditoria integral de todas as telas permanece a etapa 9; esta revisão cobre a experiência adicionada e suas regressões.
