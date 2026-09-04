import { useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CATEGORY_LIST, type CategoryId, type Habit } from '@/data/types'

/** History belongs to the habit's use, not its definition, so it is not edited here. */
export type HabitDraft = Omit<Habit, 'id' | 'history'>

/** One boolean per day is all the history can hold, so 7 is the real ceiling. */
const MAX_PER_WEEK = 7

const FIELD =
  'h-10 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'
const LABEL = 'text-xs font-medium text-ink-3'

export function HabitForm({
  initial,
  submitLabel,
  loggedDays,
  onSubmit,
  onCancel,
  onDelete,
}: {
  /** Omitted when composing a new habit. */
  initial?: HabitDraft
  submitLabel: string
  /** Days already logged, so a delete can say what it costs. */
  loggedDays?: number
  onSubmit: (draft: HabitDraft) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'gym')
  const [targetPerWeek, setTargetPerWeek] = useState(initial?.targetPerWeek ?? MAX_PER_WEEK)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, category, targetPerWeek })
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="flex flex-col gap-3 rounded-xl border border-line-strong bg-surface-2 p-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-name`} className={LABEL}>
            Habit
          </label>
          <input
            id={`${uid}-name`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="What are you keeping up?"
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-category`} className={LABEL}>
            Category
          </label>
          <select
            id={`${uid}-category`}
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryId)}
            className={`${FIELD} cursor-pointer px-2`}
          >
            {CATEGORY_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-target`} className={LABEL}>
            Target
          </label>
          {/* A select rather than a number field: the range is 1–7 and a
              typed-in 9 could never be hit, so it should not be offerable. */}
          <select
            id={`${uid}-target`}
            value={targetPerWeek}
            onChange={(event) => setTargetPerWeek(Number(event.target.value))}
            className={`${FIELD} cursor-pointer px-2`}
          >
            {Array.from({ length: MAX_PER_WEEK }, (_, index) => index + 1).map((times) => (
              <option key={times} value={times}>
                {times}× / week
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
        >
          Cancel
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>

      {/* Deleting a habit throws away logged days that cannot be reconstructed,
          so the cost is stated before the click, not after. */}
      {onDelete && Boolean(loggedDays) && (
        <p className="text-xs text-ink-3">
          Deleting also discards {loggedDays} logged {loggedDays === 1 ? 'day' : 'days'}.
        </p>
      )}
    </form>
  )
}
