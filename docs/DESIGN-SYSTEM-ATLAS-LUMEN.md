# Atlas e Lumen — linguagem visual compartilhada

## Direção vigente — novos prompts de 03/11/2026

O prompt do Atlas anexo e o prompt Lumen na conversa substituem a paleta anterior.
Atlas usa preto/navy nos quadros, com tokens restritos a `#main` em
`src/styles/premium-panels.css`. Sua navegação inferior, toolbar, arquivos do dock
e tokens globais não foram alterados nesta etapa. A comparação automatizada
confirmou geometria, borda, cores e espaçamento do dock iguais com e sem os
estilos de conteúdo.

Lumen usa carvão `#12151B`, superfície `#191E27` e azul `#60A5FA`, também aplicados
ao tema Tk existente. O novo frontend React fica em `Lumen/frontend`, com cinco
telas, tokens semânticos, temas claro/escuro/sistema e adaptador mock isolado.
O modo de demonstração é sempre identificado. A camada Python operacional é
preservada; não foram adicionadas APIs reais à nova interface.

HIG consultado nesta etapa: accessibility > Vision e Mobility; layout > Visual
hierarchy; typography; color; designing-for-macos; dark-mode; materials; buttons
> Style; progress-indicators > Best practices; cross-platform. Aplicamos os
princípios à web, sem impor menus do macOS. A exceção explícita do usuário
prevalece sobre qualquer recomendação de sidebar no Atlas.

Registro abaixo descreve a etapa visual anterior.

## Direção aprovada pelo usuário

Ferramentas pessoais para organizar, aprender e agir: preto profundo, azul escuro
e neon contido. A cor destaca ações e progresso; textos e estados permanecem
legíveis sem depender apenas de cor. O conteúdo determina a hierarquia.

Paleta: fundo `#030507`, superfície `#090E16`, superfície elevada `#111B29`,
ação `#5AABFF`, texto `#F5F5F2`, texto secundário `#A6A6A0`.
Web usa tokens CSS; desktop usa `styles.py`. Tipografia de sistema sem downloads:
Segoe UI no Windows, com hierarquia entre título, seção, leitura e ajuda.

## Decisões de uso

- Uma janela principal no Lumen: Capturar, Biblioteca, Arquivos e Contexto.
- YAML e comandos ficam fora da leitura comum; detalhes técnicos são opcionais.
- A dashboard diferencia o ritmo pessoal dos dados de exemplo.
- Checklists têm espaço para o nome da tarefa no celular; controles permanecem acessíveis.
- Ações de ambiente ficam agrupadas e não dependem de estilos de outra rota.
- Rascunho diário tem local de armazenamento e confirmação de gravação explícitos.
- Nenhuma nova fonte remota ou animação contínua foi introduzida.

## Skills aplicadas

- Anthropic frontend-design: direção intencional, restrição visual e linguagem orientada à ação.
  https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Vercel web-design-guidelines: formulários identificados, teclado, contraste, conteúdo longo e responsividade.
  https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- Vercel react-best-practices: componentes delimitados e reutilização dos fluxos e stores existentes.
  https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- UI/UX Pro Max: prioridades de acessibilidade, toque, hierarquia e consistência.
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Foram executadas duas consultas ao catálogo UI/UX Pro Max. A primeira sugeriu uma
paleta clara/teal e a segunda uma landing page de FAQ, que não correspondem a esta
dashboard. Não houve correspondência verificável de produto no catálogo; as
decisões específicas usam o pedido do usuário e as regras gerais como fallback.
As recomendações de catálogo não substituem a identidade solicitada.

Também foram aplicadas as referências HIG da skill apple-design do projeto:
layout (hierarquia e divulgação progressiva), color/accessibility (legibilidade),
sidebars e generative-ai (controle e identificação de conteúdo gerado).
