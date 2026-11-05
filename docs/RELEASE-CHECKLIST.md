# Preparação e autorização da etapa 10B

**10A é documentação, não aprovação de release.** Sem autorização de push, tag, release ou deploy. O [checklist humano](MANUAL-RELEASE-CHECKLIST.md) continua sendo a matriz dos testes físicos; não duplicar resultados humanos aqui.

## Gates

| Gate                            | Estado            | Evidência/decisão necessária                                                                                                               |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentação/capturas fictícias | Preparadas        | README, arquitetura, privacidade, changelog e caso de portfólio.                                                                           |
| Checks locais                   | Aprovados         | Preparação 10B: lint/typecheck, 847 unitários, build e 106 E2E locais; checks-pre10b.json. Sem resultados humanos ou hospedados.           |
| Performance                     | **Não aprovada**  | 9C: frio 86, retorno 99. Nova otimização autorizada ou aceitação explícita da limitação pelo usuário; documentação não decide.             |
| Testes humanos                  | **Pendentes**     | Instalação/reabertura, offline, atualização/rascunho/timer, teclado/Escape, zoom nativo 200%, NVDA e dispositivos disponíveis.             |
| Conteúdo a divulgar             | **Pendente**      | Referências pessoais, caminhos locais, log antigo, imagens/relatórios/histórico; escolher visibilidade/arquivos. Nada removido.            |
| Licença/procedência             | **Pendente**      | Titular escolhe licença; conferir snippet adaptado e dependências. Não presumir licença open source.                                       |
| Destino e autorização           | **Não definidos** | Plataforma/projeto/domínio, staging versus produção, visibilidade e ações permitidas. Staging não implica autorização de push ou produção. |

Pacote continua `0.0.0`/`private: true`, sem release/tag nesta preparação. Versionamento público requer decisão posterior.

## Preflight técnico — sem deploy

- `npm ci`; `npm run build`; saída **dist/**. Preview local: `npm run preview -- --host 127.0.0.1 --port 4180 --strictPort`.
- Sem variáveis obrigatórias do app/.env fornecido. DEV/PROD são flags Vite; ATLAS_TEST_URL/ATLAS_EVIDENCE_PREFIX são opções de testes. Segredos em VITE_* seriam públicos no cliente.
- BrowserRouter: host deve entregar index.html nas rotas diretas, preservando queries; assets reais devem ser servidos normalmente, asset ausente deve ser 404, não HTML disfarçado de JS.
- Wildcard React mostra Página não encontrada. Documento fallback pode responder HTTP 200: não equivale a 404 HTTP. Sem rota de grafo/dashboard extra.
- Manifest: id/start_url/scope `/`, Atlas, pt-BR, standalone; ícones 192/512/maskable 512/touch 180 locais. Atalhos Hoje/Tarefas/Notas. Candidato pressupõe **raiz do domínio**, não base path de subdiretório.
- Workbox precacheia JS/CSS/HTML/SVG/PNG/manifest, inclusive lazy; navigateFallback index.html, cleanupOutdatedCaches, clientsClaim, skipWaiting false e prompt. PWA desativado em dev.
- Futuro host deve permitir revalidar HTML/sw.js/manifest; hash de assets permite cache longo. Não aplicar immutable a tudo. Preview tem Cache-Control no-cache, que não configura o host futuro.
- Verificar HTTPS/MIME/escopo/rotas/404/precache após hospedar. Nenhuma configuração de hospedagem/CI foi criada nesta etapa; escolher regras após definir destino.

[Observações do preview](staging-preflight-10a.json) não comprovam comportamento da hospedagem futura.

Preflight 10A observado: `/notas` abriu diretamente; rota desconhecida respondeu 200 e mostrou “Página não encontrada”. **Asset JS inexistente também recebeu HTML/200 no preview Vite.** Não transportar esse fallback indiscriminado para staging: conferir 404 para assets ausentes no host escolhido. Manifest/SW/ícones responderam com MIME correto e `Cache-Control: no-cache`. É uma pendência de validação da hospedagem futura, sem mudança de configuração nesta etapa.

## Futura URL HTTPS — após autorização

1. Registrar commit/build/plataforma/URL/headers; perfil descartável e dados fictícios, sem conteúdo pessoal inicialmente.
2. Abrir rotas diretas/queries, rota desconhecida e asset ausente; conferir fallback sem quebrar recursos.
3. Preparar SW online; recarregar offline, visitar rotas inéditas, criar/editar, reconectar e comparar registros.
4. Manifest/ícones/escopo/atalhos e instalação física: registrar dispositivo/resultado, sem confundir critério do navegador com instalação no SO.
5. Duas versões realmente hospedadas: Agora não conserva versão; Atualizar ativa nova e preserva nota/timer. Salvar outros formulários; conferir assets lazy/cache antigo.
6. Três Lighthouse frios e três de retorno comparáveis, com relatórios completos. Não usar localhost como resultado de staging.
7. Preencher checklist humano local e celular/Safari somente com dispositivos disponíveis; registrar não testado/reprovações.
8. Conferir transporte entre origens conforme DATA-AND-PRIVACY; deploy não migra banco local.

## Registro da autorização

Preencher somente após decisão humana: responsável ___; data ___; commit ___; plataforma/projeto ___; destino ___; visibilidade ___; licença ___; ações permitidas (push/staging/tag/release/produção) ___; decisão explícita de performance ___; pendências aceitas ___; rollback ___.

**Estado: aguardando autorização.** Esta lista não solicita nem executa publicação automaticamente.

## Preparação 10B — staging separado de release

Saudação dinâmica/fallback neutro e placeholder fictício corrigidos. [Plano de divulgação](DISCLOSURE-PLAN.md), [procedência/aviso MIT do dock](COMPONENT-PROVENANCE.md), [plano de staging e matriz hospedada](STAGING-PLAN.md). Licença própria, referências intencionais, proteção/destino e aprovação externa continuam decisões humanas.

Staging restrito pode ser autorizado para executar os testes pendentes **sem aceitar performance 86/99 nem aprovar release definitiva**. A autorização deve delimitar conta/projeto, upload apenas de dist revisado, origem estável, proteção, revisões A/B e eventual rollback. Não inclui push, repositório público, produção, tag ou release. Os gates da release permanecem; esta preparação não preenche evidência humana/hospedada.
