import { useId, useState } from 'react'
import { Columns3, Info, List, Pencil, Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CheckBox } from '@/components/ui/CheckBox'
import { Progress } from '@/components/ui/Progress'
import { StatusSelect } from '@/components/ui/StatusPill'
import { Tag } from '@/components/ui/Tag'
import { GoalForm, type GoalDraft } from './GoalForm'
import { useDashboard } from '@/store/useDashboard'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { filterGoals, standaloneGoals } from '@/lib/selectors'
import { categoryColor } from '@/lib/colors'
import {
  GOAL_STATUSES,
  STATUS_LABELS,
  type Epic,
  type Goal,
  type GoalStatus,
} from '@/data/types'
import { cn } from '@/lib/cn'

type ViewMode = 'list' | 'board'

function draftOf(goal: Goal): GoalDraft {
  return {
    title: goal.title,
    description: goal.description,
    category: goal.category,
    status: goal.status,
    epicId: goal.epicId,
    due: goal.due,
    subtasksDone: goal.subtasksDone,
    subtasksTotal: goal.subtasksTotal,
    progress: goal.progress,
  }
}

/**
 * The disclosure for `goal.description`. Rendered only when there is one to
 * show — an info control that opens onto nothing is worse than no control, and
 * it keeps the row from growing a permanent slot most goals leave empty.
 */
function InfoToggle({
  goal,
  expanded,
  panelId,
  onToggle,
}: {
  goal: Goal
  expanded: boolean
  panelId: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={`${expanded ? 'Hide' : 'Show'} description for "${goal.title}"`}
      title={expanded ? 'Hide description' : 'Show description'}
      className={cn(
        'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-surface-3 hover:text-ink',
        expanded ? 'text-accent-soft' : 'text-ink-3',
      )}
    >
      <Info aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  )
}

/** `whitespace-pre-wrap` so the paragraph breaks the user typed survive. */
function Description({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      id={id}
      className={cn(
        'whitespace-pre-wrap break-words border-l-2 border-line-strong bg-surface-2/60 px-3 py-2 text-sm leading-snug text-ink-2',
        'rounded-r-lg',
        className,
      )}
    >
      {children}
    </p>
  )
}

