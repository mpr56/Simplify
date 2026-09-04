import { useCallback, useState } from 'react'

export interface TooltipState {
  x: number
  y: number
  title: string
  rows: { label: string; value: string; color?: string }[]
}

export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const hide = useCallback(() => setTooltip(null), [])
  return { tooltip, show: setTooltip, hide }
}

/**
 * Positioned inside a `relative` chart container. Non-interactive so it can
 * never steal the pointer from the marks underneath it.
 */
export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-32 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface-2 px-2.5 py-2 shadow-pop"
      style={{ left: tooltip.x, top: tooltip.y - 8 }}
    >
      <p className="text-xs font-medium text-ink">{tooltip.title}</p>
      <ul className="mt-1 space-y-0.5">
        {tooltip.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-1.5 text-xs text-ink-2">
            {row.color && (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="flex-1 whitespace-nowrap">{row.label}</span>
            <span className="nums font-medium text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
