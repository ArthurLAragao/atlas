import { lazy, Suspense, useState, type ButtonHTMLAttributes } from 'react'
import '../styles/capture.css'
const ConfirmDialog = lazy(() =>
  import('./ConfirmDialog').then((m) => ({ default: m.ConfirmDialog })),
)
export function ConfirmAction({
  name,
  title,
  description = 'Esta ação remove o item. Você poderá desfazer pelo aviso ou na opção de recuperação deste módulo.',
  onConfirm,
  restoreFocus,
  children,
  ...props
}: Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'title' | 'name'
> & {
  name: string
  title: string
  description?: string
  onConfirm: () => Promise<boolean | void> | boolean | void
  restoreFocus?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button {...props} type="button" onClick={() => setOpen(true)}>
        {children}
      </button>
      <Suspense fallback={null}>
        {open && (
          <ConfirmDialog
            name={name}
            title={title}
            description={description}
            onConfirm={onConfirm}
            restoreFocus={restoreFocus}
            onCancel={() => setOpen(false)}
          />
        )}
      </Suspense>
    </>
  )
}
