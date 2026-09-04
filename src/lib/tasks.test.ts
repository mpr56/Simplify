import { describe, expect, it } from 'vitest'
import { SOON_MS, formatDueLabel, overdueCount, sortTasks, urgencyOf } from './tasks'
import type { Task } from '@/data/types'

const NOW = new Date(2026, 8, 4, 12, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Renew passport',
    done: false,
    createdAt: new Date(NOW - 3 * 24 * HOUR).toISOString(),
    ...overrides,
  }
}

/** A task due `offset` ms from NOW. */
function due(offset: number, overrides: Partial<Task> = {}): Task {
  return task({ dueAt: new Date(NOW + offset).toISOString(), ...overrides })
}

describe('urgencyOf', () => {
  it('is none for a task with no due date', () => {
    expect(urgencyOf(task(), NOW)).toBe('none')
  })

  it('is none for a done task even when it is long overdue', () => {
    expect(urgencyOf(due(-5 * HOUR, { done: true }), NOW)).toBe('none')
  })

  it('is overdue one millisecond past the due time', () => {
    expect(urgencyOf(due(-1), NOW)).toBe('overdue')
  })

  it('is soon, not overdue, exactly at the due time', () => {
    expect(urgencyOf(due(0), NOW)).toBe('soon')
  })

  it('is soon exactly at the SOON_MS boundary', () => {
    expect(urgencyOf(due(SOON_MS), NOW)).toBe('soon')
  })

  it('is upcoming one millisecond past the SOON_MS boundary', () => {
    expect(urgencyOf(due(SOON_MS + 1), NOW)).toBe('upcoming')
  })

  it('is none for an unparseable due date', () => {
    expect(urgencyOf(task({ dueAt: 'whenever' }), NOW)).toBe('none')
  })
})

describe('sortTasks', () => {
  it('puts not-done before done', () => {
    const order = sortTasks([
      due(HOUR, { id: 'done', done: true, completedAt: new Date(NOW).toISOString() }),
      due(HOUR, { id: 'open' }),
    ])

    expect(order.map((entry) => entry.id)).toEqual(['open', 'done'])
  })

  it('orders dated tasks ascending, so overdue comes first', () => {
    const order = sortTasks([
      due(2 * HOUR, { id: 'later' }),
      due(-3 * HOUR, { id: 'overdue' }),
      due(HOUR, { id: 'sooner' }),
    ])

    expect(order.map((entry) => entry.id)).toEqual(['overdue', 'sooner', 'later'])
  })

  it('puts undated tasks after every dated one', () => {
    const order = sortTasks([
      task({ id: 'undated' }),
      due(30 * 24 * HOUR, { id: 'far-off' }),
    ])

    expect(order.map((entry) => entry.id)).toEqual(['far-off', 'undated'])
  })

  it('orders undated tasks newest-created first', () => {
    const order = sortTasks([
      task({ id: 'older', createdAt: new Date(NOW - 5 * HOUR).toISOString() }),
      task({ id: 'newer', createdAt: new Date(NOW - 1 * HOUR).toISOString() }),
    ])

    expect(order.map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('orders done tasks most-recently-completed first', () => {
    const order = sortTasks([
      task({ id: 'first', done: true, completedAt: new Date(NOW - 5 * HOUR).toISOString() }),
      task({ id: 'last', done: true, completedAt: new Date(NOW - 1 * HOUR).toISOString() }),
    ])

    expect(order.map((entry) => entry.id)).toEqual(['last', 'first'])
  })

  it('does not mutate the input array', () => {
    const input = [due(2 * HOUR, { id: 'later' }), due(-HOUR, { id: 'overdue' })]
    sortTasks(input)
    expect(input.map((entry) => entry.id)).toEqual(['later', 'overdue'])
  })
})

describe('overdueCount', () => {
  it('counts only overdue, not-done tasks', () => {
    const count = overdueCount(
      [
        due(-HOUR),
        due(-2 * HOUR),
        due(-HOUR, { done: true, completedAt: new Date(NOW).toISOString() }),
        due(HOUR),
        task(),
      ],
      NOW,
    )

    expect(count).toBe(2)
  })
})

describe('formatDueLabel', () => {
  // Only deterministic branches are asserted. The weekday and day-month
  // branches go through toLocaleDateString, whose output is locale-dependent.
  it('reports minutes remaining under an hour', () => {
    expect(formatDueLabel(new Date(NOW + 40 * MINUTE).toISOString(), NOW)).toBe('in 40m')
  })

  it('reports minutes overdue under an hour', () => {
    expect(formatDueLabel(new Date(NOW - 25 * MINUTE).toISOString(), NOW)).toBe('25m overdue')
  })

  it('reports hours remaining under twelve hours', () => {
    expect(formatDueLabel(new Date(NOW + 3 * HOUR).toISOString(), NOW)).toBe('in 3h')
  })

  it('reports hours overdue under twelve hours', () => {
    expect(formatDueLabel(new Date(NOW - 3 * HOUR).toISOString(), NOW)).toBe('3h overdue')
  })

  it('collapses the last minute to "due now"', () => {
    expect(formatDueLabel(new Date(NOW + 20_000).toISOString(), NOW)).toBe('due now')
  })

  it('names tomorrow with a zero-padded 24-hour time', () => {
    const tomorrow = new Date(2026, 8, 5, 9, 5, 0)
    expect(formatDueLabel(tomorrow.toISOString(), NOW)).toBe('tomorrow 09:05')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatDueLabel('whenever', NOW)).toBe('')
  })
})
