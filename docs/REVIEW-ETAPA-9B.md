# Atlas — Auditoria integral 9B

Auditoria executada em 05–06/10/2026 sobre a direção visual aprovada em **`eb7c770`**, com Git inicialmente limpo. Não houve redesign, nova funcionalidade, publicação, deploy, instalação no perfil pessoal ou limpeza de dados do usuário. CSS, tokens, composição e parâmetros de movimento foram preservados.

**Parecer: não pronto para a etapa 10.** Os fluxos automatizados, integridade e PWA passaram, mas a mediana mobile fria é **87**, abaixo do critério ≥90. Instalação física e acessibilidade com leitores de tela humanos continuam pendentes. O próximo trabalho deve atacar os gargalos documentados e executar essas verificações, antes de autorizar publicação.

## Escopo e evidências

Inventário real e baseline: [AUDIT-9B-PLAN](AUDIT-9B-PLAN.md). Matriz dos nove módulos, achados por severidade, integridade e revisão Apple HIG: [QA-AUDIT-9B](QA-AUDIT-9B.md). Método, doze coletas Lighthouse e bundles: [PERFORMANCE-AUDIT-9B](PERFORMANCE-AUDIT-9B.md). Resultado estruturado dos scripts: [checks-9b.json](checks-9b.json).

Foram auditados Hoje/widgets/captura, as quatro visões de Tarefas, hábitos/logs/heatmaps, Markdown/links/backlinks/preview/importação, metas/projetos e seus vínculos, disciplinas/avaliações/faltas/eventos/trilhas/flashcards, timer, perfil/atividade/fixados e preferências/dados/PWA. Fixtures e contextos de browser são descartáveis; alterações destrutivas não foram executadas na aba do usuário.

## Bugs corrigidos

**Críticos:** editores obsoletos de tarefas, hábitos, perfil e quantidade de hábito podiam sobrescrever dados de outra aba; salvar perfil podia apagar pins feitos durante a edição. A versão/estado observado agora é comparado dentro da transação, timestamps relevantes avançam monotonamente e pins atuais são preservados. Conflito mantém o rascunho e oferece recuperação, sem fingir sucesso.

**Altos:** dois cliques de fixar em abas diferentes podiam desfazer a intenção; falha de leitura auxiliar de Desfazer revertia visualmente uma escrita confirmada; avatar processado assincronamente podia apagar nome/frase digitados enquanto abria. Comparação da intenção, isolamento da leitura auxiliar e atualização funcional do avatar corrigem os três casos.

Cada defeito relevante tem regressão unitária; os fluxos de concorrência também têm testes com duas abas reais. O teste de avatar segura a resolução do bitmap para reproduzir a perda. Falhas reais de escrita continuam produzindo rollback e mensagem recuperável.

**Médios pendentes:** arquivamento de hábitos não existe no modelo/UI atual — lacuna anterior, sem acrescentar recurso durante a auditoria. Desempenho frio abaixo da meta está reproduzido e não foi declarado aprovado. Não sobraram falhas críticas/altas reproduzidas nos cenários auditados; isso não equivale a provar ausência universal de bugs.

## Checks e acessibilidade

| Check               | Baseline                                        | Final                                                   |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `npm run lint`      | Passou                                          | Passou                                                  |
| `npm run typecheck` | Passou                                          | Passou                                                  |
| `npm run test`      | 825 / 64 arquivos, diagnóstico `--pool=threads` | **840 / 66 arquivos**, comando padrão, 249,93 s         |
| `npm run build`     | Passou                                          | Passou, sem avisos de build                             |
| `npm run test:e2e`  | 97 / 10,2 min                                   | **103 / 10,1 min**                                      |
| Axe/layout          | Suíte anterior                                  | **192 estados**, zero violações e overflow de documento |

Nenhum teste removido, pulado ou enfraquecido. Seis casos de browser foram adicionados; atualização do worker foi ampliada com rascunho e timer ativo. Dois timestamps exatos de tarefa passaram a exigir incremento monotônico, mantendo os demais campos. E2E históricos ganharam somente um prefixo opcional de evidência, além da ampliação mencionada.

A matriz inclui 375/768/1280/1440 px, temas claro/escuro, texto 100/200%, reduced motion e transparência reduzida. A suíte cobre diálogos/menus/captura/calendário, Escape, foco, touch targets e alternativas a hover/arraste. Contraste: **36 pares de tokens opacos**, mínimo textual **5,53:1**. Não se alegam inspeção humana de todos os blends, zoom nativo ou validação por VoiceOver/NVDA. Relatórios: [Axe](accessibility-9b.json), [contraste](contrast-9b.json).

