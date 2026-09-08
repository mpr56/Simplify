import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CheckBox } from '@/components/ui/CheckBox'
import { HabitForm } from './HabitForm'
import { useDashboard } from '@/store/useDashboard'
import { filterHabits, habitStats, sliceRange } from '@/lib/selectors'
import { categoryColor } from '@/lib/colors'
import { addDays, toISO } from '@/lib/date'

/**
 * One tick box per habit for the anchored day — this panel lives in the Daily
 * view, where the job is to check today off, and a 7-day strip made you aim at
 * the right cell out of seven to do it. The rolling week count stays as the
 * context the single box cannot carry on its own.
 */
export function HabitsPanel({ className }: { className?: string }) {
  const { state, actions, meta } = useDashboard()
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const habits = filterHabits(state.data.habits, state.query)
  const editing = habits.find((habit) => habit.id === editingId) ?? null

  const iso = toISO(state.anchor)
  const isFuture = iso > meta.todayISO
  const dayLabel =
    iso === meta.todayISO
      ? 'today'
      : state.anchor.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })

  const stats = useMemo(() => {
    const end = state.anchor
    const start = addDays(end, -6)
    const slices = sliceRange(state.data, start, end, meta.today)
    return habitStats(habits, slices)
  }, [state.data, state.anchor, habits, meta.today])

  return (
    <Card.Root panelId="habits" className={className}>
      <Card.Header>
        <Card.Title>Habits</Card.Title>
        <div className="flex items-center gap-3">
          <Card.Meta className="hidden sm:inline">{dayLabel}</Card.Meta>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setComposing((open) => !open)
            }}
            aria-expanded={composing}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-accent-soft transition-colors duration-200 hover:bg-surface-2"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            new
          </button>
        </div>
      </Card.Header>

      <Card.Body>
        {composing && (
          <div className="mb-3">
            <HabitForm
              submitLabel="Add habit"
              onSubmit={(draft) => {
                actions.addHabit(draft)
                setComposing(false)
              }}
              onCancel={() => setComposing(false)}
            />
          </div>
        )}

        {editing && (
          <div className="mb-3">
            <HabitForm
              key={editing.id}
              initial={{
                name: editing.name,
                category: editing.category,
                targetPerWeek: editing.targetPerWeek,
              }}
              submitLabel="Save"
              loggedDays={Object.keys(editing.history).length}
              onSubmit={(draft) => {
                actions.updateHabit(editing.id, draft)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
              onDelete={() => {
                actions.removeHabit(editing.id)
                setEditingId(null)
              }}
            />
          </div>
        )}

        {stats.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">
            {state.query
              ? `No habits match “${state.query}”.`
              : 'No habits yet — add one to start a streak.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {stats.map(({ habit, completed, target }) => {
              const color = categoryColor(habit.category)
              const done = Boolean(habit.history[iso])
              return (
                <li key={habit.id} className="group flex items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 rounded-lg"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
                    <p className="nums text-xs text-ink-3">
                      {completed}/{target} this week
                    </p>
                  </div>
                  <CheckBox
                    checked={done}
                    onChange={() => actions.toggleHabit(habit.id, iso)}
                    color={color}
                    disabled={isFuture}
                    label={
                      isFuture
                        ? `"${habit.name}" on ${dayLabel} — upcoming`
                        : `Mark "${habit.name}" ${done ? 'not done' : 'done'} ${dayLabel === 'today' ? 'today' : `on ${dayLabel}`}`
                    }
                    className="mr-1 shrink-0"
                  />
                  {/* Revealed on hover on pointer devices; on touch, where there
                      is no hover, it stays visible. */}
                  <button
                    type="button"
                    onClick={() => {
                      setComposing(false)
                      setEditingId(habit.id)
                    }}
                    aria-label={`Edit "${habit.name}"`}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 opacity-100 transition-opacity duration-200 hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card.Body>
    </Card.Root>
  )
}
