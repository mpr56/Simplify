import { useId, useState } from 'react'
import { CATEGORY_LIST, type CategoryId, type Goal, type Task } from '@/data/types'

/** Everything about a task the user edits. `id`, `done`, `completedAt` and `createdAt` belong to the store. */
export type TaskDraft = Pick<Task, 'title' | 'dueAt' | 'category' | 'goalId' | 'description'>

/** Sentinel for "no goal" — a select cannot hold `undefined`. */
const NO_GOAL = ''
const NO_CATEGORY = ''

const FIELD_BASE =
  'rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'
const FIELD = `h-10 ${FIELD_BASE}`
const LABEL = 'text-xs font-medium text-ink-3'

/** `datetime-local` speaks local wall-clock time with no zone, e.g. 2026-09-04T18:00. */
function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function TaskForm({
  initial,
  goals,
  onSubmit,
  onCancel,
}: {
  initial: TaskDraft
  /** Goals this task can roll up into. */
  goals: Goal[]
  onSubmit: (draft: TaskDraft) => void
  onCancel: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState(initial.title)
  const [dueLocal, setDueLocal] = useState(toLocalInputValue(initial.dueAt))
  const [category, setCategory] = useState<CategoryId | typeof NO_CATEGORY>(
    initial.category ?? NO_CATEGORY,
  )
  const [goalId, setGoalId] = useState<string>(initial.goalId ?? NO_GOAL)
  const [description, setDescription] = useState(initial.description ?? '')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    const parsed = dueLocal ? new Date(dueLocal) : null
    const dueAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined

    onSubmit({
      title: trimmed,
      dueAt,
      category: category === NO_CATEGORY ? undefined : category,
      goalId: goalId === NO_GOAL ? undefined : goalId,
      description: goalId === NO_GOAL ? undefined : description.trim() || undefined,
    })
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
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-title`} className={LABEL}>
            Task
          </label>
          <input
            id={`${uid}-title`}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-due`} className={LABEL}>
            Due
          </label>
          <input
            id={`${uid}-due`}
            type="datetime-local"
            value={dueLocal}
            onChange={(event) => setDueLocal(event.target.value)}
            className={`${FIELD} px-2`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-category`} className={LABEL}>
            Category
          </label>
          <select
            id={`${uid}-category`}
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryId | typeof NO_CATEGORY)}
            className={`${FIELD} cursor-pointer px-2`}
          >
            <option value={NO_CATEGORY}>No category</option>
            {CATEGORY_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-40 flex-col gap-1">
          <label htmlFor={`${uid}-goal`} className={LABEL}>
            Part of goal
          </label>
          <select
            id={`${uid}-goal`}
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
            className={`${FIELD} cursor-pointer px-2`}
          >
            <option value={NO_GOAL}>No goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Only a task breaking down a goal gets technical enough to need notes. */}
      {goalId !== NO_GOAL && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-description`} className={LABEL}>
            Description
          </label>
          <textarea
            id={`${uid}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Implementation notes, acceptance criteria, what done looks like…"
            className={`${FIELD_BASE} min-h-20 resize-y py-2 leading-snug`}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
