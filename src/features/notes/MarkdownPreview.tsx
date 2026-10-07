import {
  createContext,
  useContext,
  useMemo,
  type InputHTMLAttributes,
} from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import type { Note } from '../../data/models'
import { previewMarkdown } from '../../lib/note-links'

interface TextNode {
  value?: string
  children?: readonly TextNode[]
}
const listLabel = createContext('Item da nota')
const plainText = (node: TextNode): string =>
  node.value ?? node.children?.map(plainText).join('') ?? ''
function NoteCheckbox({ checked }: InputHTMLAttributes<HTMLInputElement>) {
  const label = useContext(listLabel)
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled
      aria-label={`${label}: ${checked ? 'concluído' : 'pendente'}`}
    />
  )
}

export function MarkdownPreview({
  content,
  notes,
}: {
  content: string
  notes: Note[]
}) {
  const source = useMemo(
    () => previewMarkdown(content, notes),
    [content, notes],
  )
  return (
    <article className="note-prose" aria-label="Pré-visualização da nota">
      {content.trim() ? (
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            li: ({ children, node }) => (
              <li>
                <listLabel.Provider
                  value={
                    node
                      ? plainText(node).trim() || 'Item da nota'
                      : 'Item da nota'
                  }
                >
                  {children}
                </listLabel.Provider>
              </li>
            ),
            input: NoteCheckbox,
            h1: ({ children }) => <h2>{children}</h2>,
            h2: ({ children }) => <h3>{children}</h3>,
            h3: ({ children }) => <h4>{children}</h4>,
            h4: ({ children }) => <h5>{children}</h5>,
            h5: ({ children }) => <h6>{children}</h6>,
            img: ({ alt }) => (
              <span className="form-help">
                Imagem: {alt || 'sem descrição'} (anexos indisponíveis)
              </span>
            ),
            a: ({ href, children }) =>
              href?.startsWith('/notas?') ? (
                <Link to={href}>{children}</Link>
              ) : href && /^(https?:|mailto:)/u.test(href) ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
            table: ({ children }) => (
              <div
                className="note-table"
                tabIndex={0}
                role="region"
                aria-label="Tabela da nota"
              >
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {source}
        </Markdown>
      ) : (
        <p className="form-help">
          Seu texto aparece aqui. Volte a Editar para começar.
        </p>
      )}
    </article>
  )
}
