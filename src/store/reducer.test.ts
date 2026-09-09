import { describe, expect, it } from 'vitest'
import { reducer } from './reducer'
import type { DashboardData, Habit, Task } from '@/data/types'

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

const DAY = '2026-09-08'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Vitamins',
    category: 'health',
    targetPerWeek: 7,
    steps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    history: {},
    ...overrides,
  }
}

function withHabits(habits: Habit[]): DashboardData {
  return { ...state([]), habits }
}

describe('habit step actions', () => {
  it('ticks one step without touching its siblings', () => {
    const next = reducer(withHabits([habit()]), {
      type: 'toggleHabit',
      habitId: 'habit-1',
      date: DAY,
      stepId: 'b',
    })

    expect(next.habits[0].history[DAY]).toEqual(['b'])
  })

  it('unticks a step it already holds', () => {
    const next = reducer(withHabits([habit({ history: { [DAY]: ['a', 'b'] } })]), {
      type: 'toggleHabit',
      habitId: 'habit-1',
      date: DAY,
      stepId: 'a',
    })

    expect(next.habits[0].history[DAY]).toEqual(['b'])
  })

  it('drops the day entirely once its last step is unticked, keeping the map sparse', () => {
    const next = reducer(withHabits([habit({ history: { [DAY]: ['a'] } })]), {
      type: 'toggleHabit',
      habitId: 'habit-1',
      date: DAY,
      stepId: 'a',
    })

    expect(DAY in next.habits[0].history).toBe(false)
  })

  it('ignores a step the habit does not have', () => {
    const before = withHabits([habit()])
    const next = reducer(before, {
      type: 'toggleHabit',
      habitId: 'habit-1',
      date: DAY,
      stepId: 'nope',
    })

    expect(next.habits[0].history).toEqual({})
  })

  it('discards ticks belonging to steps removed by an update', () => {
    const next = reducer(
      withHabits([habit({ history: { [DAY]: ['a', 'b', 'c'] } })]),
      {
        type: 'updateHabit',
        habitId: 'habit-1',
        patch: { steps: [{ id: 'a' }] },
      },
    )

    expect(next.habits[0].history[DAY]).toEqual(['a'])
  })

  it('drops a day left with nothing after steps are removed', () => {
    const next = reducer(withHabits([habit({ history: { [DAY]: ['c'] } })]), {
      type: 'updateHabit',
      habitId: 'habit-1',
      patch: { steps: [{ id: 'a' }, { id: 'b' }] },
    })

    expect(DAY in next.habits[0].history).toBe(false)
  })

  it('leaves history alone when an update does not touch the steps', () => {
    const next = reducer(withHabits([habit({ history: { [DAY]: ['a'] } })]), {
      type: 'updateHabit',
      habitId: 'habit-1',
      patch: { name: 'Supplements' },
    })

    expect(next.habits[0].history[DAY]).toEqual(['a'])
    expect(next.habits[0].name).toBe('Supplements')
  })

  it('does not mutate the incoming state', () => {
    const before = withHabits([habit({ history: { [DAY]: ['a'] } })])
    reducer(before, { type: 'toggleHabit', habitId: 'habit-1', date: DAY, stepId: 'b' })
    expect(before.habits[0].history[DAY]).toEqual(['a'])
  })
})
