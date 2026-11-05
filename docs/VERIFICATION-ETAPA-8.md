# Verificação da etapa 8 — 2026-10-03

## Resultado

Funcionalidades entregues: Preferências persistentes, organização de nove widgets, XP discreto, instalação contextual, manifest/ícones locais, precache de todas as rotas, recarga offline e atualização por escolha. Não há permissões de notificação, push ou lembretes automáticos.

| Check             | Resultado final                                                     |
| ----------------- | ------------------------------------------------------------------- |
| npm run lint      | Aprovado, sem erros                                                 |
| npm run typecheck | Aprovado, TypeScript estrito                                        |
| npm run test      | 757 aprovados, 49 arquivos                                          |
| npm run build     | Aprovado, sem warnings do app; 64 entradas no precache, 1258,72 KiB |
| npm run test:e2e  | 76 aprovados, 6,5 minutos                                           |

Os testes anteriores foram preservados. A rodada final usa o mesmo build dos relatórios e das capturas. O runner de browser emite um aviso de ambiente NO_COLOR/FORCE_COLOR; não há erro de aplicação. Testes de Foco ganharam espera pela confirmação da transação antes de avançar fake timers; o seletor exato de Adiar acompanha a correção do nome acessível. As asserções originais e dados verificados foram mantidos.

## Fluxos de browser

1. Tema, movimento e transparência persistem após F5. Preferências do sistema e escolhas explícitas são emuladas; fallback opaco e alvos de 44×44 px são medidos.
2. Enter reordena widgets com anúncio/foco; ordem persiste no DOM após F5. Arraste real inclui rolagem. Ocultar, restaurar, desfazer organização e esconder todos mantêm estado útil.
3. Backup JSON, limpeza forte de banco e reimportação restauram registros. Testes anteriores também cobrem ida/volta completa em JSON/Markdown, relacionamentos, sessões, links internos e campos. XP tem testes de backup e deduplicação.
4. Primeiro acesso online aguarda SW pronto/controlador. Depois a rede é bloqueada, um fetch não cacheado precisa falhar, a página recarrega e navega nas sete rotas, inclusive rotas ainda não abertas. Uma nota é criada offline; todos os registros anteriores e XP são comparados no backup. Reconectar e recarregar mantém a nota.
5. Duas versões reais do SW: nova fica aguardando; Agora não não ativa; Verificar atualização reabre o aviso; F5 continua na versão antiga; Atualizar ativa a nova e mantém a nota salva.
6. Manifest tem nome/descrição/idioma/display/escopo/atalhos corretos; PNGs 192/512/maskable são validados. `pwa-installability.json` registra nenhum erro do Edge em perfil temporário não anônimo. Instalação no sistema operacional não foi executada.
7. Hoje e Preferências: 375/768/1280 px, temas claro/escuro, texto a 200%, foco/Escape, reduced motion/transparency e Axe AA. Regra experimental Label in Name foi ativada explicitamente. Todos os módulos anteriores passam novamente por sua cobertura de responsividade, teclado e persistência.

## Lighthouse real

Lighthouse 13.5.0 no preview de produção `http://127.0.0.1:4180/`, Edge headless, emulação mobile e throttling simulado padrão. Navegador e perfis são temporários, sem perfil pessoal. Nenhuma outra suíte estava em execução durante a medição.

| Cenário                                       | Desempenho | Acessibilidade | Boas práticas | SEO |
| --------------------------------------------- | ---------- | -------------- | ------------- | --- |
| Primeiro acesso, cache e IndexedDB vazios     | **67**     | **100**        | **100**       | 91  |
| Retorno após acesso online e preparação do SW | **100**    | **100**        | **100**       | 91  |

- Primeiro acesso: [JSON](lighthouse-stage8.report.json) e [HTML](lighthouse-stage8.report.html). FCP 3,1 s; LCP 5,4 s; Speed Index 8,6 s; CLS 0. A coleta inclui o texto de Hoje como LCP, sem se limitar ao estado inicial.
- Retorno: [JSON](lighthouse-stage8-return.report.json) e [HTML](lighthouse-stage8-return.report.html). Sem warnings; o resultado inclui dados/cache já preparados, e não representa o primeiro acesso.
- A **meta de desempenho acima de 90 no primeiro acesso não foi atingida**. Redução adicional de JavaScript/carregamento inicial fica explícita em TODO para a etapa 9. Não declaramos todos os critérios globais do MVP concluídos.
- Coletas exploratórias anteriores preservadas: `lighthouse-startup-before.json` (estado de abertura e erro de landmark), `lighthouse-before-loading-optimization.json`, `lighthouse-cli-cold-before.json` e `lighthouse-browser-startup-cold.json`. Houve variação de latência local e timeout de limpeza na coleta exploratória com espera adicional; isso não elimina o resultado abaixo da meta nas coletas finais sem warnings.
- SEO não é prioridade de um app pessoal offline. O preview devolve index.html para robots.txt inexistente; revisar hospedagem e comportamento dessas rotas na etapa 10. Não há alegação de resultados em produção.

Reproduzir com o preview ativo e o Edge instalado:

```sh
node scripts/audit-lighthouse.mjs --cold
node scripts/audit-lighthouse.mjs
```

O cenário frio espera 10 s em about:blank para o processo novo do Edge estabilizar, **sem visitar o Atlas**, e usa perfil vazio. O retorno visita o Atlas e aguarda SW pronto antes de auditar. Ambos evitam o timeout de limpeza do Edge com disableStorageReset em um perfil recém-criado, mantendo a distinção entre seus dados/cache. As categorias têm parâmetros padrão; a configuração limita apenas quais categorias executar.

## Design e limites

Revisão com O quê / Por quê / Correção em [REVIEW-ETAPA-8.md](REVIEW-ETAPA-8.md). Contraste real de 90 pares de tokens em [contrast-stage8.json](contrast-stage8.json): mínimo textual 5,53:1; controles 4,10:1. Doze capturas novas em `screenshots/etapa-8-*`.

Não houve instalação física, Safari/iOS, VoiceOver/NVDA ou teste de arraste em tela física. O build local está validado; deploy Vercel permanece etapa 10. Preferências e conteúdo são locais por origem/navegador; exporte antes de trocar endereço. Preferências, rascunhos e undo não entram no backup de conteúdo; XP entra.

## Commits

- `3b04598` — feat: adiciona preferências e widgets configuráveis no Hoje.
- `7acffb2` — feat: registra XP discreto sem alterar métricas do Atlas.
- Bloco final: PWA, auditoria, correções e evidências, em commit Conventional Commits; consulte `git log -3 --oneline`.
