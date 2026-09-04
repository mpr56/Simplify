import { cn } from '@/lib/cn'

/**
 * A headline number. No plot, so no hover layer — the value is the whole point.
 * Values wear ink tokens; the optional accent applies to the number only.
 */
export function StatTile({
  label,
  value,
  suffix,
  accent,
  hint,
  className,
}: {
  label: string
  value: string | number
  suffix?: string
  accent?: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface-1 px-5 py-4 shadow-card',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className="nums font-display text-4xl font-bold leading-none"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {suffix && <span className="text-sm font-medium text-ink-3">{suffix}</span>}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}
