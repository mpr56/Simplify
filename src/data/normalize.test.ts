import { describe, expect, it } from 'vitest'
import { normalizeData } from './normalize'

const TODAY = new Date(2026, 8, 4, 12, 0, 0)

/** A minimal but structurally valid stored document. */
function storedDocument(overrides: Record<string, unknown> = {}) {
  return {
    epics: [],
    goals: [],
    trash: [],
    habits: [],
    macros: {},
    macroTargets: { kcal: 2400, protein: 180, carbs: 250, fat: 70 },
    bookmarks: [],
    ...overrides,
  }
}

describe('normalizeData tasks migration', () => {
  it('migrates a document with no tasks key to an empty list, never to seed', () => {
    const result = normalizeData(storedDocument(), TODAY)
    expect(result.tasks).toEqual([])
  })

  it('seeds tasks only when there is no document at all', () => {
    const result = normalizeData(null, TODAY)
    expect(result.tasks.length).toBeGreaterThan(0)
  })

  it('keeps a valid task intact', () => {
    const result = normalizeData(
      storedDocument({
        tasks: [
          {
            id: 'task-1',
            title: 'Renew passport',
            dueAt: '2026-09-05T09:00:00.000Z',
            done: false,
            category: 'work',
            createdAt: '2026-09-01T08:00:00.000Z',
          },
        ],
      }),
      TODAY,
    )

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0]).toMatchObject({
      id: 'task-1',
      title: 'Renew passport',
      dueAt: '2026-09-05T09:00:00.000Z',
      done: false,
      category: 'work',
    })
  })

  it('drops an unparseable dueAt, leaving the task undated rather than rejecting it', () => {
    const result = normalizeData(
      storedDocument({
        tasks: [{ id: 'task-1', title: 'Vague', dueAt: 'next Tuesday-ish', done: false }],
      }),
      TODAY,
    )

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].dueAt).toBeUndefined()
  })

  it('clears completedAt when the task is not done', () => {
    const result = normalizeData(
      storedDocument({
        tasks: [
          {
            id: 'task-1',
            title: 'Reopened',
            done: false,
            completedAt: '2026-09-02T10:00:00.000Z',
          },
        ],
      }),
      TODAY,
    )

    expect(result.tasks[0].completedAt).toBeUndefined()
  })

  it('drops a category that is not a known category', () => {
    const result = normalizeData(
      storedDocument({
        tasks: [{ id: 'task-1', title: 'Odd', done: false, category: 'gardening' }],
      }),
      TODAY,
    )

    expect(result.tasks[0].category).toBeUndefined()
  })

  it('drops entries that are not task-shaped', () => {
    const result = normalizeData(
      storedDocument({ tasks: [null, 'nope', { title: 'no id' }, { id: 'task-ok', title: 'Fine', done: false }] }),
      TODAY,
    )

    expect(result.tasks.map((task) => task.id)).toEqual(['task-ok'])
  })

  it('leaves the other entities untouched', () => {
    const result = normalizeData(
      storedDocument({ tasks: [], macroTargets: { kcal: 2100, protein: 170, carbs: 210, fat: 60 } }),
      TODAY,
    )

    expect(result.macroTargets.kcal).toBe(2100)
    expect(result.goals).toEqual([])
  })
})
