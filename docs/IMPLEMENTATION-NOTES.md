# Atlas

Captura de vídeos pelo Lumen local e ações de estudo/voz opcionais foram
adicionadas. Consulte [configuração e limites](docs/CAPTURE-WORKSPACE.md).
Isso não implementa sincronização em nuvem nem migra dados pessoais.

**Seu centro de comando pessoal: abre, anota, marca, pronto.**

O Atlas reúne tarefas, hábitos, notas, estudos, metas e projetos numa estrutura pronta para preencher. Organizar a rotina de quem estuda e constrói software exige menos configuração e mais pequenos próximos passos.

**Estado: candidato à primeira release, ainda não publicado.** A documentação não aprova a release: a meta de performance mobile fria >= 90 não foi atingida, o checklist humano está pendente e nenhuma limitação foi aceita em nome do usuário. Não há demo pública, tag, release ou CI publicada informada nesta entrega.

## Recursos implementados

| Área                  | O que existe no código                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hoje                  | Tarefas do dia, revisão de pendências, hábitos, compromisso manual, meta semanal escolhida pelo usuário e widgets ocultáveis/reordenáveis por arraste ou teclado.  |
| Tarefas               | Captura em português com datas/hora/tags/prioridade, contextos editáveis, subtarefas/repetição; Lista, Kanban, Calendário e Tabela, com alternativa ao arraste.    |
| Hábitos               | Binários/quantitativos, frequência diária/semanal, descanso, sequências e heatmaps individual/geral com cinco níveis e alternativa textual.                        |
| Notas                 | Editor/prévia Markdown, quatro templates, tags/busca, [[links]], autocomplete/backlinks, preview por mouse ou ação explícita e importação local de .md.            |
| Metas e projetos      | Resultados-chave manuais, progresso complementar de tarefas, prazo/meta semanal; projetos com tarefas/notas/metas vinculadas por ID e links/repositório opcionais. |
| Estudos               | Disciplinas, avaliações, faltas, provas/entregas, tarefas vinculadas, trilhas/checklist e flashcards com versão pequena de SM-2.                                   |
| Foco                  | Foco/pausa curta/pausa longa, durações configuráveis, iniciar/pausar/retomar/encerrar e recuperação por timestamps. Conclusão exige intenção explícita.            |
| Perfil e preferências | Perfil/avatar local, atividade/heatmap, até três fixados; aparência, movimento/transparência, widgets, dados e XP discreto/ocultável.                              |

Exemplos vêm prontos e podem ser removidos. Ações destrutivas comuns têm confirmação e recuperação; **limpeza total não tem desfazer**. **Ctrl/Cmd+K** captura/busca; **?** abre atalhos fora de campos. O dock inferior inclui Perfil; no celular, **Mais** reúne Notas, Metas e Estudos. Preferências fica no cabeçalho junto a Aparência.

Captura: `estudar AWS amanhã 19h #faculdade !alta`. `nota: ideia de projeto` cria uma nota e abre o editor.

## Instalação local

Requisitos: Node **22.19+ na linha 22, ou 24+**, npm e navegador com IndexedDB. Os mínimos vêm dos engines instalados de Vite, Vitest, jsdom e Lighthouse. Ambiente efetivamente validado: **Windows, Node 25.3.0, npm 11.6.2 e Microsoft Edge**. Compatibilidade declarada não significa teste em todas essas versões.

