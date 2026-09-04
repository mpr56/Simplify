import { DAY_INITIALS } from '@/lib/date'
import type { DaySlice } from '@/lib/selectors'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'

/** Sequential = one hue, dim -> bright against the dark surface. */
function cellColor(completed: number, total: number): string {
  if (completed === 0) return 'var(--color-surface-3)'
  const ratio = total > 0 ? completed / total : 0
  const mix = 30 + Math.round(ratio * 70)
  return `color-mix(in oklab, var(--color-accent) ${mix}%, var(--color-surface-3))`
}

/**
 * Calendar grid of daily habit completion. Cells are padded to a Monday start
 * so weekday columns line up with the header.
 */
export function MonthHeatmap({ slices }: { slices: DaySlice[] }) {
  const { tooltip, show, hide } = useChartTooltip()
  if (!slices.length) return null

  const leadingBlanks = (slices[0].date.getDay() + 6) % 7

  return (
    <div className="relative" onPointerLeave={hide}>
      <ChartTooltip tooltip={tooltip} />

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_INITIALS.map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            aria-hidden="true"
            className="pb-1 text-center text-[10px] font-medium text-ink-3"
          >
            {initial}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {slices.map((slice) => (
          <div
            key={slice.iso}
            className="aspect-square cursor-default rounded-md transition-transform duration-200 hover:ring-2 hover:ring-line-strong"
            style={{
              backgroundColor: slice.isFuture
                ? 'var(--color-surface-2)'
                : cellColor(slice.completed, slice.total),
              opacity: slice.isFuture ? 0.5 : 1,
            }}
            onPointerEnter={(event) => {
              const parent = event.currentTarget.offsetParent as HTMLElement | null
              const rect = event.currentTarget.getBoundingClientRect()
              const parentRect = parent?.getBoundingClientRect()
              show({
                x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                y: rect.top - (parentRect?.top ?? 0),
                title: slice.date.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }),
                rows: [
                  {
                    label: 'habits done',
                    value: slice.isFuture
                      ? '—'
                      : `${slice.completed}/${slice.total}`,
                    color: 'var(--color-accent)',
                  },
                ],
              })
            }}
          >
            <span className="sr-only">
              {slice.date.toLocaleDateString()}: {slice.completed} of {slice.total} habits
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-3">
        <span>Less</span>
        {[0, 1, 2, 3].map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className="h-3 w-3 rounded-[4px]"
            style={{ backgroundColor: cellColor(step, 3) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
