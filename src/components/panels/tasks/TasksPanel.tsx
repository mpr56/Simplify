import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useDashboard } from '@/store/useDashboard'
import { useNow } from '@/hooks/useNow'
import { overdueCount, sortTasks } from '@/lib/tasks'
import { TaskComposer } from './TaskComposer'
import { TaskRow } from './TaskRow'
import { cn } from '@/lib/cn'

export function TasksPanel({ className }: { className?: string }) {
  const { state, actions } = useDashboard()
  const now = useNow()
  const { tasks, goals } = state.data
  const query = state.query.trim().toLowerCase()
  const [editingId, setEditingId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const matching = query
      ? tasks.filter((task) => task.title.toLowerCase().includes(query))
      : tasks
    return sortTasks(matching)
  }, [tasks, query])

  const open = visible.filter((task) => !task.done).length
  const overdue = overdueCount(visible, now)
  const completed = visible.filter((task) => task.done).length

  return (
    <Card.Root panelId="tasks" className={cn('h-full', className)}>
      <Card.Header>
        <div className="flex min-w-0 items-baseline gap-2">
          <Card.Title>Tasks</Card.Title>
          <span className="nums shrink-0 text-xs text-ink-3">
            {open} open
            {overdue > 0 && <span className="text-critical"> · {overdue} overdue</span>}
          </span>
        </div>

        {completed > 0 && (
          <button
            type="button"
            onClick={actions.clearCompletedTasks}
            className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            clear completed
          </button>
        )}
      </Card.Header>

      <Card.Body>
        <TaskComposer />

        {visible.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">
            {state.query
              ? `No tasks match "${state.query}".`
              : 'Nothing due — add your first task.'}
          </p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((task) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  now={now}
                  goals={goals}
                  editing={editingId === task.id}
                  onEdit={() => setEditingId(task.id)}
                  onCancelEdit={() => setEditingId(null)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card.Root>
  )
}