function RowActions({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { actions } = useDashboard()

  return (
    // Revealed on hover on pointer devices; on touch, where there is no hover,
    // they stay visible.
    <div className="flex shrink-0 items-center opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit "${goal.title}"`}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => actions.removeGoal(goal.id)}
        aria-label={`Delete "${goal.title}"`}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function GoalRow({
  goal,
  editing,
  expanded,
  onEdit,
  onToggleInfo,
}: {
  goal: Goal
  editing: boolean
  expanded: boolean
  onEdit: () => void
  onToggleInfo: () => void
}) {
  const { actions } = useDashboard()
  const color = categoryColor(goal.category)
  const done = goal.status === 'done'
  const descriptionId = useId()

  return (
    <div
      className={cn(
        'rounded-lg transition-colors duration-200',
        editing && 'bg-surface-2 ring-1 ring-accent/40',
      )}
    >
      <div className="group flex items-center gap-3 px-1 py-3.5">
        {/* The checkbox is the fast path for the common transition; the status
            control next to it covers the three states a checkbox cannot say. */}
        <CheckBox
          checked={done}
          onChange={() => actions.setGoalStatus(goal.id, done ? 'todo' : 'done')}
          color={color}
          label={`Mark "${goal.title}" ${done ? 'not done' : 'done'}`}
        />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate font-medium transition-colors duration-200',
              done ? 'text-ink-3 line-through' : 'text-ink',
            )}
          >
            {goal.title}
          </p>
          <p className="nums mt-0.5 truncate text-xs text-ink-3">
            {goal.subtasksDone}/{goal.subtasksTotal} sub-tasks · {goal.due}
          </p>
        </div>

        {goal.description && (
          <InfoToggle
            goal={goal}
            expanded={expanded}
            panelId={descriptionId}
            onToggle={onToggleInfo}
          />
        )}

        <StatusSelect
          status={goal.status}
          onChange={(status) => actions.setGoalStatus(goal.id, status)}
          label={`Status of "${goal.title}"`}
        />

        <Tag category={goal.category} className="hidden lg:inline-flex" />

        <div className="hidden w-28 shrink-0 sm:block">
          <Progress value={goal.progress} color={color} label={`${goal.title} progress`} />
        </div>

        <span className="nums w-11 shrink-0 text-right text-sm text-ink-2">
          {goal.progress}%
        </span>

        <RowActions goal={goal} onEdit={onEdit} />
      </div>

      {/* Indented to start under the title, not under the checkbox, so it
          reads as belonging to the goal rather than to the list. */}
      {expanded && goal.description && (
        <Description id={descriptionId} className="mb-3 ml-10 mr-1">
          {goal.description}
        </Description>
      )}
    </div>
  )
}

function GoalCard({
  goal,
  epic,
  editing,
  dragging,
  expanded,
  onEdit,
  onToggleInfo,
  onDragStart,
  onDragEnd,
}: {
  goal: Goal
  epic: Epic | undefined
  editing: boolean
  dragging: boolean
  expanded: boolean
  onEdit: () => void
  onToggleInfo: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const { actions } = useDashboard()
  const color = categoryColor(goal.category)
  const descriptionId = useId()

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', goal.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-grab rounded-xl border border-line bg-surface-2 p-3 transition-colors duration-200 active:cursor-grabbing',
        editing && 'ring-1 ring-accent/40',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            'min-w-0 flex-1 text-sm font-medium',
            goal.status === 'done' ? 'text-ink-3 line-through' : 'text-ink',
          )}
        >
          {goal.title}
        </p>
        {goal.description && (
          <InfoToggle
            goal={goal}
            expanded={expanded}
            panelId={descriptionId}
            onToggle={onToggleInfo}
          />
        )}
        <RowActions goal={goal} onEdit={onEdit} />
      </div>

      {epic && (
        <p className="mt-1 truncate text-xs text-ink-3" title={epic.title}>
          ↳ {epic.title}
        </p>
      )}

      {expanded && goal.description && (
        <Description id={descriptionId} className="mt-2">
          {goal.description}
        </Description>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <Progress
          value={goal.progress}
          color={color}
          label={`${goal.title} progress`}
          className="flex-1"
        />
        <span className="nums shrink-0 text-xs text-ink-2">{goal.progress}%</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Tag category={goal.category} />
        <span className="nums truncate text-xs text-ink-3">{goal.due}</span>
      </div>

      {/* Drag is pointer-only; the select is how the card moves by keyboard. */}
      <StatusSelect
        status={goal.status}
        onChange={(status) => actions.setGoalStatus(goal.id, status)}
        label={`Status of "${goal.title}"`}
        className="mt-2.5"
      />
    </article>
  )
}

function BoardColumn({
  status,
  goals,
  epicOf,
  editingId,
  draggingId,
  expandedIds,
  isDropTarget,
  onEdit,
  onToggleInfo,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: GoalStatus
  goals: Goal[]
  epicOf: (goal: Goal) => Epic | undefined
  editingId: string | null
  draggingId: string | null
  expandedIds: ReadonlySet<string>
  isDropTarget: boolean
  onEdit: (goalId: string) => void
  onToggleInfo: (goalId: string) => void
  onDragStart: (goalId: string) => void
  onDragEnd: () => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
}) {
  return (
    <section
      aria-label={STATUS_LABELS[status]}
      onDragOver={(event) => {
        // Without preventDefault the browser refuses the drop outright.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
      className={cn(
        // Share the width when the panel has room; scroll the row only once
        // the columns would go narrower than a card can read.
        'flex min-w-52 flex-1 flex-col rounded-xl border border-line bg-surface-1/60 p-2 transition-colors duration-200',
        isDropTarget && 'border-accent/60 bg-accent/5',
      )}
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
          {STATUS_LABELS[status]}
        </h3>
        <span className="nums text-xs text-ink-3">{goals.length}</span>
      </header>

      <div className="flex flex-col gap-2">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            epic={epicOf(goal)}
            editing={editingId === goal.id}
            dragging={draggingId === goal.id}
            expanded={expandedIds.has(goal.id)}
            onEdit={() => onEdit(goal.id)}
            onToggleInfo={() => onToggleInfo(goal.id)}
            onDragStart={() => onDragStart(goal.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {goals.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-ink-3">
            {isDropTarget ? 'Drop here' : 'Nothing here'}
          </p>
        )}
      </div>
    </section>
  )
}

export function GoalsPanel({ className }: { className?: string }) {
  const { state, actions } = useDashboard()
  const [mode, setMode] = useLocalStorage<ViewMode>('goalView', 'list')
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<GoalStatus | null>(null)
  // A set rather than one open id: comparing two goals' notes is the reason
  // you open them at all, and closing one to read the next defeats that.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set())

  const toggleInfo = (goalId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (!next.delete(goalId)) next.add(goalId)
      return next
    })
  }

  const { epics } = state.data
  const goals = filterGoals(state.data.goals, state.query)
  const editing = goals.find((goal) => goal.id === editingId) ?? null
  const epicOf = (goal: Goal) => epics.find((epic) => epic.id === goal.epicId)

  // One editor slot at the top rather than an inline one per row: it is the
  // only place a form of this size fits in both the list and a board column.
  const startComposing = () => {
    setEditingId(null)
    setComposing((open) => !open)
  }

  const startEditing = (goalId: string) => {
    setComposing(false)
    setEditingId(goalId)
  }

  const drop = (status: GoalStatus) => {
    if (draggingId) actions.setGoalStatus(draggingId, status)
    setDraggingId(null)
    setDropTarget(null)
  }

  /** Epic groups, then the standalone goals. Empty groups are not rendered. */
  const groups: { epic: Epic | null; goals: Goal[] }[] = [
    ...epics.map((epic) => ({
      epic,
      goals: goals.filter((goal) => goal.epicId === epic.id),
    })),
    { epic: null, goals: standaloneGoals(goals, epics) },
  ].filter((group) => group.goals.length > 0)

  return (
    <Card.Root panelId="goals" className={className}>
      <Card.Header>
        <Card.Title>Goals</Card.Title>

        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label="Goal layout"
            className="mr-1 flex items-center rounded-lg border border-line p-0.5"
          >
            {(
              [
                { id: 'list', icon: List, label: 'List' },
                { id: 'board', icon: Columns3, label: 'Board' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={mode === option.id}
                title={`${option.label} view`}
                className={cn(
                  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200',
                  mode === option.id
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-3 hover:text-ink',
                )}
              >
                <option.icon aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">{option.label} view</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={startComposing}
            aria-expanded={composing}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-accent-soft transition-colors duration-200 hover:bg-surface-2"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            new goal
          </button>
        </div>
      </Card.Header>

      <Card.Body>
        {composing && (
          <div className="mb-3">
            <GoalForm
              epics={epics}
              submitLabel="Add goal"
              onSubmit={(draft) => {
                actions.addGoal(draft)
                setComposing(false)
              }}
              onCancel={() => setComposing(false)}
            />
          </div>
        )}

        {editing && (
          <div className="mb-3">
            <GoalForm
              key={editing.id}
              initial={draftOf(editing)}
              epics={epics}
              submitLabel="Save"
              onSubmit={(draft) => {
                actions.updateGoal(editing.id, draft)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
              onDelete={() => {
                actions.removeGoal(editing.id)
                setEditingId(null)
              }}
            />
          </div>
        )}

        {goals.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">
            {state.query
              ? `No goals match "${state.query}".`
              : 'No goals yet — add your first one.'}
          </p>
        ) : mode === 'board' ? (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {GOAL_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                goals={goals.filter((goal) => goal.status === status)}
                epicOf={epicOf}
                editingId={editingId}
                draggingId={draggingId}
                expandedIds={expandedIds}
                isDropTarget={dropTarget === status}
                onEdit={startEditing}
                onToggleInfo={toggleInfo}
                onDragStart={setDraggingId}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDropTarget(null)
                }}
                onDragOver={() => setDropTarget(status)}
                onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
                onDrop={() => drop(status)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <section key={group.epic?.id ?? 'standalone'}>
                <h3 className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {group.epic ? group.epic.title : 'No long-term goal'}
                  <span className="nums font-normal normal-case tracking-normal">
                    {group.goals.filter((goal) => goal.status === 'done').length}/
                    {group.goals.length}
                  </span>
                </h3>
                <ul className="divide-y divide-line">
                  {group.goals.map((goal) => (
                    <li key={goal.id}>
                      <GoalRow
                        goal={goal}
                        editing={editingId === goal.id}
                        expanded={expandedIds.has(goal.id)}
                        onEdit={() => startEditing(goal.id)}
                        onToggleInfo={() => toggleInfo(goal.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card.Body>
    </Card.Root>
  )
}
