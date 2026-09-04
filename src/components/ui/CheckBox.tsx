import { cn } from '@/lib/cn'

/**
 * Square toggle used for goals and habits. Rendered as a real checkbox input
 * so it is keyboard- and screen-reader-native; the visual box is the sibling.
 */
export function CheckBox({
  checked,
  onChange,
  color,
  label,
  className,
}: {
  checked: boolean
  onChange: () => void
  color: string
  label: string
  className?: string
}) {
  return (
    <label
      className={cn(
        'group relative inline-flex cursor-pointer items-center justify-center',
        // 44px hit target around a 22px visual box, per touch-target guidance.
        'h-11 w-11 -m-2.5',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        style={{ '--c': color } as React.CSSProperties}
        className={cn(
          'flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border-2',
          'transition-colors duration-200',
          'border-[var(--c)] peer-focus-visible:outline peer-focus-visible:outline-2',
          'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-soft',
          checked ? 'bg-[var(--c)]' : 'bg-transparent group-hover:bg-[var(--c)]/15',
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--color-canvas)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </label>
  )
}
