import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { DayDots } from '@/components/charts/DayDots'
import { categoryColor } from '@/lib/colors'
import type { HabitPeriodStat } from '@/lib/selectors'

/**
 * Per-habit adherence for the active range. The 7-day strip is only shown for
 * week-length ranges — 31 cells in a row would be unreadable, and the month
 * view has the heatmap for that.
 */
export function HabitConsistencyPanel({
  stats,
  showStrip,
  rangeLabel,
  className,
}: {
  stats: HabitPeriodStat[]
  showStrip: boolean
  rangeLabel: string
  className?: string
}) {
  return (
    <Card.Root panelId="habit-consistency" className={className}>
      <Card.Header>
        <Card.Title>Habit consistency</Card.Title>
        <Card.Meta>{rangeLabel}</Card.Meta>
      </Card.Header>

      <Card.Body>
        {stats.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">No habits to show.</p>
        ) : (
          <ul className="space-y-4 pt-1">
            {stats.map(({ habit, days, completed, target, adherence }) => {
              const color = categoryColor(habit.category)
              return (
                <li key={habit.id}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-[4px]"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {habit.name}
                    </span>
                    <span className="nums shrink-0 text-sm text-ink-2">
                      {completed}
                      <span className="text-ink-3">/{target}</span>
                    </span>
                    <span className="nums w-11 shrink-0 text-right text-sm font-medium text-ink">
                      {adherence}%
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={adherence}
                      color={color}
                      label={`${habit.name} adherence`}
                    />
                    {showStrip && (
                      <DayDots
                        days={days}
                        color={color}
                        habitName={habit.name}
                        className="shrink-0"
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card.Body>
    </Card.Root>
  )
}
