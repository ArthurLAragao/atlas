# Etapa 8 — experiência diária

1. Preferências e Hoje: manter repositories e módulos atuais; rota secundária `/preferencias`, escolhas normalizadas no armazenamento existente, política explícita de movimento/transparência, organização dos nove widgets com DOM na ordem salva, arraste e ações de teclado. Limpeza completa em transação com confirmação forte, sem recriar exemplos.
2. XP discreto: eventos persistentes e idempotentes na camada de dados, sem efeitos em métricas de domínio; resumo ocultável e testes de cálculo/deduplicação.
3. PWA: vite-plugin-pwa, ícones vetoriais locais rasterizados, precache de todos os chunks/estáticos, atualização com consentimento, aviso offline e instalação contextual. Testar primeiro acesso online, recarga/navegação offline e persistência; atualização em dois builds isolados. Executar Lighthouse e salvar relatório real se possível.

Cada bloco recebe testes, lint, typecheck, build e commit Conventional Commits. A regressão e2e completa encerra a etapa. Referências HIG via lookup: accessibility, layout, typography, color, settings, drag-and-drop, app-icons, motion, alerts, liquid-glass e fundamentos já usados. Tokens existentes; conteúdo sólido e navegação translúcida. Idioma permanece pt-BR. Lembretes futuros precisam de pedido contextual e explícito; nenhuma permissão ou notificação nesta etapa.
