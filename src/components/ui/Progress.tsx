import { cn } from '@/lib/cn'

export function Progress({
  value,
  color,
  label,
  className,
}: {
  /** 0–100. */
  value: number
  color: string
  /** Accessible name — the bar is not adjacent to its own label in every layout. */
  label: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  )
}
