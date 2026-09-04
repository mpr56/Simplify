import { X } from 'lucide-react'
import { CheckBox } from '@/components/ui/CheckBox'
import { Tag } from '@/components/ui/Tag'
import { useDashboard } from '@/store/useDashboard'
import { categoryColor } from '@/lib/colors'
import { formatDueLabel, urgencyOf, type TaskUrgency } from '@/lib/tasks'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * Uses only the status tokens reserved for this in index.css — never a series
 * colour. A left rail plus a tinted timestamp rather than a solid fill: on the
 * near-black surface a filled row destroys the title's contrast.
 */
const URGENCY_STYLES: Record<TaskUrgency, { rail: string; label: string; wash: string }> = {
  overdue: {
    rail: 'bg-critical',
    label: 'text-critical font-medium',
    wash: 'bg-critical/5',
  },
  soon: {
    rail: 'bg-warning',
    label: 'text-warning font-medium',
    wash: 'bg-warning/5',
  },
  upcoming: { rail: 'bg-transparent', label: 'text-ink-3', wash: '' },
  none: { rail: 'bg-transparent', label: 'text-ink-3', wash: '' },
}

export function TaskRow({ task, now }: { task: Task; now: number }) {
  const { actions } = useDashboard()
  const urgency = urgencyOf(task, now)
  const styles = URGENCY_STYLES[urgency]
  const dueLabel = task.dueAt ? formatDueLabel(task.dueAt, now) : ''

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-lg py-2.5 pr-1 pl-2 transition-colors duration-200',
        styles.wash,
      )}
    >
      <span aria-hidden="true" className={cn('h-8 w-0.5 shrink-0 rounded-full', styles.rail)} />

      <CheckBox
        checked={task.done}
        onChange={() => actions.toggleTask(task.id)}
        color={task.category ? categoryColor(task.category) : 'var(--color-accent-soft)'}
        label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm transition-colors duration-200',
            task.done ? 'text-ink-3 line-through' : 'text-ink',
          )}
        >
          {task.title}
        </p>
        {/* The label states the urgency in words, so colour is never the only cue. */}
        {dueLabel && !task.done && (
          <p className={cn('nums mt-0.5 truncate text-xs', styles.label)}>{dueLabel}</p>
        )}
      </div>

      {task.category && <Tag category={task.category} className="hidden shrink-0 sm:inline-flex" />}

      <button
        type="button"
        onClick={() => actions.removeTask(task.id)}
        aria-label={`Delete "${task.title}"`}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 opacity-100 transition-all duration-200 hover:bg-surface-3 hover:text-critical sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
