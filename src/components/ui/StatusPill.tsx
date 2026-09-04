import { CircleDashed, CircleDot, CircleCheck, CircleSlash } from 'lucide-react'
import { GOAL_STATUSES, STATUS_LABELS, type GoalStatus } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * Status is never carried by color alone — every state ships an icon and its
 * label, so it survives a colorblind reader and a grayscale screenshot.
 */
const PRESENTATION: Record<
  GoalStatus,
  { icon: typeof CircleDot; className: string }
> = {
  todo: { icon: CircleDashed, className: 'text-ink-3 bg-surface-3' },
  doing: { icon: CircleDot, className: 'text-accent-soft bg-accent/15' },
  blocked: { icon: CircleSlash, className: 'text-warning bg-warning/15' },
  done: { icon: CircleCheck, className: 'text-good bg-good/15' },
}

export function StatusPill({
  status,
  className,
}: {
  status: GoalStatus
  className?: string
}) {
  const { icon: Icon, className: tone } = PRESENTATION[status]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {STATUS_LABELS[status]}
    </span>
  )
}

/**
 * The same pill, made editable. A real `<select>` sits transparent on top of
 * it: dropping to the native control is what makes status keyboard-operable
 * and screen-reader-legible, which the board's drag-and-drop can never be.
 */
export function StatusSelect({
  status,
  onChange,
  label,
  className,
}: {
  status: GoalStatus
  onChange: (status: GoalStatus) => void
  /** Accessible name — "Status" alone is ambiguous in a list of goals. */
  label: string
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <select
        value={status}
        onChange={(event) => onChange(event.target.value as GoalStatus)}
        aria-label={label}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {GOAL_STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      <StatusPill
        status={status}
        className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-soft peer-hover:brightness-125"
      />
    </span>
  )
}
