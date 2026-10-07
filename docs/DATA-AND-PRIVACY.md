# Dados e privacidade

O Atlas atual não tem backend de conteúdo, login, sincronização entre dispositivos, analytics implementado ou envio de notas/avatars a APIs. Importação e avatar são processados no navegador. Abrir um link externo por ação do usuário pode levar a outro serviço; não é sincronização do Atlas.

## Armazenamento e riscos

| Local                               | Conteúdo                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| IndexedDB `atlas-local`             | Entidades de conteúdo e metadados de perfil/fixados, atividade, XP, inicialização e undo.      |
| localStorage `atlas.preferences.v1` | Tema/destaque, movimento/transparência, contextos, durações, widgets, idioma e exibição de XP. |
| localStorage `atlas.note-drafts.v1` | Título/texto/tags e versão base de rascunhos de notas.                                         |
| Cache Storage / SW                  | Arquivos do aplicativo para offline, não backup do conteúdo.                                   |
| Downloads                           | Backups/notas exportados, legíveis e sem criptografia fornecida pelo Atlas.                    |

O app não oferece criptografia de conteúdo ou senha. Origem/perfil do navegador isolam armazenamento; acesso ao mesmo perfil/sistema pode expor os dados. Limpeza de navegação, modo privado, quota/evicção ou perda do perfil podem eliminar dados. Faça backups fora do navegador; não os versione no repositório.

Avatar é opcional: PNG/JPEG/WebP até 2 MiB e 24 megapixels, recorte WebP local 256×256, data URL até 350.000 caracteres; iniciais são o fallback. Perfil é local/privado, não uma conta pública.

## Troca de origem e futura URL

Protocolo, host e porta definem a origem. localhost, 127.0.0.1, portas 5173/4180 e futuro domínio HTTPS têm bancos separados. Outro navegador/perfil/dispositivo não recebe dados automaticamente. Offline exige preparo prévio **nessa origem**, não cobre endereço nunca carregado.

Antes de migrar:

1. Salve edições/rascunhos na origem antiga e exporte JSON completo; guarde cópia fora do navegador.
2. Valide a futura URL com dados fictícios online/offline, depois de sua criação ser autorizada. Host pode ter cache/rotas diferentes do preview.
3. Importe e compare conteúdo/vínculos na origem nova. Para restauração exata, prefira banco vazio: importar mescla e não sobrescreve IDs existentes.
4. Reconfigure aparência/contextos/widgets/durações; preferências gerais não entram no backup. Conserve origem antiga e backup até conferir tudo.

A entrega pública não transporta dados pessoais nem muda a hospedagem de uso pessoal.

## Exportações diferentes

| Formato             | Preserva                                                                                                                | Limitação                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| JSON Atlas          | Envelope format atlas/schemaVersion 1/data de exportação, coleções/IDs/campos/vínculos, perfil/fixados, atividade e XP. | Preferências gerais, rascunhos e undo ficam fora; importar mescla, não substitui o conteúdo existente.              |
| Markdown completo   | Leitura humana mais bloco JSON após `ATLAS_BACKUP_V1`, com mesmo conteúdo do JSON.                                      | Importar usa o bloco; editar só a parte legível não altera o que será restaurado. Não remover/editar esse bloco.    |
| Nota .md individual | Conteúdo, [[links por título]] e frontmatter de título/tags/arquivamento; pela nota, pode exportar rascunho visível.    | Não exporta ID, timestamps, vínculos estruturados, perfil/outras coleções/undo/preferências. Não é backup completo. |

Lote .md reconhece frontmatter simples e pode detectar conflito por ID fornecido; a exportação individual atual **não emite ID**. Links por título exigem notas presentes/unívocas no destino. Sem promessa de preservar YAML genérico, metadados de outros editores, imagens/anexos.

JSON/Markdown completo tiveram snapshot integral igual após exportar/limpar/importar em bancos descartáveis na 9C; não generalizar isso à importação de qualquer Markdown externo.

## Limites e segurança de importação

- JSON completo: 50 MiB. Importador legado de dados .md/.markdown: 5 MiB.
- Lote de notas: somente .md, MIME vazio ou text/markdown/text/plain; 20 arquivos, 1 MiB/arquivo, 10 MiB total; até 500.000 caracteres por nota.
- Snapshots: 10.000 registros por coleção principal; logs de hábitos 50.000; XP/atividade 100.000 cada, além dos limites por campo/lista nos schemas. Um arquivo pequeno pode ser inválido.
- Prévia/confirmação precedem importação. Validação inválida aborta a operação transacional de conteúdo. IDs existentes são preservados. Lote Markdown oferece política de cópia/ignorar/cancelar para conflitos por ID ou título/conteúdo.
- Renderer ignora HTML, não carrega imagens remotas, limita links navegáveis e não executa scripts. Lote rejeita conteúdo ativo não permitido. Um link externo permitido ainda pode apontar a site não confiável.

1 MiB = 1.048.576 bytes; a UI chama esses limites de MB. Os limites e formatos existentes foram preservados.

## Rascunhos e limpeza

Notas têm salvamento explícito/rascunho local. **Salve antes do backup completo**, que lê registros persistidos, não todos os rascunhos. Bloqueio de localStorage é anunciado com orientação para salvar/exportar o texto da aba. Conflitos mantêm a entrada para recuperação. Não há restauração universal de outros formulários.

Atualização automatizada preservou nota não salva e o mesmo timer. Timer não conclui por abandono; encerramento forçado do SO/instalação física/outros navegadores exigem teste humano.

Remover exemplos conserva os editados/referenciados por registros pessoais e permite desfazer. Excluir normalmente confirma e oferece recuperação conforme módulo. **Limpar todos os dados** exige `APAGAR TUDO` e ciência da perda, oferece backup e **não tem desfazer**: apaga conteúdo, perfil/fixados, atividade, XP, undo e rascunhos; mantém preferências e marcadores que evitam reinserir exemplos. Se o navegador bloquear remoção de rascunhos, a UI anuncia essa falha, sem presumir limpeza completa.

Nenhum banco pessoal foi lido/limpo/alterado para preparar a entrega. [Validação e limites da entrega](VALIDATION.md).
