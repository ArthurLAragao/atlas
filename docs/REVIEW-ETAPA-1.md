# Revisão de design — etapa 1

## Resumo
Base web React para uso pessoal em desktop, tablet e celular. Avaliação: **Good** no escopo implementado. Tese: reduzir escolhas de organização a seis espaços reconhecíveis, com hierarquia editorial e navegação discreta. A assinatura visual definitiva, o heatmap, será implementada na etapa 3.

A skill apple-design foi aplicada com os fundamentos do HIG, sem impor convenções nativas do macOS à web. Revisão de código complementar com react-best-practices: lazy imports por feature, lógica fora dos componentes, seletores de estado, sem memoização especulativa, HTML semântico e tipos estritos.

## Achados corrigidos

### Critical — texto ampliado sobrepunha a marca
- **O quê:** a barra superior não tinha espaço para marca e botão de aparência com texto a 200% em 375 px.
- **Por quê:** `layout.md › Adaptability`: “Be prepared for text-size changes.” O zoom não pode esconder conteúdo nem sobrepor controles.
- **Correção:** toolbar com quebra de linha e grupos de opção capazes de empilhar. Refeito o fluxo em Edge com texto a 200%; captura salva.

### High — rótulos no trilho recolhido
- **O quê:** o nome dos destinos dependia do texto escondido no modo recolhido.
- **Por quê:** `accessibility.md › Best practices`: controles precisam permanecer identificáveis para tecnologia assistiva; `tab-bars.md › Best practices`: “Include tab labels to help with navigation.”
- **Correção:** nome acessível explícito nos links, tooltip nativo e estado `aria-current`. Teste verifica o destino Hábitos no trilho recolhido.

### Medium — troca de rota e aparência
- **O quê:** navegar em uma SPA precisa comunicar o novo contexto; preferências bloqueadas pelo navegador não podem impedir a abertura.
- **Por quê:** `feedback.md › Best practices`: “Make sure all feedback is accessible.” `keyboards.md › Best practices`: “Support Full Keyboard Access when possible.”
- **Correção:** título do documento e foco no h1 por rota, recuperação de URL inexistente, Escape/restauração de foco no popover e aviso de armazenamento bloqueado. Coberto por testes.

## O que manter
- Conteúdo opaco; blur restrito à camada funcional. `liquid-glass.md › The two layers` distingue conteúdo e navegação. Fallback opaco por media query, contraste aumentado e preferência manual.
- Sem números fictícios ou botões que simulam cadastro. Os módulos informam que estão em construção e oferecem retorno para Hoje.
- Alvos de 44 px, ícones consistentes e foco destacado. Navegação inferior mantém seis destinos; no zoom, a faixa permite rolar e leva o link focado à área visível.
- Uma cor de destaque por vez; os três accents curados foram verificados com axe nos dois temas.

## Evidência
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`: aprovados. Testes unitários/integração: **12/12**. Build sem warnings.
- `npm run test:e2e`: **2/2** fluxos aprovados no Edge. Seis rotas, tema/sistema, reload/persistência, recolhimento, teclado, Escape, transparência e layouts em 375/768/1280 px.
- axe WCAG 2 A/AA e 2.1 AA: zero violações nos cenários examinados (páginas iniciais e opções de aparência nos seis pares tema/accent).
- `agent-browser`: servidor acessível, elementos e navegação presentes, sem erros registrados no navegador. Capturas em `docs/screenshots`.
- Contraste calculado pela luminância sRGB; cenário conservador das superfícies usadas: escuro sobre `#262626` — primário **13,52:1**, secundário **6,59:1**, azul **8,57:1**; claro sobre `#f2f2f2` — primário **15,22:1**, secundário **5,53:1**, azul **6,02:1**.

## Limites
Não é a auditoria final da etapa 9. Não foram medidos Lighthouse nem desempenho com grandes volumes. Não houve ensaio manual com leitor de tela. O offline completo e os módulos com conteúdo ainda não existem. O teste ampliado usa fonte raiz a 200%, não substitui todos os modos de zoom/tecnologias assistivas. O runner Playwright emitiu aviso de variáveis NO_COLOR/FORCE_COLOR herdadas do ambiente; não é warning do build da aplicação.
