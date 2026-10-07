# Espaço reservado: grafo de conhecimento

Nenhuma tela ou visualização nesta etapa. `src/lib/note-links.ts` expõe `noteEdges(notes)` com sourceId/targetId, derivadas dos links resolvidos no Markdown. A futura rota poderá consumir esse contrato sem mudar o armazenamento de notas nem manter um segundo índice persistido.
