import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

export function PageHeader({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow: string
  children: ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    document.title = `${title} · Atlas`
    const engaged = document.activeElement?.closest(
      '[role="dialog"], [role="alertdialog"], .toolbar button, .toolbar input',
    )
    if (!engaged) ref.current?.focus({ preventScroll: true })
  }, [title])
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      <p className="page-description">{children}</p>
    </header>
  )
}
