import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useDashboard } from '@/store/useDashboard'

/** `datetime-local` speaks local wall-clock time with no zone, e.g. 2026-09-04T18:00. */
function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function atTime(dayOffset: number, hours: number, minutes: number): string {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hours, minutes, 0, 0)
  return toLocalInputValue(date)
}

/** The three deadlines that cover most of what actually gets typed in. */
const QUICK_CHIPS = [
  { label: 'Today 18:00', value: () => atTime(0, 18, 0) },
  { label: 'Tomorrow 09:00', value: () => atTime(1, 9, 0) },
  { label: 'Next week', value: () => atTime(7, 9, 0) },
]

export function TaskComposer() {
  const { actions } = useDashboard()
  const [title, setTitle] = useState('')
  const [dueLocal, setDueLocal] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    // An empty input means no due date, not an invalid one.
    const parsed = dueLocal ? new Date(dueLocal) : null
    const dueAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined

    actions.addTask({ title: trimmed, ...(dueAt ? { dueAt } : {}) })
    setTitle('')
    setDueLocal('')
  }

  return (
    <form onSubmit={submit} className="mb-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor="task-title" className="sr-only">
          Task
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task…"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          aria-label="Add task"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor="task-due" className="sr-only">
          Due date and time
        </label>
        <input
          id="task-due"
          type="datetime-local"
          value={dueLocal}
          onChange={(event) => setDueLocal(event.target.value)}
          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink-2 focus:border-accent focus:outline-none"
        />
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setDueLocal(chip.value())}
            className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-xs text-ink-3 transition-colors duration-200 hover:border-accent-soft hover:text-ink"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </form>
  )
}
