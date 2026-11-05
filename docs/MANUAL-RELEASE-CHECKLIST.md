# Atlas — checklist humano da release

**Estado inicial: todos os itens Não testado.** Automação, Axe e critérios de instalabilidade não são evidência de instalação física, leitura por NVDA ou teste em celular. Preencha somente depois de executar cada passo; anexe screenshot, vídeo ou anotação verificável quando possível.

Use um perfil de navegador **Atlas QA** e registros de teste. Não apague dados pessoais. Anote commit/build, sistema, navegador/versão, dispositivo e data. Exporte um backup antes de alterar versões ou limpar esse perfil descartável.

## Verificações locais no Windows

O servidor local de produção pode ser aberto com `npm run build` e `npm run preview -- --host 127.0.0.1 --port 4180 --strictPort`. `localhost`/`127.0.0.1` são contextos locais apropriados ao service worker. `npm run dev` não registra o PWA de produção.

| ID  | Ambiente/dispositivo                         | Passo executado                                                                                                                                  | Resultado esperado                                                                                                          | Resultado observado / evidência | Estado          |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------- |
| L1  | Windows: ___; Edge/Chrome: ___; build: ___   | Abrir Atlas online no perfil QA; aguardar preparação offline; instalar pelo navegador; abrir pela janela instalada, fechar e reabrir             | Ícone e nome Atlas; janela independente; registros de teste conservados                                                     | ___                             | **Não testado** |
| L2  | Windows / PWA instalado: ___                 | Após L1, desligar a conexão; recarregar e abrir Tarefas, Hábitos, Notas, Metas, Estudos, Foco, Perfil e Preferências                             | Conteúdo e controles funcionam; estado offline claro; sem telas quebradas                                                   | ___                             | **Não testado** |
| L3  | Windows / perfil QA: ___                     | Offline, criar uma tarefa e uma nota, editar seu conteúdo e registrar um hábito; fechar/reabrir; reconectar                                      | Conteúdo persiste offline e após reconexão; sem duplicatas/perdas                                                           | ___                             | **Não testado** |
| L4  | Windows / versões anterior e nova: ___ / ___ | Com duas compilações locais reais disponíveis: digitar nota sem salvar e iniciar Foco; receber atualização; escolher Agora não, depois Atualizar | Adiamento conserva versão atual; atualização ativa a nova; rascunho e mesma sessão recuperados sem conclusão automática     | ___                             | **Não testado** |
| L5  | Windows / teclado: ___                       | Usar Tab/Shift+Tab, Ctrl+K, ?, Enter; abrir sheets/menus/captura; cancelar com Escape; concluir/excluir e desfazer um registro de teste          | Foco visível e ordem compreensível; diálogo contém foco; Escape devolve ao acionador; nenhuma ação destrutiva acidental     | ___                             | **Não testado** |
| L6  | Windows / navegador: ___; viewport: ___      | Ajustar **zoom nativo a 200%** pelo menu do navegador; visitar módulos, editor longo, tabela, calendário e sheets; repetir claro/escuro          | Texto legível sem cortes/sobreposições; controles alcançáveis; rolagem de tabela sinalizada                                 | ___                             | **Não testado** |
| L7  | Windows: ___; NVDA: ___; navegador: ___      | Iniciar NVDA; ler títulos, links e formulários; navegar no diálogo, calendário e alternativa textual do heatmap; testar erro e Desfazer          | Nomes/estados/valores compreensíveis; foco anunciado; feedback útil sem repetição excessiva; alternativa ao conteúdo visual | ___                             | **Não testado** |

Para L4, uma simulação automatizada já existe em `e2e/pwa-update.spec.ts`, mas não preencha o resultado humano a partir dela. Se as duas versões locais não estiverem disponíveis, deixe L4 Não testado e repita em staging quando autorizado. Não publicar para completar este checklist nesta etapa.

Em L5/L6/L7, testar também preferência de movimento/transparência reduzidos. Registre o que foi realmente percebido; não declare toda WCAG aprovada apenas por estes passos curtos. Reprovação: anote rota, controle, sequência e resultado observado; interrompa a preparação de release se houver perda de dados ou impedimento do fluxo principal.

## Dependem de staging HTTPS e dispositivos disponíveis

Não há URL de staging criada pela etapa 9C. Teste com registros descartáveis nesse endereço, que terá armazenamento próprio separado do localhost. Não transportar dados pessoais sem intenção explícita.

| ID  | Ambiente/dispositivo                             | Passo executado                                                                                                                                          | Resultado esperado                                                                     | Resultado observado / evidência | Estado          |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- | --------------- |
| S1  | URL HTTPS: ___; celular físico/SO/navegador: ___ | Abrir, instalar quando oferecido, fechar/reabrir; preparar online e testar offline, criação, editor, teclado virtual e atualização entre versões         | Fluxos preservados; controles confortáveis; offline preparado e registros persistentes | ___                             | **Não testado** |
| S2  | URL HTTPS: ___; iPhone/iPad/macOS e Safari: ___  | **Somente se houver dispositivo disponível:** testar navegação/instalação compatível, teclado, armazenamento, offline, editor e timer após alternar apps | Sem perda de dados ou layout quebrado; reconhecer as limitações reais do navegador     | ___                             | **Não testado** |

Sem dispositivo disponível, mantenha S2 Não testado e registre o motivo; não transforme ausência de teste em aprovação. Em staging, repetir L4 entre duas versões reais e registrar cache/HTTPS/atualização. Publicação e testes em ambiente hospedado exigem autorização na etapa apropriada.

Responsável pelos testes: ___ · Data: ___ · Commit/build: ___ · Evidências: ___

Decisão humana de release: ___ · Itens reprovados/pendentes aceitos explicitamente: ___
