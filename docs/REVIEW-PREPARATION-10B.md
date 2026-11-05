# Preparação 10B — fechamento local e plano de staging

Baseline `04988d0`, inicialmente limpo. Sem publicação, push, tag, release, mudança de visibilidade, projeto/conta remotos ou migração de dados pessoais. Consultas somente a fontes públicas para procedência/licenças/configuração; nenhum conteúdo do projeto enviado.

## Resolvido nesta preparação

- Hoje usa `profile.name` existente, com trim e saudação neutra para perfil ausente/vazio. Atualiza ao receber snapshot novo; React renderiza como texto. Placeholder de perfil fictício. Sem CSS/composição/modelos/animações novos.
- Quatro unitários novos, um browser e asserção adicional no teste existente de Perfil. Nenhum teste retirado/enfraquecido.
- Dock corresponde à família beUI pública/MIT; copyright/permissão acompanham o artefato. LICENSE de React/React DOM, Framer Motion, Radix e Lucide inspecionados e incluídos integralmente, inclusive avisos Feather. Não é licença do Atlas nem auditoria completa de todas as transitivas.
- [96 candidatos textuais classificados](DISCLOSURE-PLAN.md): dois públicos corrigidos, cinco anonimização, 85 locais, quatro decisões do titular. Nenhum valor pessoal reproduzido, arquivo apagado ou história reescrita. Classificação conservadora não significa OCR/revisão humana integral.
- [Plano de staging](STAGING-PLAN.md) e configuração específica **inativa em docs**, com exclusões do fallback, cache/headers justificados e matriz hospedada. 19 casos locais de regex e aviso copiado para dist; não valida Vercel.

## Arquivos alterados

Código: src/features/today/TodayPage.tsx, TodayPage.test.tsx; src/features/profile/ProfileForm.tsx e ProfileForm.test.tsx; src/components/ui/dock.tsx (comentário de procedência). Browser: e2e/preparation10b.spec.ts.

Entrega: public/third-party-notices.txt; scripts/capture-delivery.mjs (descrição do recorte histórico) e verify-staging-plan.mjs; README, CHANGELOG, .gitignore, docs/DECISIONS, TODO, RELEASE-CHECKLIST e REPOSITORY-REVIEW-10A.

Novos documentos/evidências: COMPONENT-PROVENANCE.md, DISCLOSURE-PLAN.md, STAGING-PLAN.md, staging-vercel.example.json, disclosure-review-pre10b.json, staging-plan-check-pre10b.json, checks-pre10b.json e este relatório. Capturas antigas, modelos, backup, dependências, Vite/Workbox e estilos foram conservados.

## Checks

Lint/typecheck/build passaram; **847 unitários / 69 arquivos**, 241,42 s. Fluxo novo de browser passou em 375 px, incluindo nome fictício, persistência F5, retirada do nome, overflow e Axe. **106 E2E passaram**, incluindo os 105 anteriores, em 9,7 min reportados. Backup, offline, recursos lazy e atualização entre workers continuam aprovados em automação local. Resumo em [checks-pre10b.json](checks-pre10b.json). Todas as evidências brutas novas usam prefixo local ignorado, separado das capturas de apresentação.

Não houve Lighthouse, instalação física, NVDA, dispositivo móvel ou URL hospedada nesta tarefa. A medição de referência continua **9C: frio 86, retorno 99**, meta >= 90 não atingida. Staging restrito pode ajudar a executar validações sem aceitar a performance ou aprovar release definitiva.

## Restantes / decisões humanas

1. Licença do Atlas e atribuição do titular: opções e consequências em COMPONENT-PROVENANCE; nenhuma escolhida.
2. Manter ou generalizar créditos/contextos intencionais do runtime; autorizar cópias anonimizadas de fixtures/evidências se necessário. Repositório continua com história bruta, não aprovado automaticamente para público.
3. Conta/equipe, projeto, origem estável, acesso/proteção e dispositivos disponíveis para staging. URL/conta inexistentes não são apresentados como ativos.
4. Revisão exata/cadeia do snippet recebido não fornecidas; fonte compatível e MIT atual verificadas. Se exigir cadeia exata, obter revisão ou autorizar substituição independente equivalente. Outras referências visuais não são autorização para copiar código/arte; ObsidianUI não acessível nesta verificação.
5. Validação HTTPS/host e checklist humano/performance antes de release definitiva. Nenhum aceite presumido; não transformar resultados automatizados em observação humana.

## Destino e autorização futura

Proposta: Vercel Preview isolado/protegido, pacote estático dist revisado e configuração específica, sem integração Git inicialmente. Conta/projeto/proteção/alias estável dependem de decisão. Servidor não recebe banco, rascunhos, backups, .git ou docs brutos; cliente compilado continua inspecionável.

Autorizações necessárias estão enumeradas no STAGING-PLAN: criar/link projeto, configurar proteção, upload de artefato para Preview, alias estável e segunda revisão A/B/rollback. Não incluem push, público, produção, tag/release. Salvar/exportar JSON antes de troca voluntária de origem; testes hospedados somente com dados fictícios.

**Parecer:** preparação revisável entregue; aguardar autorização externa específica. Não há aprovação de release definitiva. Commit local será informado por hash real no fechamento, sem embutir o próprio hash no arquivo que o gera.
