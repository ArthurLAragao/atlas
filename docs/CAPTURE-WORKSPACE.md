# Ambiente de trabalho e captura Lumen

Adição incremental às telas Hoje e Notas: acessos a Estudos/Foco/Notion/Spotify e captura de vídeos pelo Lumen local. Não altera schema do banco, tarefas, preferências ou dados existentes.

Abra o Lumen no modo `workspace`. Em **Capturar vídeo**, conecte ao Lumen, informe URL do YouTube e envie. Acompanhe a fila no Atlas; revisão e publicação ficam na mesa do Lumen. O Atlas não registra tempo estudado ou conclusão de tarefas nessa operação.

A ponte só está disponível nas origens locais 127.0.0.1/localhost nas portas 5173 e 4180. Hospedagem remota continua sem essa integração. Não altere sua origem usual sem backup: IndexedDB é separado por endereço/porta.

Voz opcional: comandos abrir estudos/foco/Notion/Spotify, além de open study/focus/notion/spotify. A interpretação aceita apenas frases previstas; não executa comandos livres. Depende da implementação SpeechRecognition do navegador, permissão e possíveis serviços online. Aberturas externas são confirmadas por clique. Não testado com microfone real.

O estado de captura não pertence ao backup do Atlas: é persistido separadamente pelo Lumen. Sem credenciais Notion no navegador.

## Prática a partir de um vídeo

Capturas novas também retornam a prática sugerida pelo resumo e o link confirmado
do Notion. **Salvar referência e preparar tarefa** salva uma nota de referência
no Atlas e abre o formulário de tarefa com vínculo para essa nota. A tarefa só
é gravada ao confirmar o formulário. Cancelar mantém a referência; referências
existentes não são sobrescritas. Nada é marcado como estudado ou concluído.

Registros antigos sem sugestão continuam visíveis, sem inventar exercícios. Os
links recebidos são limitados a endereços HTTPS do Notion, e registros inválidos
da ponte não viram referências locais.
