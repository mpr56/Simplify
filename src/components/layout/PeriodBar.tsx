import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { useDashboard } from '@/store/useDashboard'
import { formatRange, rangeFor, toISO } from '@/lib/date'
import type { Period } from '@/data/types'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Tab list plus the range stepper. Must render inside <Tabs.Root>. */
export function PeriodBar() {
  const { state, actions, meta } = useDashboard()
  const { start, end } = rangeFor(state.period, state.anchor)
  const label = formatRange(state.period, state.anchor)

  // "Today" is only meaningful when the current range does not already hold it.
  const holdsToday = toISO(start) <= meta.todayISO && meta.todayISO <= toISO(end)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs.List label="Progress period">
        {PERIODS.map((period) => (
          <Tabs.Trigger key={period.value} value={period.value}>
            {period.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => actions.stepAnchor(-1)}
          aria-label={`Previous ${state.period === 'daily' ? 'day' : state.period.replace('ly', '')}`}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>

        <span
          aria-live="polite"
          className="min-w-40 text-center text-sm font-medium text-ink-2"
        >
          {label}
        </span>

        <button
          type="button"
          onClick={() => actions.stepAnchor(1)}
          aria-label={`Next ${state.period === 'daily' ? 'day' : state.period.replace('ly', '')}`}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>

        {!holdsToday && (
          <button
            type="button"
            onClick={actions.goToToday}
            className="ml-1 h-9 cursor-pointer rounded-lg border border-line px-3 text-sm font-medium text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink"
          >
            Today
          </button>
        )}
      </div>
    </div>
  )
}
