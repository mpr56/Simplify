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
  disabled,
  className,
}: {
  checked: boolean
  onChange: () => void
  color: string
  label: string
  /** For a day that has not happened yet — the box still reads, it just won't tick. */
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        'group relative inline-flex items-center justify-center',
        // 44px hit target around a 22px visual box, per touch-target guidance.
        'h-11 w-11 -m-2.5',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
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
          checked
            ? 'bg-[var(--c)]'
            : cn('bg-transparent', !disabled && 'group-hover:bg-[var(--c)]/15'),
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
