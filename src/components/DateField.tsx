import {
  lazy,
  Suspense,
  useId,
  useState,
  useSyncExternalStore,
  type InputHTMLAttributes,
} from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays } from 'lucide-react'
import '../styles/date-picker.css'
const DatePicker = lazy(() =>
  import('./DatePicker').then((m) => ({ default: m.DatePicker })),
)
const media = '(max-width: 760px)'
function subscribe(callback: () => void) {
  const query = window.matchMedia(media)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
interface DateProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label?: string
  onValueChange?: (date: string) => void
}
export function DateField({
  label = 'Data',
  value,
  defaultValue,
  onChange,
  onValueChange,
  ...props
}: DateProps) {
  const [local, setLocal] = useState(String(defaultValue ?? ''))
  const [open, setOpen] = useState(false)
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(media).matches,
    () => false,
  )
  const id = useId()
  const selected = value === undefined ? local : String(value)
  function choose(date: string) {
    setLocal(date)
    onValueChange?.(date)
    setOpen(false)
  }
  const trigger = (
    <button
      type="button"
      className="icon-button"
      disabled={props.disabled}
      aria-label={`Abrir calendário: ${label}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <CalendarDays aria-hidden="true" />
    </button>
  )
  const picker = (
    <Suspense fallback={<p role="status">Abrindo calendário.</p>}>
      <DatePicker
        label={label}
        value={selected}
        min={props.min ? String(props.min) : undefined}
        max={props.max ? String(props.max) : undefined}
        required={props.required}
        onSelect={choose}
        onClose={() => setOpen(false)}
        inline={!mobile}
      />
    </Suspense>
  )
  return (
    <span className="date-field">
      <input
        {...props}
        aria-label={props['aria-label'] ?? label}
        type="date"
        value={selected}
        onChange={(event) => {
          setLocal(event.target.value)
          onValueChange?.(event.target.value)
          onChange?.(event)
        }}
      />
      {mobile ? (
        <>
          {trigger}
          {open && picker}
        </>
      ) : (
        <Popover.Root modal open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>{trigger}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="date-picker-popover"
              sideOffset={8}
              collisionPadding={16}
              align="end"
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-help`}
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <h2 id={`${id}-title`}>Calendário: {label}</h2>
              <p id={`${id}-help`} className="caption">
                Setas percorrem dias; Home/End percorrem a semana; Page Up/Page
                Down mudam o mês. Enter escolhe, Escape cancela.
              </p>
              {picker}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </span>
  )
}
