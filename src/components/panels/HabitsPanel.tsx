import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { HabitForm } from './HabitForm'
import { useDashboard } from '@/store/useDashboard'
import { filterHabits, habitStats, sliceRange, stepsDoneOn } from '@/lib/selectors'
import { categoryColor } from '@/lib/colors'
import { addDays, toISO } from '@/lib/date'
import type { HabitStep } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * One slot of a split habit. A labelled slot shows its initial and carries the
 * full label on hover — four boxes reading D/O/M/Z is the difference between
 * knowing which pill you took and guessing.
 */
function StepBox({
  step,
  index,
  count,
  habitName,
  color,
  done,
  disabled,
  onToggle,
}: {
  step: HabitStep
  index: number
  count: number
  habitName: string
  color: string
  done: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const label = step.label?.trim()
  // An unsplit habit names only itself: "Gym session — 1 of 1" says nothing.
  const which = count === 1 ? '' : ` — ${label || `${index + 1} of ${count}`}`
  const state = disabled ? 'upcoming' : done ? 'done' : 'not done'
  const title = `${habitName}${which}: ${state}`

  return (
    // The hit area is the button; the 22px box inside it is the drawing, sized
    // to match `CheckBox` exactly so a one-tick habit and a split one line up.
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={done}
      style={{ '--c': color } as React.CSSProperties}
      className={cn(
        'group/step flex h-9 w-7 shrink-0 items-center justify-center focus:outline-none',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border-2',
          'text-[10px] font-semibold leading-none transition-colors duration-200',
          'border-[var(--c)] group-focus-visible/step:outline',
          'group-focus-visible/step:outline-2 group-focus-visible/step:outline-offset-2',
          'group-focus-visible/step:outline-accent-soft',
          done ? 'bg-[var(--c)] text-canvas' : 'bg-transparent text-[var(--c)]',
          disabled && 'opacity-40',
          !done && !disabled && 'group-hover/step:bg-[var(--c)]/15',
        )}
      >
        {label ? label[0].toUpperCase() : ''}
      </span>
    </button>
  )
}

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
                steps: editing.steps,
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
              const steps = habit.steps
              const split = steps.length > 1
              const doneToday = stepsDoneOn(habit, iso)
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
                      {/* The header already names the day, so the per-day count
                          does not have to repeat it. */}
                      {split && `${doneToday}/${steps.length} done · `}
                      {completed}/{target} this week
                    </p>
                  </div>

                  {/* One box or twelve, they all render through StepBox — a
                      split habit whose ticks were a different size from an
                      unsplit one read as a different kind of control. */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {steps.map((step, index) => (
                      <StepBox
                        key={step.id}
                        step={step}
                        index={index}
                        count={steps.length}
                        habitName={habit.name}
                        color={color}
                        done={(habit.history[iso] ?? []).includes(step.id)}
                        disabled={isFuture}
                        onToggle={() => actions.toggleHabit(habit.id, iso, step.id)}
                      />
                    ))}
                  </div>
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
