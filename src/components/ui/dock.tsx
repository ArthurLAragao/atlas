import { createContext, useContext, useId, type ReactNode } from 'react'
import { m as motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { useAtlasReducedMotion } from '../../app/use-motion'

// Adaptado do dock beUI (MIT). Fonte/condições: docs/COMPONENT-PROVENANCE.md.
// Aviso de redistribuição acompanha o app em public/third-party-notices.txt.

const DockContext = createContext('atlas-dock')

/** Navigation references stay real links, including modifier-key navigation. */
export function Dock({
  children,
  label,
  className = '',
}: {
  children: ReactNode
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <DockContext.Provider value={id}>
      <nav className={`dock glass ${className}`} aria-label={label}>
        {children}
      </nav>
    </DockContext.Provider>
  )
}

export function DockItem({
  to,
  label,
  children,
}: {
  to: string
  label: string
  children: ReactNode
}) {
  const id = useContext(DockContext)
  const reduce = useAtlasReducedMotion()
  return (
    <NavLink to={to} end={to === '/'} className="dock-item" aria-label={label}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              aria-hidden="true"
              className="dock-selection"
              layoutId={id}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 360,
                      damping: 32,
                      mass: 0.6,
                    }
              }
            />
          )}
          {children}
          <span className="dock-label">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function DockSeparator() {
  return <span className="dock-separator" aria-hidden="true" />
}
