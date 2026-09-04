import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { BarSeries } from '@/components/charts/BarSeries'
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

export function WeeklyView() {
  const { state, meta } = useDashboard()
  const habits = filterHabits(state.data.habits, state.query)

  const { slices, stats, macros, rate } = useMemo(() => {
    const { start, end } = rangeFor('weekly', state.anchor)
    const range = sliceRange(state.data, start, end, meta.today)
    return {
      slices: range,
      stats: habitStats(habits, range),
      macros: macroSummary(range, state.data.macroTargets),
      rate: completionRate(range),
    }
  }, [state.data, state.anchor, habits, meta.today])

  const rangeLabel = formatRange('weekly', state.anchor)
  const totalDone = slices.reduce((sum, slice) => sum + slice.completed, 0)
  const best = slices.reduce(
    (top, slice) => (!slice.isFuture && slice.completed > top.completed ? slice : top),
    slices[0],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Completion rate"
          value={`${rate}%`}
          accent="var(--color-accent-soft)"
          hint="of tracked habit-days so far"
        />
        <StatTile label="Habits completed" value={totalDone} hint={rangeLabel} />
        <StatTile
          label="Best day"
          value={best?.date.toLocaleDateString(undefined, { weekday: 'short' }) ?? '—'}
          suffix={best ? `${best.completed}/${best.total}` : undefined}
        />
      </div>

      <Card.Root panelId="habits-per-day">
        <Card.Header>
          <Card.Title>Habits per day</Card.Title>
          <Card.Meta>{rangeLabel}</Card.Meta>
        </Card.Header>
        <Card.Body>
          <BarSeries
            color="var(--color-accent)"
            unit="habits done"
            max={state.data.habits.length}
            bars={slices.map((slice) => ({
              key: slice.iso,
              label: slice.date.toLocaleDateString(undefined, { weekday: 'narrow' }),
              title: slice.date.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }),
              value: slice.completed,
              muted: slice.isFuture,
            }))}
          />
        </Card.Body>
      </Card.Root>

      <div className="grid gap-4 lg:grid-cols-2">
        <HabitConsistencyPanel stats={stats} showStrip rangeLabel={rangeLabel} />
        <MacroTrendPanel
          summary={macros}
          rangeLabel={rangeLabel}
          tickFormat={(date) => date.toLocaleDateString(undefined, { weekday: 'short' })}
        />
      </div>

      <EpicsPanel />
      <GoalsPanel />
    </div>
  )
}
