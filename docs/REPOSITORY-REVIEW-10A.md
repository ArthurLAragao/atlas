# Revisão de preparação do repositório — 10A

Baseline `1686a01`, Git inicialmente limpo, 06/10/2026. Escopo: arquivos versionados, configuração, dependências diretas instaladas e capturas selecionadas. Sem banco pessoal, scanner externo/npm audit, publicação, exclusão de arquivo ou reescrita do histórico.

[Inventário](repository-inventory-10a.json): 1.370 arquivos versionados antes da 10A; 999 arquivos de evidência em docs/screenshots/Lighthouse. Referências são candidatos para revisão, não classificação automática de informação sensível.

## Achados

| O que                      | Consequência / tratamento                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| README desatualizado       | Citava sidebar/perfil no rodapé e 9B futura; corrigido para código atual e limites 9C.                                                                                         |
| .env sem regra própria     | Acrescentado .env/.env.*, permitindo .env.example. Nenhum ambiente criado; app não exige variáveis.                                                                            |
| Log rastreado              | docs/build-stage9a.log já versionado; regra *.log não o remove. Preservado, divulgação/remoção dependem de autorização.                                                        |
| Identidade/caminhos locais | Candidatos em 85 arquivos; caminhos em 12. Docs, fixtures, código e relatórios podem conter aliases/contextos. Revisão antes de tornar público; nada reescrito/censurado.      |
| Capturas antigas           | Sem OCR/inspeção humana integral da coleção. Nova seleção fictícia de sete imagens inspecionadas; Hoje recorta widgets para excluir saudação fixa pessoal, sem editar DOM/CSS. |
| Licença própria ausente    | Nenhum LICENSE/COPYING/NOTICE próprio; private: true não define licença. Decisão do titular pendente.                                                                          |
| Snippet adaptado           | Dock fornecido pelo usuário foi adaptado; licença específica não registrada. Conferir procedência/permissão antes de publicar.                                                 |

## Credenciais, temporários e assets

Busca local por padrões conhecidos, sem imprimir valores: chaves privadas PEM/OpenSSH e padrões de tokens GitHub/AWS/Google/Stripe/OpenAI. **Nenhuma ocorrência desses padrões** nos textos versionados analisados. Sem .env/.npmrc no topo ou versionado; credencial HTTP embutida no remote não detectada. Não prova ausência de todo segredo: histórico Git, binários/OCR, formatos desconhecidos e configurações pessoais externas não tiveram auditoria integral.

Inventário não encontrou bancos/perfis/chaves/ZIP rastreados por seus padrões. node_modules, dist, test-results, relatórios Playwright e novos logs são ignorados. Capturas usam contexto descartável sem perfil persistente pessoal. Nenhum log, asset, banco ou arquivo existente foi apagado.

public contém favicon/ícones locais (192/512/maskable/touch180/vetor), referidos pelo manifest/index/precache/geração. Sem imagens remotas necessárias ao app. Nenhum asset de runtime foi identificado para exclusão segura neste escopo. A coleção de QA é material de repositório, não copiado pelo Vite ao dist; reduzir/arquivar exige autorização/preservação de evidências.

## Licenças e procedência

Manifestos instalados de dependências **diretas**: MIT (React/Zustand/Zod/Framer Motion/Radix/cmdk/Markdown/Vite/Tailwind e outras), Apache-2.0 (Dexie/Playwright/Lighthouse/TypeScript/sharp/fake-indexeddb), ISC (Lucide), MPL-2.0 (@axe-core/playwright). Relação por pacote no inventário. Não é parecer jurídico, SBOM completa ou auditoria de todas as transitivas.

Dock usa React Router/Radix/Framer Motion existentes; sem instalar shadcn/GSAP/motion para copiar referência. Snippet de origem: instrução do usuário; licença específica desconhecida. Bencho/Coss/ObsidianUI/HIG foram referências de interação/direção registradas em DECISIONS, não licença para republicar código/arte. Ícones Atlas gerados localmente; novas capturas não distribuem fotos/avatars pessoais.

Titular deve escolher licença própria e conferir atribuições/permissões. Nenhuma licença foi presumida; nenhum badge de CI, demo ou link de release inventado.

## Antes de autorizar publicação

Escolher conteúdo/visibilidade; conferir referências pessoais/imagens/histórico; decidir licença/procedência; preencher checklist humano e decidir performance. Materiais estão preparados para revisão, **repositório não aprovado automaticamente para publicação**. [Gates](RELEASE-CHECKLIST.md).

Atualização na preparação 10B: a correspondência do dock com beUI e a licença MIT upstream foram verificadas, e o aviso acompanha dist. A versão/cadeia exata do snippet recebido permanece sem registro. [Procedência atual](COMPONENT-PROVENANCE.md) e [classificação por arquivo](DISCLOSURE-PLAN.md) complementam este inventário histórico, sem apagar evidências nem escolher licença do Atlas.