Na pasta do projeto:

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Não é necessário .env, login, backend ou chave de API. Para produção local:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4180 --strictPort
```

Saída: **dist/**. Preview é verificação local, não publicação. Portas/endereços diferentes têm bancos diferentes: veja [dados e privacidade](docs/DATA-AND-PRIVACY.md).

## Comandos e validação

| Comando existente                     | Finalidade                                                      |
| ------------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                         | Desenvolvimento com Vite.                                       |
| `npm run lint` / `npm run typecheck`  | ESLint e TypeScript estrito.                                    |
| `npm run test` / `npm run test:watch` | Vitest, Testing Library e IndexedDB de teste.                   |
| `npm run build` / `npm run preview`   | Build de produção e preview local.                              |
| `npm run test:e2e`                    | Playwright, Edge instalado e contextos descartáveis.            |
| `npm run icons`                       | Regenerar ícones locais.                                        |
| `npm run format`                      | Prettier: **reescreve arquivos**, use com intenção de formatar. |

E2E inicia build/preview em 4180 quando necessário ou usa servidor existente. ATLAS_TEST_URL é opção do runner, não requisito do app. Não reconstrua dist durante a suíte. Outra plataforma/navegador exige configuração própria; Safari/iOS não foi validado fisicamente.

Evidência da 9C: **843 unitários e 105 E2E**, lint/typecheck/build aprovados; backup/offline/atualização testados em automação. Lighthouse local, três execuções por cenário: **86 frio**, **99 retorno**, LCP frio **3,149 s**. Meta >= 90 ainda reprovada. [Review 9C](docs/REVIEW-ETAPA-9C.md) preserva relatórios/variabilidade. Não houve nova medição de performance na 10A. Axe/Lighthouse não substituem NVDA, zoom nativo, instalação física ou auditoria humana completa.

## Stack e arquitetura

Conferida no package.json: React 19, TypeScript 6, Vite 8, Tailwind CSS 4 com tokens CSS, Zustand, Dexie/IndexedDB, Zod, React Router, date-fns, Framer Motion, cmdk, Radix e Lucide. Markdown: react-markdown, remark-gfm, remark-parse e unified. Verificação: Vitest, Testing Library, Playwright/Axe e Lighthouse. PWA: vite-plugin-pwa/Workbox. Versões resolvidas ficam no package-lock.json.

Features em src/features; shell/rotas/estado em src/app; UI em src/components; regras puras em src/lib; modelos/repositories em src/data; tokens/estilos em src/styles. AtlasRepository separa o contrato do adaptador Dexie, sem nuvem implementada. Rotas/editor/preview/calendário/visões densas/ações de dados usam carga sob demanda. [Arquitetura detalhada](docs/ARCHITECTURE.md).

## Local-first, offline e backup

Conteúdo fica no IndexedDB; preferências gerais e rascunhos de notas em localStorage. **Não há sincronização entre dispositivos, autenticação ou backend de conteúdo.** Armazenamento local não é backup nem cofre criptografado.

No build de produção, após preparo online do SW, recarga e rotas precacheadas funcionam offline. Aguarde **“App preparado para recarga offline neste navegador”** em Preferências. Dev não registra o PWA. Atualização oferece **Atualizar** / **Agora não**; rascunho de nota e timer foram preservados em teste automatizado com duas revisões reais. Salve outros formulários antes de atualizar.

Em **Seus dados** ou Preferências:

- **JSON:** backup de conteúdo, IDs/relações, perfil/fixados, atividade e XP.
- **Markdown completo:** leitura humana mais bloco JSON de restauração; importar usa esse bloco, não edições feitas só na parte legível.
- **Nota .md individual:** texto, [[links]], título/tags/arquivamento; não restaura todo o banco, IDs ou relações estruturadas.

Preferências gerais, rascunhos e undo ficam fora do backup atual. Salve notas antes de exportar o backup completo. [Limites, conflitos, limpeza e troca de origem](docs/DATA-AND-PRIVACY.md).

## Capturas de apresentação

Sete capturas da 10A com **identidade/registros fictícios**, em contexto descartável; não representam produtividade real. CSS/DOM não foram alterados. Hoje mantém o recorte histórico de widgets; na preparação 10B a saudação passou a usar o nome do perfil, com fallback neutro. Hábitos mostra o histórico quantitativo.

![Hoje: tarefas, compromisso e meta semanal fictícios](docs/screenshots/delivery/hoje.png)

<details>
<summary>Ver Tarefas, Hábitos, Notas, Estudos, Foco e Perfil</summary>

![Tarefas: captura e quatro visões disponíveis](docs/screenshots/delivery/tarefas.png)
![Hábitos: histórico de estudo em cinco níveis](docs/screenshots/delivery/habitos.png)
![Notas: Markdown e conexão entre duas notas fictícias](docs/screenshots/delivery/notas.png)
![Estudos: próxima entrega, etapa e disciplinas fictícias](docs/screenshots/delivery/estudos.png)
![Foco: sessão pausada vinculada à tarefa fictícia](docs/screenshots/delivery/foco.png)
![Perfil: identidade fictícia, métricas, fixados e atividade](docs/screenshots/delivery/perfil.png)

</details>

[Procedência das capturas](docs/delivery-captures-10a.json); reprodução: scripts/capture-delivery.mjs. A coleção extensa de QA permanece separada e foi preservada.

## Limitações e próximos passos

- Performance fria < 90: decidir nova otimização autorizada ou aceitar explicitamente a limitação; nenhuma aceitação foi presumida.
- Instalação física, NVDA, zoom nativo 200%, celular/Safari: [checklist humano pendente](docs/MANUAL-RELEASE-CHECKLIST.md).
- Arquivamento de hábitos no backlog; alterar alvo/frequência recalcula histórico. Preferências gerais não viajam no backup.
- Identidade/caminhos locais em evidências antigas precisam de revisão antes de publicar. [Plano de divulgação](docs/DISCLOSURE-PLAN.md) e [procedência/licenças](docs/COMPONENT-PROVENANCE.md).
- Sem grafo, IA, integrações, login/nuvem, notificações ou colaboração nesta versão.
- **Licença própria não definida.** private: true não concede licença nem substitui decisão do titular. [Procedência e revisão do repositório](docs/REPOSITORY-REVIEW-10A.md).

[Checklist para futura 10B](docs/RELEASE-CHECKLIST.md) · [Caso de portfólio](docs/PORTFOLIO-CASE-STUDY.md) · [Changelog](CHANGELOG.md) · [Backlog](docs/TODO.md)


## Lumen transfer core (Stage 9C)

The single-note `.lumen-atlas.json` validator, planner and dedicated repository
are implemented and tested with fictional data. No import UI is connected.
Local before/after recovery uses the existing meta store and is excluded from
current backups, as explicitly approved. See [contract, recovery and verification](docs/LUMEN-ATLAS-STAGE9C.md).


### Transferência Lumen — Stage 9D

Notas oferece **Importar do Lumen** e **Histórico Lumen**, separados do backup e
Markdown comum. Use somente uma sessão local fictícia para revisão desta etapa.
Consulte [o guia e evidências Stage 9D](docs/LUMEN-ATLAS-STAGE9D.md) para abertura,
ambiente isolado, confirmação e limites de recuperação. Stage 9E permanece pendente.
