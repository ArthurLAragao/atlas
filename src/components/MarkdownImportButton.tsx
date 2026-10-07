import { lazy, Suspense, useState } from 'react'
import { Upload } from 'lucide-react'
const MarkdownImport = lazy(() =>
  import('../features/notes/MarkdownImport').then((m) => ({
    default: m.MarkdownImport,
  })),
)
export function MarkdownImportButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="button" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        Importar Markdown
      </button>
      <Suspense fallback={null}>
        {open && <MarkdownImport onClose={() => setOpen(false)} />}
      </Suspense>
    </>
  )
}
