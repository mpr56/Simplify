import { useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  CATEGORY_LIST,
  GOAL_STATUSES,
  STATUS_LABELS,
  type CategoryId,
  type Epic,
  type Goal,
  type GoalStatus,
} from '@/data/types'

/**
 * Everything about a goal the user types. `id` and `createdAt` belong to the
 * store, so neither appears here.
 */
export type GoalDraft = Omit<Goal, 'id' | 'createdAt'>

/** Sentinel for "no long-term goal" — a select cannot hold `undefined`. */
const NO_EPIC = ''

/** Guards against a pasted 1e9 turning a progress bar into a layout bug. */
const MAX_SUBTASKS = 9999

/** Split out because the description is a textarea and must not inherit `h-10`. */
const FIELD_BASE =
  'rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'
const FIELD = `h-10 ${FIELD_BASE}`
const LABEL = 'text-xs font-medium text-ink-3'

/**
 * Half-typed and empty values are normal while editing — a field is only
 * forced into range on blur and on submit.
 */
function toInt(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Math.round(Number(raw))
  if (raw.trim() === '' || !Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export function GoalForm({
  initial,
  epics,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  /** Omitted when composing a new goal. */
  initial?: GoalDraft
  /** Long-term goals this one can roll up into. */
  epics: Epic[]
  submitLabel: string
  onSubmit: (draft: GoalDraft) => void
  onCancel: () => void
  /** Only passed when editing — a goal that does not exist yet cannot be deleted. */
  onDelete?: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'work')
  const [status, setStatus] = useState<GoalStatus>(initial?.status ?? 'todo')
  const [epicId, setEpicId] = useState<string>(initial?.epicId ?? NO_EPIC)
  const [due, setDue] = useState(initial?.due ?? '')
  const [subtasksDone, setSubtasksDone] = useState(String(initial?.subtasksDone ?? 0))
  const [subtasksTotal, setSubtasksTotal] = useState(String(initial?.subtasksTotal ?? 1))
  const [progress, setProgress] = useState(String(initial?.progress ?? 0))

  const total = toInt(subtasksTotal, 1, 1, MAX_SUBTASKS)
  const done = toInt(subtasksDone, 0, 0, total)
  const percent = toInt(progress, 0, 0, 100)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({
      title: trimmed,
      // Always present, for the same reason as `epicId` below: the draft is
      // merged over the stored goal, so a missing key would keep a
      // description the user just cleared.
      description: description.trim() || undefined,
      category,
      status,
      // Always present, never omitted: `updateGoal` merges the draft over the
      // stored goal, so a missing key would keep an epic the user just cleared.
      epicId: epicId === NO_EPIC ? undefined : epicId,
      due: due.trim() || 'no due date',
      subtasksDone: done,
      subtasksTotal: total,
      progress: percent,
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
            Goal
          </label>
          <input
            id={`${uid}-title`}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you working toward?"
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
          <label htmlFor={`${uid}-status`} className={LABEL}>
            Status
          </label>
          <select
            id={`${uid}-status`}
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
            className={`${FIELD} cursor-pointer px-2`}
          >
            {GOAL_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-due`} className={LABEL}>
            Due
          </label>
          <input
            id={`${uid}-due`}
            value={due}
            onChange={(event) => setDue(event.target.value)}
            placeholder="due Fri"
            className={`${FIELD} w-32`}
          />
        </div>

        <div className="flex flex-col gap-1">
          {/* Two inputs under one heading — each carries its own aria-label. */}
          <span className={LABEL}>Sub-tasks</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={total}
              aria-label="Sub-tasks done"
              value={subtasksDone}
              onChange={(event) => setSubtasksDone(event.target.value)}
              onBlur={() => setSubtasksDone(String(done))}
              className={`${FIELD} nums w-16 px-2`}
            />
            <span aria-hidden="true" className="text-sm text-ink-3">
              /
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SUBTASKS}
              aria-label="Sub-tasks total"
              value={subtasksTotal}
              onChange={(event) => setSubtasksTotal(event.target.value)}
              onBlur={() => setSubtasksTotal(String(total))}
              className={`${FIELD} nums w-16 px-2`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-epic`} className={LABEL}>
            Rolls up into
          </label>
          <select
            id={`${uid}-epic`}
            value={epicId}
            onChange={(event) => setEpicId(event.target.value)}
            className={`${FIELD} cursor-pointer px-2`}
          >
            <option value={NO_EPIC}>No long-term goal</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-description`} className={LABEL}>
          Description
        </label>
        {/* Enter must not submit here, unlike every other field on this form —
            a description is the one place a newline is the point. */}
        <textarea
          id={`${uid}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Why this matters, what done looks like, what it is waiting on…"
          className={`${FIELD_BASE} min-h-20 resize-y py-2 leading-snug`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${uid}-progress`} className={LABEL}>
          Progress
        </label>
        <input
          id={`${uid}-progress`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(event) => setProgress(event.target.value)}
          className="min-w-40 flex-1 cursor-pointer accent-accent"
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          aria-label="Progress percent"
          value={progress}
          onChange={(event) => setProgress(event.target.value)}
          onBlur={() => setProgress(String(percent))}
          className={`${FIELD} nums w-16 px-2`}
        />
        <span aria-hidden="true" className="text-sm text-ink-3">
          %
        </span>
        {/* Progress is weighted, not a task count — but matching the count is
            the common case, so it gets one click instead of arithmetic. */}
        <button
          type="button"
          onClick={() => setProgress(String(Math.round((done / total) * 100)))}
          className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-accent-soft transition-colors duration-200 hover:bg-surface-3"
        >
          match sub-tasks
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
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
    </form>
  )
}