Evidências selecionadas, sem modificar o visual aprovado:

![Hoje, 375 px, escuro, texto 200%](screenshots/audit-9b-hoje-375-dark-200.png)

![Tabela, 1440 px, claro, texto 200%](screenshots/audit-9b-tarefas-tabela-1440-light-200.png)

Screenshots baseline e final usam prefixos próprios. Os arquivos históricos regenerados pela primeira rodada foram copiados, verificados por hash e restaurados do commit aprovado somente depois da identificação individual; [manifesto de preservação](audit-9b-evidence-recovery.json). Não foi executado restore amplo de produto ou alterações do usuário.

## Performance medida

| Cenário           | Baseline: três runs / mediana | Final: três runs / mediana |
| ----------------- | ----------------------------- | -------------------------- |
| Mobile frio       | 80, 85, 86 / **85**           | 89, 87, 87 / **87**        |
| Retorno preparado | 99, 100, 100 / **100**        | 100, 100, 99 / **100**     |
| LCP frio mediano  | 3,482 s                       | **3,018 s**                |

Mesmo navegador/configuração/throttling, perfis novos, produção estável e sem suítes concorrentes. Conteúdo real de Hoje verificado no trace; nenhuma tela de espera foi usada para melhorar LCP. Acessibilidade Lighthouse 100 em todas as doze coletas.

Separação do engine de movimento e preload de Hoje reduziram a entrada de **408.994 para 325.595 bytes** (−20,4%). Assets totais cresceram 0,33%, transferência fria 0,96%; trabalho JS frio não diminuiu. CSS permanece idêntico. Preservaram-se movimentos, recursos e precache, sem dependência nova. O relatório registra waterfall, JS não utilizado e gargalos restantes de parsing/infraestrutura/engine; não atribui todo o atraso ao banco sem instrumentação.

## Backup e PWA

Ida e volta executada com exportação real → limpeza de banco descartável → importação → comparação integral → F5 e nova comparação. **JSON e Markdown completo Atlas deram snapshots iguais**, incluindo dez coleções, campos, relações por ID, perfil/pins, histórico de atividade e XP: [JSON](roundtrip-9b-json.json), [Markdown](roundtrip-9b-md.json). Unitários adicionais incluem avatar, migrações v1/v2→v3, rollback e deduplicação.

Markdown completo restaura pelo snapshot embutido; a nota `.md` individual não preserva todos os vínculos/entidades. Preferências gerais de tema/widgets/foco/contextos, rascunhos e undo não fazem parte do backup de conteúdo. Limpeza total mantém preferências gerais e remove perfil/registros/histórico/rascunhos; sua confirmação forte e limites de importação estão explicitados no QA. Não foi alterado o formato de backup nesta etapa.

**PWA passou:** primeiro acesso online, preparação do worker, recarga offline, oito rotas adicionais ainda não visitadas, recursos lazy, escrita offline/reconexão e persistência. O novo engine consta nas **66 entradas do precache**. Duas revisões reais de Workbox comprovaram “Agora não” mantendo a versão atual e “Atualizar” ativando a nova. Rascunho Markdown e timer ativo sobreviveram à atualização; outros formulários avisam para salvar antes de recarregar.

Manifest/ícones/escopo/atalhos e critérios de instalabilidade Edge: [relatório](audit-9b-final-pwa-installability.json), sem erros. **Instalação física não foi executada.** Não houve permissão de notificações, integração externa ou serviço remoto.

## Limitações e commits

Pendentes: desempenho frio ≥90; instalação física em desktop/mobile; Safari/WebKit; VoiceOver/NVDA humanos; zoom nativo; quota real e encerramento forçado do processo/sistema. Regras de média explicadas e normalizadas por nota máxima não presumem política acadêmica da UNIFOR. Lista numerosa e textos longos foram testados, mas não se promete desempenho de bases ilimitadas.

Commits locais de produto/teste:

- `b5def4e` — `fix: protege edições concorrentes e confirmação de persistência`
- `e97d46b` — `fix: preserva registros de hábito e intenção de fixar entre abas`
- `2fb16a2` — `perf: antecipa Hoje e separa motor de movimento`
- `5b21d7e` — `test: audita concorrência backups acessibilidade e PWA`

Este relatório e suas evidências são entregues em um commit documental separado; seu hash está no Git e no resumo da entrega. **Nenhum push ou deploy.**
