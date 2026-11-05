# Regras do projeto Atlas

## Design
Siga a skill apple-design (SKILL.md). Antes de decidir qualquer UI, carregue os arquivos relevantes em references/hig/ via references/hig-lookup.md.

## Código
- TypeScript estrito, sem any. Componentes pequenos, lógica pura em src/lib com testes.
- Use apenas tokens de design (CSS variables). Nunca cores ou espaçamentos soltos.
- Textos de interface em português do Brasil.

## Fluxo
- Antes de commitar: npm run lint, npm run typecheck, npm run test e npm run build.
- Commits no padrão Conventional Commits, um por etapa.
- Decisões importantes em docs/DECISIONS.md.
