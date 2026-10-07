import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { useId, useRef, useState } from 'react'

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  function focus(index: number) {
    const options =
      list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    options?.[index]?.focus()
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className={`select-menu ${className}`}
          role="combobox"
          aria-label={label}
          aria-controls={open ? id : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          data-value={value}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            }
          }}
        >
          <span>
            {options.find((option) => option.value === value)?.label ??
              'Escolher'}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="select-menu-panel"
          sideOffset={6}
          collisionPadding={16}
          align="end"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Never steal focus from a field the user has already reached.
            if (document.activeElement === document.body)
              trigger.current?.focus()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            focus(
              Math.max(
                0,
                options.findIndex((option) => option.value === value),
              ),
            )
          }}
        >
          <div ref={list} id={id} role="listbox" aria-label={label}>
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="select-menu-option"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                onKeyDown={(event) => {
                  let next: number | undefined
                  if (event.key === 'ArrowDown')
                    next = (index + 1) % options.length
                  else if (event.key === 'ArrowUp')
                    next = (index - 1 + options.length) % options.length
                  else if (event.key === 'Home') next = 0
                  else if (event.key === 'End') next = options.length - 1
                  else if (event.key.length === 1 && event.key !== ' ') {
                    const candidate = options.findIndex(
                      (item, position) =>
                        position > index &&
                        item.label
                          .toLocaleLowerCase('pt-BR')
                          .startsWith(event.key.toLocaleLowerCase('pt-BR')),
                    )
                    next =
                      candidate >= 0
                        ? candidate
                        : options.findIndex((item) =>
                            item.label
                              .toLocaleLowerCase('pt-BR')
                              .startsWith(event.key.toLocaleLowerCase('pt-BR')),
                          )
                  }
                  if (next !== undefined && next >= 0) {
                    event.preventDefault()
                    focus(next)
                  }
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
