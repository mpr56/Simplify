import { useMemo } from 'react'
import { StatTile } from '@/components/ui/StatTile'
import { EpicsPanel } from '@/components/panels/EpicsPanel'
import { GoalsPanel } from '@/components/panels/GoalsPanel'
import { HabitsPanel } from '@/components/panels/HabitsPanel'
import { MacrosPanel } from '@/components/panels/MacrosPanel'
import { useDashboard } from '@/store/useDashboard'
import { useNow } from '@/hooks/useNow'
import { activeGoals, goalsByStatus, habitStreak, habitsDoneOn } from '@/lib/selectors'
import { overdueCount } from '@/lib/tasks'
import { toISO } from '@/lib/date'

export function DailyView() {
  const { state, meta } = useDashboard()
  const { data, anchor } = state
  const iso = toISO(anchor)

  const streak = useMemo(() => habitStreak(data.habits, meta.today), [data.habits, meta.today])
  const done = habitsDoneOn(data.habits, iso)
  const open = activeGoals(data.goals).length
  const blocked = goalsByStatus(data.goals, 'blocked').length
  const now = useNow()
  const overdue = overdueCount(data.tasks, now)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active goals" value={open} />
        {/* Overdue earns a tile for the same reason Blocked does: it is the
            number that should make you act today, and it hides inside a list. */}
        <StatTile
          label="Overdue"
          value={overdue}
          accent={overdue ? 'var(--color-critical)' : undefined}
          hint={overdue ? 'past due' : 'nothing late'}
        />
        {/* Blocked earns a tile of its own: it is the number that should make
            you do something today, and it hides inside a list. */}
        <StatTile
          label="Blocked"
          value={blocked}
          accent={blocked ? 'var(--color-warning)' : undefined}
          hint={blocked ? 'waiting on something' : 'nothing stuck'}
        />
        <StatTile
          label="Day streak"
          value={streak}
          suffix="days"
          accent="var(--color-accent-soft)"
        />
        <StatTile label="Habits done" value={done} suffix={`/${data.habits.length}`} />
      </div>

      <EpicsPanel />
      <GoalsPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <HabitsPanel />
        <MacrosPanel />
      </div>
    </div>
  )
}
