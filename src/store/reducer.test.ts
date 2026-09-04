import { describe, expect, it } from 'vitest'
import { reducer } from './reducer'
import type { DashboardData, Task } from '@/data/types'

const AT = '2026-09-04T12:00:00.000Z'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Renew passport',
    done: false,
    createdAt: '2026-09-01T08:00:00.000Z',
    ...overrides,
  }
}

function state(tasks: Task[]): DashboardData {
  return {
    epics: [],
    goals: [],
    tasks,
    trash: [],
    habits: [],
    macros: {},
    macroTargets: { kcal: 2400, protein: 180, carbs: 250, fat: 70 },
    bookmarks: [],
  }
}

describe('task actions', () => {
  it('appends a new task', () => {
    const next = reducer(state([]), { type: 'addTask', task: task() })
    expect(next.tasks).toHaveLength(1)
    expect(next.tasks[0].title).toBe('Renew passport')
  })

  it('merges a patch into the matching task only', () => {
    const next = reducer(state([task(), task({ id: 'task-2', title: 'Other' })]), {
      type: 'updateTask',
      taskId: 'task-1',
      patch: { title: 'Renew passport urgently' },
    })

    expect(next.tasks[0].title).toBe('Renew passport urgently')
    expect(next.tasks[1].title).toBe('Other')
  })

  it('sets completedAt when toggling a task done', () => {
    const next = reducer(state([task()]), { type: 'toggleTask', taskId: 'task-1', at: AT })
    expect(next.tasks[0].done).toBe(true)
    expect(next.tasks[0].completedAt).toBe(AT)
  })

  it('clears completedAt when toggling a task back to not done', () => {
    const done = task({ done: true, completedAt: AT })
    const next = reducer(state([done]), { type: 'toggleTask', taskId: 'task-1', at: AT })

    expect(next.tasks[0].done).toBe(false)
    expect(next.tasks[0].completedAt).toBeUndefined()
  })

  it('removes a task by id', () => {
    const next = reducer(state([task(), task({ id: 'task-2' })]), {
      type: 'removeTask',
      taskId: 'task-1',
    })

    expect(next.tasks.map((entry) => entry.id)).toEqual(['task-2'])
  })

  it('clears only completed tasks', () => {
    const next = reducer(
      state([task(), task({ id: 'task-2', done: true, completedAt: AT })]),
      { type: 'clearCompletedTasks' },
    )

    expect(next.tasks.map((entry) => entry.id)).toEqual(['task-1'])
  })

  it('does not mutate the incoming state', () => {
    const before = state([task()])
    reducer(before, { type: 'toggleTask', taskId: 'task-1', at: AT })
    expect(before.tasks[0].done).toBe(false)
  })
})
