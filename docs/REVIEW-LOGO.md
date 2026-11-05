# Atualização da marca — 2026-10-06

## Alterações

- Marca fornecida pelo titular aplicada ao cabeçalho, favicon SVG/ICO e ícones PWA/Apple Touch. SVG vetorial e ICO originais preservados; PNGs gerados localmente com Sharp já instalado.
- Marca de 2rem, sem distorção, fundo escuro semântico para leitura no tema claro e nome acessível no link de início. Demais tokens, layouts, controles e dados preservados.
- Ícones de instalação opacos, sem cantos pré-recortados; versão maskable centralizada com margem para a máscara do Android. Favicons incluídos no precache. Manifest com credenciais e confirmação de atualização preservados.

## Revisão com apple-design

- **O quê:** o anel prata perde definição sobre superfícies claras. **Por quê:** `dark-mode.md > Icons and images` pede legibilidade nas duas aparências. **Correção:** fundo `--brand-surface` discreto, mantendo a arte original. Contraste do tom mais escuro do anel contra esse fundo: 9,63:1, calculado por luminância WCAG, sem considerar pixels de antialiasing.
- **O quê:** a arte original ultrapassa o círculo seguro de ícones maskable. **Por quê:** `app-icons.md > Icon shape` orienta centralizar conteúdo para evitar cortes. **Correção:** marca em 448px no canvas opaco de 512px; teste verifica todos os pixels da arte dentro do raio seguro de 204,8px.
- **O quê:** captura em 375px revelou sobreposição da marca com Foco. **Por quê:** `layout.md > Visual hierarchy` e `accessibility.md > Mobility` requerem separação legível entre controles. **Correção:** largura mínima de conteúdo na área da marca, permitindo a quebra de linha já prevista no cabeçalho. Teste verifica ausência de interseção com a primeira ação.
- Marca restrita ao cabeçalho e identificação do aplicativo, conforme `branding.md > Best practices`; não há nova animação nem dependência exclusiva de cor.

## Validação

- Lint e typecheck aprovados. Suíte unitária completa: 847 testes em 69 arquivos aprovados.
- Build de produção aprovado. Sem bibliotecas novas; precache inclui SVG, ICO e PNGs atualizados.
- E2E direcionado: **6 testes aprovados**, cobrindo marca nos temas claro/escuro, 375/768/1280px, ampliação de texto a 200%, proporção, alvo de toque, ausência de overflow/sobreposição, foco e Enter; Axe restrito ao link de marca; opacidade e área segura dos ícones; assets offline; manifest autenticado simulado; instalabilidade em perfil descartável; rotas inéditas offline, persistência e atualização real do service worker.
- Os testes usam perfis/bancos descartáveis. Nenhum teste existente foi removido ou enfraquecido; a suíte E2E inteira não foi reexecutada neste ajuste. Ampliação CSS de texto não representa teste humano de zoom nativo; instalação física continua pendente.
- A primeira tentativa de testes no sandbox foi bloqueada por `spawn EPERM`; a execução local com permissão para processos nativos passou. Não foi feita nova medição Lighthouse.

## Hospedagem e pacote

O endereço hospedado permanece na versão anterior. Não houve upload, alteração de alias, proteção, produção ou publicação. A autorização anterior contemplava um pacote específico de 69 arquivos; esta versão precisa de nova autorização antes de envio.

Pacote local revisado: **70 arquivos, 1.508.455 bytes**, somente build compilado e a configuração Vercel já revisada, preservada byte a byte. Lista permitida e SHA-256 por arquivo registrados localmente, fora do pacote. Sem fontes, `.git`, `.env`, bancos, backups ou relatórios. Os pacotes anteriormente autorizados permanecem intactos.

Evidências de navegador e inventário ficam na área local ignorada `.vercel/logo-validation/`, não no material de upload.
