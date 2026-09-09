import { useId, useState } from 'react'
import { ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { StatusPill } from '@/components/ui/StatusPill'
import { Tag } from '@/components/ui/Tag'
import { useDashboard } from '@/store/useDashboard'
import { epicRollups, filterEpics, type EpicRollup } from '@/lib/selectors'
import { categoryColor } from '@/lib/colors'
import { CATEGORY_LIST, type CategoryId, type Epic } from '@/data/types'
import { cn } from '@/lib/cn'

type EpicDraft = Omit<Epic, 'id' | 'createdAt'>

const FIELD =
  'h-10 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'
const LABEL = 'text-xs font-medium text-ink-3'

function EpicForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: EpicDraft
  submitLabel: string
  onSubmit: (draft: EpicDraft) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? 'work')
  const [due, setDue] = useState(initial?.due ?? '')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({ title: trimmed, category, due: due.trim() || 'no due date' })
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-line-strong bg-surface-2 p-3"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <label htmlFor={`${uid}-title`} className={LABEL}>
          Long-term goal
        </label>
        <input
          id={`${uid}-title`}
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Where is all of this going?"
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
        <label htmlFor={`${uid}-due`} className={LABEL}>
          Horizon
        </label>
        <input
          id={`${uid}-due`}
          value={due}
          onChange={(event) => setDue(event.target.value)}
          placeholder="due 2027"
          className={`${FIELD} w-32`}
        />
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
            title="Its goals are kept and become standalone"
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>
    </form>
  )
}

function EpicRow({ rollup, onEdit }: { rollup: EpicRollup; onEdit: () => void }) {
  const { actions } = useDashboard()
  const [open, setOpen] = useState(false)
  const { epic, goals, done, blocked, progress, status } = rollup
  const color = categoryColor(epic.category)

  return (
    <div className="group py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} goals under "${epic.title}"`}
          disabled={goals.length === 0}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink disabled:cursor-default disabled:opacity-30 sm:order-1"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
        </button>

        <div className="min-w-0 flex-1 sm:order-2">
          <p
            className={cn(
              'line-clamp-2 font-medium sm:line-clamp-1',
              status === 'done' ? 'text-ink-3 line-through' : 'text-ink',
            )}
          >
            {epic.title}
          </p>
          <p className="nums mt-0.5 truncate text-xs text-ink-3">
            {goals.length === 0
              ? `no goals yet · ${epic.due}`
              : `${done}/${goals.length} goals${blocked ? ` · ${blocked} blocked` : ''} · ${epic.due}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center opacity-100 transition-opacity duration-200 sm:order-4 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit "${epic.title}"`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
          >
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => actions.removeEpic(epic.id)}
            aria-label={`Delete "${epic.title}"`}
            title="Its goals are kept and become standalone"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* `pl-10` lines the group up under the title, matching the sub-list. */}
        <div className="flex w-full min-w-0 items-center gap-2 pl-10 sm:order-3 sm:w-auto sm:pl-0">
          <StatusPill status={status} />
          <Tag category={epic.category} className="sm:hidden lg:inline-flex" />

          <div className="min-w-0 flex-1 sm:w-28 sm:flex-none">
            <Progress value={progress} color={color} label={`${epic.title} progress`} />
          </div>

          <span className="nums w-11 shrink-0 text-right text-sm text-ink-2">
            {progress}%
          </span>
        </div>
      </div>

      {open && goals.length > 0 && (
        <ul className="mt-2 ml-10 flex flex-col gap-1.5 border-l border-line pl-3">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  goal.status === 'done' ? 'text-ink-3 line-through' : 'text-ink-2',
                )}
              >
                {goal.title}
              </span>
              <span className="nums shrink-0 text-xs text-ink-3">{goal.progress}%</span>
              <StatusPill status={goal.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function EpicsPanel({ className }: { className?: string }) {
  const { state, actions } = useDashboard()
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const epics = filterEpics(state.data.epics, state.data.goals, state.query)
  const rollups = epicRollups(epics, state.data.goals)
  const editing = epics.find((epic) => epic.id === editingId) ?? null
  const complete = rollups.filter((rollup) => rollup.status === 'done').length

  return (
    <Card.Root panelId="epics" className={className}>
      <Card.Header>
        <Card.Title>Long-term goals</Card.Title>
        <div className="flex items-center gap-3">
          {rollups.length > 0 && (
            <Card.Meta className="nums hidden sm:inline">
              {complete}/{rollups.length} complete
            </Card.Meta>
          )}
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
            <EpicForm
              submitLabel="Add"
              onSubmit={(draft) => {
                actions.addEpic(draft)
                setComposing(false)
              }}
              onCancel={() => setComposing(false)}
            />
          </div>
        )}

        {editing && (
          <div className="mb-3">
            <EpicForm
              key={editing.id}
              initial={{
                title: editing.title,
                category: editing.category,
                due: editing.due,
              }}
              submitLabel="Save"
              onSubmit={(draft) => {
                actions.updateEpic(editing.id, draft)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
              onDelete={() => {
                actions.removeEpic(editing.id)
                setEditingId(null)
              }}
            />
          </div>
        )}

        {rollups.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">
            {state.query
              ? `No long-term goals match "${state.query}".`
              : 'Nothing long-term yet — add one, then point goals at it.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rollups.map((rollup) => (
              <li key={rollup.epic.id}>
                <EpicRow
                  rollup={rollup}
                  onEdit={() => {
                    setComposing(false)
                    setEditingId(rollup.epic.id)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card.Root>
  )
}
