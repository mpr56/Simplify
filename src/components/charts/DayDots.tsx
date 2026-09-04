import { fromISO } from '@/lib/date'
import { cn } from '@/lib/cn'

export interface DayDot {
  iso: string
  done: boolean
  isFuture: boolean
}

/**
 * Compact per-day cell strip — the "last 7 days" row. Cells are buttons when
 * `onToggle` is supplied, otherwise inert spans (a static readout should not
 * land in the tab order).
 */
export function DayDots({
  days,
  color,
  habitName,
  onToggle,
  className,
}: {
  days: DayDot[]
  color: string
  habitName: string
  onToggle?: (iso: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {days.map((day) => {
        const date = fromISO(day.iso)
        const dateLabel = date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
        const title = day.isFuture
          ? `${dateLabel} — upcoming`
          : `${habitName} — ${dateLabel}: ${day.done ? 'done' : 'missed'}`

        const cellClass = cn(
          'h-4 w-4 rounded-[5px] transition-colors duration-200',
          day.isFuture && 'opacity-40',
        )
        const style = {
          backgroundColor: day.done ? color : 'var(--color-surface-3)',
        }

        if (!onToggle) {
          return (
            <span key={day.iso} title={title} className={cellClass} style={style}>
              <span className="sr-only">{title}</span>
            </span>
          )
        }

        return (
          <button
            key={day.iso}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={day.done}
            disabled={day.isFuture}
            onClick={() => onToggle(day.iso)}
            className={cn(
              cellClass,
              'cursor-pointer hover:ring-2 hover:ring-line-strong disabled:cursor-not-allowed',
            )}
            style={style}
          />
        )
      })}
    </div>
  )
}
