import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import { cn } from '@/lib/cn'

export interface Bar {
  key: string
  /** Axis tick under the bar. */
  label: string
  /** Full name used in the tooltip. */
  title: string
  value: number
  /** Rendered at reduced emphasis — a day that has not happened yet. */
  muted?: boolean
}

/**
 * Vertical bars anchored to a baseline, 4px rounded data-ends, 2px gaps.
 * One measure, one axis — a second measure gets its own chart.
 */
export function BarSeries({
  bars,
  max,
  color,
  unit,
  height = 128,
  className,
}: {
  bars: Bar[]
  max: number
  color: string
  unit: string
  height?: number
  className?: string
}) {
  const { tooltip, show, hide } = useChartTooltip()
  const safeMax = max > 0 ? max : 1

  return (
    <div className={cn('relative', className)} onPointerLeave={hide}>
      <ChartTooltip tooltip={tooltip} />
      <div className="flex items-end gap-0.5" style={{ height }}>
        {bars.map((bar) => {
          const pct = Math.max(0, Math.min(100, (bar.value / safeMax) * 100))
          return (
            <div
              key={bar.key}
              className="group relative flex h-full flex-1 cursor-default items-end"
              onPointerEnter={(event) => {
                const parent = event.currentTarget.offsetParent as HTMLElement | null
                const rect = event.currentTarget.getBoundingClientRect()
                const parentRect = parent?.getBoundingClientRect()
                show({
                  x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                  y: rect.top - (parentRect?.top ?? 0) + rect.height * (1 - pct / 100),
                  title: bar.title,
                  rows: [{ label: unit, value: String(bar.value), color }],
                })
              }}
            >
              {/* Full-height hit target: hovering anywhere in the column works. */}
              <div className="absolute inset-0 rounded-sm transition-colors duration-200 group-hover:bg-surface-2/60" />
              <div
                className="relative w-full rounded-t transition-[height] duration-300"
                style={{
                  height: `${pct}%`,
                  minHeight: bar.value > 0 ? 3 : 0,
                  backgroundColor: color,
                  opacity: bar.muted ? 0.3 : 1,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-0.5">
        {bars.map((bar) => (
          <span key={bar.key} className="flex-1 text-center text-[11px] text-ink-3">
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  )
}
