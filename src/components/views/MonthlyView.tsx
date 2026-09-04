import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { MonthHeatmap } from '@/components/charts/MonthHeatmap'
import { EpicsPanel } from '@/components/panels/EpicsPanel'
import { GoalsPanel } from '@/components/panels/GoalsPanel'
import { HabitConsistencyPanel } from '@/components/panels/HabitConsistencyPanel'
import { MacroTrendPanel } from '@/components/panels/MacroTrendPanel'
import { useDashboard } from '@/store/useDashboard'
import {
  completionRate,
  filterHabits,
  habitStats,
  macroSummary,
  sliceRange,
} from '@/lib/selectors'
import { formatRange, rangeFor } from '@/lib/date'

export function MonthlyView() {
  const { state, meta } = useDashboard()
  const habits = filterHabits(state.data.habits, state.query)

  const { slices, stats, macros, rate } = useMemo(() => {
    const { start, end } = rangeFor('monthly', state.anchor)
    const range = sliceRange(state.data, start, end, meta.today)
    return {
      slices: range,
      stats: habitStats(habits, range),
      macros: macroSummary(range, state.data.macroTargets),
      rate: completionRate(range),
    }
  }, [state.data, state.anchor, habits, meta.today])

  const rangeLabel = formatRange('monthly', state.anchor)
  const perfectDays = slices.filter(
    (slice) => !slice.isFuture && slice.total > 0 && slice.completed === slice.total,
  ).length
  const totalDone = slices.reduce((sum, slice) => sum + slice.completed, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Completion rate"
          value={`${rate}%`}
          accent="var(--color-accent-soft)"
          hint={rangeLabel}
        />
        <StatTile label="Perfect days" value={perfectDays} hint="every habit done" />
        <StatTile label="Habits completed" value={totalDone} hint={rangeLabel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card.Root panelId="consistency-map">
          <Card.Header>
            <Card.Title>Consistency map</Card.Title>
            <Card.Meta>{rangeLabel}</Card.Meta>
          </Card.Header>
          <Card.Body>
            <MonthHeatmap slices={slices} />
          </Card.Body>
        </Card.Root>

        <HabitConsistencyPanel
          stats={stats}
          showStrip={false}
          rangeLabel={rangeLabel}
        />
      </div>

      <MacroTrendPanel
        summary={macros}
        rangeLabel={rangeLabel}
        tickFormat={(date) => String(date.getDate())}
      />

      <EpicsPanel />
      <GoalsPanel />
    </div>
  )
}
