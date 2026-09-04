# Tasks Panel & Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the embedded Blue Hill iframe column with a first-class task list carrying real due dates and overdue/due-soon colouring, make the dashboard open without perceptible latency, and fix the currently-broken build.

**Architecture:** A new `Task` entity joins the single JSON document the dashboard already persists. All urgency and ordering logic lives in one pure module (`src/lib/tasks.ts`) so it is testable without rendering. Storage stays on the existing `/api/data` blob contract backed by Upstash Redis, gaining a content-hash `rev` for staleness detection and an edge runtime for cold-start-free opens.

**Tech Stack:** React 19, TypeScript 5.7 (strict, `noUnusedLocals`, `noUnusedParameters`), Vite 6, Tailwind CSS v4, lucide-react, Vitest 3, Upstash Redis REST, Vercel Functions (edge runtime).

**Spec:** `docs/superpowers/specs/2026-09-04-tasks-and-sync-design.md`

## Global Constraints

- **The build must pass at every commit.** `npm run build` runs `tsc --noEmit && vite build`. `noUnusedLocals` and `noUnusedParameters` are enabled (`tsconfig.json:16-17`), so an unused variable or parameter is a build failure, not a warning.
- **`normalizeData` must never fall back to seed data for `tasks`.** A stored document with no `tasks` key migrates to `[]`. Seeding here would inject demo tasks into a real document on first deploy.
- **Never encode state by colour alone.** Every urgency state ships text (`"3h overdue"`) alongside its colour, matching the existing convention in `src/components/ui/SyncBadge.tsx:4`.
- **Use only the reserved status tokens for urgency:** `--color-critical` (overdue) and `--color-warning` (soon), declared at `src/index.css:38-41`. Never a series colour.
- **The reducer stays pure.** Ids and timestamps are supplied by the caller, following `src/store/reducer.ts:14-18`.
- **Do not wire `useNow` into the period anchor.** `DashboardProvider` freezes `today` at mount by design (`src/store/DashboardProvider.tsx:33-35`). `useNow` feeds urgency and the badge only.
- **Timestamps:** `dueAt`, `completedAt`, and `createdAt` on `Task` are ISO 8601 **datetimes** (`ISODateTime`). The existing `ISODate` (`YYYY-MM-DD`) is unchanged and still used by habits, macros, goals, and epics.
- **Tests inject `now` explicitly.** No test reads the system clock.

## Prerequisite: git

This directory is not a git repository, so the commit step in each task will fail. Before Task 1, either run `git init && git add -A && git commit -m "chore: initial commit"`, or skip every commit step and commit once at the end. Do not silently skip commits without telling the user which option was taken.

---

## File Structure

**Created**
| File | Responsibility |
|---|---|
| `src/lib/tasks.ts` | Pure urgency, ordering, counting, and due-label formatting. No React. |
| `src/lib/tasks.test.ts` | Tests for the above. |
| `src/data/normalize.test.ts` | Tests for the `tasks` migration path. |
| `src/store/reducer.test.ts` | Tests for the five task actions. |
| `src/hooks/useNow.ts` | Ticking clock, visibility-aware. |
| `src/hooks/useTaskBadge.ts` | Tab title + canvas favicon badge. |
| `src/data/seed/tasks.json` | Hand-editable seed tasks, dated by day offset. |
| `src/components/panels/tasks/TaskComposer.tsx` | Add-a-task input, date picker, quick chips. |
| `src/components/panels/tasks/TaskRow.tsx` | One row: checkbox, title, due label, tag, actions. |
| `src/components/panels/tasks/TasksPanel.tsx` | Card shell, sorting, empty state, clear-completed. |

**Deleted**
| File | Reason |
|---|---|
| `src/components/panels/EmbedPanel.tsx` | Single use site, being replaced. |

**Modified** — `src/data/types.ts`, `src/data/normalize.ts`, `src/data/seed.ts`, `src/store/reducer.ts`, `src/store/context.ts`, `src/store/DashboardProvider.tsx`, `src/lib/sync.ts`, `src/lib/storage.ts`, `src/lib/colors.ts`, `src/lib/selectors.ts`, `src/components/layout/Dock.tsx`, `src/components/ui/SyncBadge.tsx`, `src/components/views/DailyView.tsx`, `src/App.tsx`, `src/index.css`, `src/main.tsx`, `index.html`, `api/data.ts`, `server/fileStore.ts`, `vite.config.ts`, `package.json`, `README.md`.

---

## Task 1: Fix the broken build by removing dead code

The build fails today. Nothing else can be verified until this passes.

**Files:**
- Modify: `src/components/layout/Dock.tsx:1-9, 115-205`
- Modify: `src/lib/storage.ts:29-35`
- Modify: `src/lib/selectors.ts:232`
- Modify: `src/lib/colors.ts:29`

**Interfaces:**
- Consumes: nothing.
- Produces: a passing `npm run typecheck`, which every later task depends on.

- [ ] **Step 1: Confirm the build is broken**

Run: `npm run typecheck`

Expected: FAIL with three `TS6133` errors in `src/components/layout/Dock.tsx` — `MAX_SCALE`, `RANGE`, and `index` declared but never read.

- [ ] **Step 2: Strip the dead magnification machinery from Dock**

The doc comment claims macOS-style magnification, but `scaleFor` ignores its `index` and returns `1` unconditionally, so no icon ever scales. Remove the effect rather than restore it.

Delete the `MAX_SCALE` and `RANGE` constants at the top of the file (keep `BASE_SIZE`). Then replace the `Dock` function (currently lines 120-205) with:

```tsx
/**
 * macOS-style bookmark dock. Hover labels are a pointer affordance only —
 * they float above the row and never affect layout or focus order.
 */
export function Dock() {
  const { state, actions } = useDashboard()
  const bookmarks = state.data.bookmarks
  const [adding, setAdding] = useState(false)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center pb-5">
      <div className="pointer-events-auto">{adding && <AddBookmarkForm onClose={() => setAdding(false)} />}</div>

      <nav
        aria-label="Bookmarks"
        // Scrolls only on small screens. At md+ overflow stays visible so
        // hover labels are never clipped.
        className="pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto rounded-full border border-white/10 bg-surface-1/70 px-3 py-2.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl md:overflow-visible"
      >
        <ul className="flex items-end gap-5">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="group relative flex flex-col items-center">
              {/* Label floats above; it must not push the row around */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-xs text-ink opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {bookmark.label}
              </span>

              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={bookmark.label}
                style={{ width: BASE_SIZE, height: BASE_SIZE }}
                className="block cursor-pointer rounded-[28%] border border-white/5 bg-surface-2/80"
              >
                <DockIcon bookmark={bookmark} />
              </a>

              <button
                type="button"
                onClick={() => actions.removeBookmark(bookmark.id)}
                aria-label={`Remove ${bookmark.label}`}
                className="absolute -top-1 -right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface-2 text-ink-3 opacity-0 transition-opacity duration-200 hover:text-critical focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
```

Then fix the imports on line 1 — `useEffect` and `useRef` are no longer used:

```tsx
import { useState } from 'react'
```

- [ ] **Step 3: Delete the three unreferenced exports**

Verified unreferenced across `src`, `api`, `server`, and `vite.config.ts`.

In `src/lib/storage.ts`, delete the whole `clearStored` function (lines 29-35).

In `src/lib/colors.ts`, delete line 29:
```ts
export type MacroKey = keyof typeof MACRO_COLORS
```

In `src/lib/selectors.ts`, delete the entire `categoryBreakdown` function beginning at line 232. If deleting it leaves an import unused at the top of the file, remove that import too — `noUnusedLocals` will tell you.

Do **not** touch `rollUpEpic` or `endOfMonth`: both are called inside their own modules. Do not touch `dashboardFileStore` — `vite.config.ts:4` imports it.

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`

Expected: PASS. `tsc --noEmit` reports nothing and `vite build` writes to `dist/`. If `tsc` reports a newly-unused import in `selectors.ts` or `Dock.tsx`, remove that import and re-run.

- [ ] **Step 5: Verify the dock still works**

Run: `npm run dev`, open `http://localhost:3000`.

Expected: bookmark icons render at a fixed size, hover shows the floating label, the remove button appears on hover, and the add form still opens. No icon magnification — that is the intended change.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Dock.tsx src/lib/storage.ts src/lib/colors.ts src/lib/selectors.ts
git commit -m "fix: remove dead code that was breaking the typecheck"
```

---

## Task 2: Add Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts:1-14`
- Create: `src/lib/tasks.test.ts` (temporary smoke test, replaced in Task 5)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest once and exits; `npm run test:watch` watches. Later tasks write `*.test.ts` files colocated with their targets.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^3.0.0
```

- [ ] **Step 2: Add the test scripts**

In `package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Point Vitest at the project**

Vitest reads `vite.config.ts`, so the `@` alias already resolves. Switch the `defineConfig` import to the Vitest one (a superset of Vite's) and add a `test` block. Replace the whole of `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dashboardFileStore } from './server/fileStore'

export default defineConfig({
  // The file store serves /api/data locally, so dev and preview persist to
  // data/dashboard.json instead of leaving edits in one browser.
  plugins: [react(), tailwindcss(), dashboardFileStore()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: { port: 3000 },
  test: {
    // Pure logic only — no DOM harness. Anything needing a document is a
    // sign the logic belongs in a lib module instead.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write a smoke test proving the runner and the alias work**

Create `src/lib/tasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toISO } from '@/lib/date'

describe('test setup', () => {
  it('resolves the @ alias', () => {
    expect(toISO(new Date(2026, 8, 4))).toBe('2026-09-04')
  })
})
```

- [ ] **Step 5: Run the tests**

Run: `npm test`

Expected: PASS, 1 test. If the `@` alias fails to resolve, the `resolve.alias` block did not carry over — re-check Step 3.

- [ ] **Step 6: Verify the build still passes**

Run: `npm run build`

Expected: PASS. `tsc` typechecks test files too, since they live under `src`, which `tsconfig.json:23` includes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/tasks.test.ts
git commit -m "chore: add vitest for pure logic tests"
```

---

## Task 3: The Task type and its normalisation

**Files:**
- Modify: `src/data/types.ts` (add `ISODateTime`, `Task`, extend `DashboardData`)
- Modify: `src/data/normalize.ts`
- Create: `src/data/normalize.test.ts`

**Interfaces:**
- Consumes: `isRecord`, `text`, `CATEGORIES` — existing helpers in `normalize.ts`.
- Produces:
  - `type ISODateTime = string`
  - `interface Task { id: string; title: string; dueAt?: ISODateTime; done: boolean; completedAt?: ISODateTime; category?: CategoryId; createdAt: ISODateTime }`
  - `DashboardData.tasks: Task[]`
  - `normalizeData(input: unknown, today: Date): DashboardData` — unchanged signature, now returning `tasks`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/normalize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- normalize`

Expected: FAIL — `result.tasks` is `undefined`, since `DashboardData` has no `tasks` yet.

- [ ] **Step 3: Add the types**

In `src/data/types.ts`, add below the `ISODate` declaration at the top:

```ts
/** ISO 8601 datetime with offset, e.g. `2026-09-04T15:00:00.000Z`. */
export type ISODateTime = string
```

Then add the `Task` interface, placed after `Goal` and before `Epic`:

```ts
/**
 * A dated to-do. Deliberately thinner than a `Goal`: no progress, no subtask
 * counts, no epic, and no status workflow — a task is done or it is not.
 * Goals remain the tracked-work layer; this is the one that has a deadline.
 */
export interface Task {
  id: string
  title: string
  /** Unset means "someday" — no urgency, and it sorts below dated work. */
  dueAt?: ISODateTime
  done: boolean
  /** Set when `done` flips true, cleared when unchecked. */
  completedAt?: ISODateTime
  /** Optional, unlike `Goal.category` — quick capture must not force a choice. */
  category?: CategoryId
  createdAt: ISODateTime
}
```

Then add `tasks` to `DashboardData`:

```ts
export interface DashboardData {
  epics: Epic[]
  goals: Goal[]
  tasks: Task[]
  trash: TrashEntry[]
  habits: Habit[]
  macros: Record<ISODate, MacroEntry>
  macroTargets: MacroTargets
  bookmarks: Bookmark[]
}
```

- [ ] **Step 4: Add the normaliser**

In `src/data/normalize.ts`, add `Task` to the type import list at the top, then add these three helpers after the existing `category` function (around line 40):

```ts
/** Returns a canonical ISO datetime, or undefined if it is not parseable. */
function isoDateTime(value: unknown): ISODateTime | undefined {
  if (typeof value !== 'string') return undefined
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString()
}

/** Unlike `category`, an unknown value drops to undefined rather than 'work'. */
function optionalCategory(value: unknown): CategoryId | undefined {
  return typeof value === 'string' && value in CATEGORIES ? (value as CategoryId) : undefined
}

function normalizeTask(input: unknown, nowISO: ISODateTime): Task | null {
  if (!isRecord(input) || typeof input.id !== 'string') return null

  const done = input.done === true
  const dueAt = isoDateTime(input.dueAt)
  // Repair the invariant on read: a task that is not done cannot have a
  // completion time, whatever the stored document claims.
  const completedAt = done ? isoDateTime(input.completedAt) : undefined
  const category = optionalCategory(input.category)

  return {
    id: input.id,
    title: text(input.title, 'Untitled'),
    ...(dueAt ? { dueAt } : {}),
    done,
    ...(completedAt ? { completedAt } : {}),
    ...(category ? { category } : {}),
    createdAt: isoDateTime(input.createdAt) ?? nowISO,
  }
}
```

Add `ISODateTime` to the type import list at the top of the file as well.

Then in `normalizeData`, add a `nowISO` alongside the existing `todayISO` (after line 171):

```ts
const nowISO = today.toISOString()
```

And add the `tasks` key to the returned object, immediately after `goals`:

```ts
    // A document predating tasks migrates to an empty list. Falling back to
    // `fallback.tasks` here would inject seed tasks into a real document.
    tasks: Array.isArray(candidate.tasks)
      ? candidate.tasks
          .map((task) => normalizeTask(task, nowISO))
          .filter((task): task is Task => task !== null)
      : [],
```

- [ ] **Step 5: Add tasks to the seed so `normalizeData(null)` returns some**

Create `src/data/seed/tasks.json`. `dueInDays` is an offset resolved at seed time, so a fresh install always demonstrates the overdue and due-soon states:

```json
[
  {
    "id": "task-seed-1",
    "title": "Renew car insurance",
    "dueInDays": -1,
    "dueTime": "17:00",
    "category": "money"
  },
  {
    "id": "task-seed-2",
    "title": "Reply to landlord",
    "dueInDays": 0,
    "dueTime": "23:30",
    "category": "work"
  },
  {
    "id": "task-seed-3",
    "title": "Book dentist",
    "dueInDays": 3,
    "dueTime": "09:00"
  }
]
```

In `src/data/seed.ts`, add the import beside the other seed imports:

```ts
import tasksSeed from './seed/tasks.json'
```

Add this interface beside the existing `HabitSeed`:

```ts
interface TaskSeed {
  id: string
  title: string
  /** Offset from today, resolved at seed time so samples never go stale. */
  dueInDays: number
  /** 24-hour `HH:MM`, local time. */
  dueTime: string
  category?: string
}
```

Add this builder function in the same file:

```ts
function buildTasks(today: Date): Task[] {
  return (tasksSeed as TaskSeed[]).map((seed) => {
    const [hours, minutes] = seed.dueTime.split(':').map(Number)
    const due = addDays(today, seed.dueInDays)
    due.setHours(hours, minutes, 0, 0)

    return {
      id: seed.id,
      title: seed.title,
      dueAt: due.toISOString(),
      done: false,
      ...(seed.category && seed.category in CATEGORIES
        ? { category: seed.category as CategoryId }
        : {}),
      createdAt: today.toISOString(),
    }
  })
}
```

Add `Task` and `CATEGORIES` to the imports at the top of `seed.ts`, then add `tasks: buildTasks(today),` to the object `createSeedData` returns.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- normalize`

Expected: PASS, 7 tests.

- [ ] **Step 7: Verify the build passes**

Run: `npm run build`

Expected: PASS. Any other file constructing a `DashboardData` literal will now fail for a missing `tasks` key — add `tasks: []` there.

- [ ] **Step 8: Commit**

```bash
git add src/data/
git commit -m "feat: add Task entity with normalisation and seed data"
```

---

## Task 4: Reducer actions for tasks

**Files:**
- Modify: `src/store/reducer.ts`
- Create: `src/store/reducer.test.ts`

**Interfaces:**
- Consumes: `Task` and `ISODateTime` from Task 3.
- Produces these five `Action` members, consumed by Task 6:
  - `{ type: 'addTask'; task: Task }`
  - `{ type: 'updateTask'; taskId: string; patch: Partial<Task> }`
  - `{ type: 'toggleTask'; taskId: string; at: ISODateTime }`
  - `{ type: 'removeTask'; taskId: string }`
  - `{ type: 'clearCompletedTasks' }`

- [ ] **Step 1: Write the failing tests**

Create `src/store/reducer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- reducer`

Expected: FAIL — TypeScript rejects the unknown action types.

- [ ] **Step 3: Add the actions**

In `src/store/reducer.ts`, add `ISODateTime` and `Task` to the type imports, then add these members to the `Action` union after the goal actions (around line 29):

```ts
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; taskId: string; patch: Partial<Task> }
  // Carries its own timestamp so the reducer stays pure, matching the deletes.
  | { type: 'toggleTask'; taskId: string; at: ISODateTime }
  | { type: 'removeTask'; taskId: string }
  | { type: 'clearCompletedTasks' }
```

Add these cases to the switch, after `removeGoal`:

```ts
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId ? { ...task, ...action.patch } : task,
        ),
      }
    case 'toggleTask':
      // This action owns the done/completedAt invariant. A caller passing a
      // raw patch through `updateTask` could break it, so toggling is its own
      // action rather than a convenience wrapper.
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task
          const next: Task = { ...task, done: !task.done }
          if (next.done) next.completedAt = action.at
          else delete next.completedAt
          return next
        }),
      }
    case 'removeTask':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.taskId) }
    case 'clearCompletedTasks':
      return { ...state, tasks: state.tasks.filter((task) => !task.done) }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- reducer`

Expected: PASS, 7 tests.

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/reducer.ts src/store/reducer.test.ts
git commit -m "feat: add task actions to the dashboard reducer"
```

---

## Task 5: Urgency, ordering, and due labels

**Files:**
- Create: `src/lib/tasks.ts`
- Modify: `src/lib/tasks.test.ts` (replaces the Task 2 smoke test entirely)

**Interfaces:**
- Consumes: `Task`, `ISODateTime` from Task 3.
- Produces, all consumed by Tasks 8 and 9:
  - `type TaskUrgency = 'overdue' | 'soon' | 'upcoming' | 'none'`
  - `const SOON_MS: number`
  - `urgencyOf(task: Task, now: number): TaskUrgency`
  - `sortTasks(tasks: Task[]): Task[]`
  - `overdueCount(tasks: Task[], now: number): number`
  - `formatDueLabel(dueAt: ISODateTime, now: number): string`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/lib/tasks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tasks`

Expected: FAIL — `src/lib/tasks.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/tasks.ts`:

```ts
import type { ISODateTime, Task } from '@/data/types'

/**
 * Task urgency, derived from the due date rather than stored. Storing it would
 * mean a value that silently goes stale the moment the clock moves past it.
 */
export type TaskUrgency = 'overdue' | 'soon' | 'upcoming' | 'none'

/** "Due in the next couple of hours." */
export const SOON_MS = 2 * 60 * 60 * 1000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** NaN-safe parse: an unparseable date is treated as no date at all. */
function parse(value: ISODateTime | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

export function urgencyOf(task: Task, now: number): TaskUrgency {
  if (task.done) return 'none'

  const due = parse(task.dueAt)
  if (due === null) return 'none'

  const delta = due - now
  if (delta < 0) return 'overdue'
  if (delta <= SOON_MS) return 'soon'
  return 'upcoming'
}

/**
 * One fixed order, deliberately not user-configurable: the due date *is* the
 * ordering, which is why there is no manual reorder affordance. Ascending
 * `dueAt` puts overdue work first without needing to know the current time.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1

    if (a.done) {
      const aDone = parse(a.completedAt) ?? parse(a.createdAt) ?? 0
      const bDone = parse(b.completedAt) ?? parse(b.createdAt) ?? 0
      return bDone - aDone
    }

    const aDue = parse(a.dueAt)
    const bDue = parse(b.dueAt)
    if (aDue !== null && bDue !== null) return aDue - bDue
    if (aDue !== null) return -1
    if (bDue !== null) return 1

    return (parse(b.createdAt) ?? 0) - (parse(a.createdAt) ?? 0)
  })
}

export function overdueCount(tasks: Task[], now: number): number {
  return tasks.filter((task) => urgencyOf(task, now) === 'overdue').length
}

/** Calendar days between two dates, ignoring the time of day. */
function dayDelta(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / DAY)
}

/** Zero-padded 24-hour local time. Built by hand so tests are locale-proof. */
function clockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Relative text near the due time, absolute further out — "in 40m" is what you
 * need when it is imminent, "12 Oct" when it is not.
 */
export function formatDueLabel(dueAt: ISODateTime, now: number): string {
  const due = parse(dueAt)
  if (due === null) return ''

  const delta = due - now
  const magnitude = Math.abs(delta)
  const overdue = delta < 0

  if (magnitude < MINUTE) return overdue ? 'just overdue' : 'due now'

  if (magnitude < HOUR) {
    const minutes = Math.round(magnitude / MINUTE)
    return overdue ? `${minutes}m overdue` : `in ${minutes}m`
  }

  if (magnitude < 12 * HOUR) {
    const hours = Math.round(magnitude / HOUR)
    return overdue ? `${hours}h overdue` : `in ${hours}h`
  }

  const date = new Date(due)
  const days = dayDelta(new Date(now), date)

  if (days === 0) return `today ${clockTime(date)}`
  if (days === 1) return `tomorrow ${clockTime(date)}`
  if (days === -1) return `yesterday ${clockTime(date)}`
  if (days > 1 && days < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${clockTime(date)}`
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tasks`

Expected: PASS, 21 tests.

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat: add task urgency, ordering, and due-label formatting"
```

---

## Task 6: Provider actions for tasks

**Files:**
- Modify: `src/store/context.ts:31-61`
- Modify: `src/store/DashboardProvider.tsx:153-227`

**Interfaces:**
- Consumes: the reducer actions from Task 4.
- Produces, on `DashboardActions`, consumed by Tasks 8 and 9:
  - `addTask(task: Omit<Task, 'id' | 'createdAt' | 'done'>): void`
  - `updateTask(taskId: string, patch: Partial<Task>): void`
  - `toggleTask(taskId: string): void`
  - `removeTask(taskId: string): void`
  - `clearCompletedTasks(): void`

- [ ] **Step 1: Declare the actions on the context**

In `src/store/context.ts`, add `Task` to the type imports, then add to `DashboardActions` after the goal actions (line 49):

```ts
  /** A new task is never born done, so `done` is not the caller's to set. */
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'done'>) => void
  updateTask: (taskId: string, patch: Partial<Task>) => void
  /** Owns the done/completedAt pair; do not flip `done` through `updateTask`. */
  toggleTask: (taskId: string) => void
  removeTask: (taskId: string) => void
  clearCompletedTasks: () => void
```

- [ ] **Step 2: Implement them in the provider**

In `src/store/DashboardProvider.tsx`, add `Task` to the type imports, then add to the `actions` `useMemo` object after `removeGoal` (line 196):

```ts
      addTask: (task: Omit<Task, 'id' | 'createdAt' | 'done'>) =>
        dispatch({
          type: 'addTask',
          task: {
            ...task,
            id: `task-${crypto.randomUUID()}`,
            done: false,
            createdAt: new Date().toISOString(),
          },
        }),
      updateTask: (taskId: string, patch: Partial<Task>) =>
        dispatch({ type: 'updateTask', taskId, patch }),
      toggleTask: (taskId: string) =>
        dispatch({ type: 'toggleTask', taskId, at: new Date().toISOString() }),
      removeTask: (taskId: string) => dispatch({ type: 'removeTask', taskId }),
      clearCompletedTasks: () => dispatch({ type: 'clearCompletedTasks' }),
```

The `actions` dependency array does not change — these all close over `dispatch`, which React guarantees is stable.

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`

Expected: PASS. If `DashboardActions` and the provider's object disagree, `tsc` names the missing member.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS, all tests from Tasks 3-5.

- [ ] **Step 5: Commit**

```bash
git add src/store/context.ts src/store/DashboardProvider.tsx
git commit -m "feat: expose task actions on the dashboard context"
```

---

## Task 7: The ticking clock

**Files:**
- Create: `src/hooks/useNow.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useNow(intervalMs?: number): number` — a millisecond timestamp that re-renders its consumer on an interval. Consumed by Tasks 8 and 9.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * A clock that re-renders its consumer, for anything whose *appearance*
 * depends on the current time — task urgency, the overdue badge.
 *
 * Deliberately separate from `DashboardProvider`'s `today`, which is frozen at
 * mount so a long-lived tab does not re-anchor the period under the user. That
 * decision holds; this is only for urgency, and must not be wired into the
 * period anchor.
 *
 * A hidden tab stops ticking entirely and takes a fresh reading when it comes
 * back, so a dashboard left open overnight is not waking up once a minute.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const stop = () => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
    }

    const start = () => {
      stop()
      setNow(Date.now())
      timer = setInterval(() => setNow(Date.now()), intervalMs)
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])

  return now
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNow.ts
git commit -m "feat: add a visibility-aware ticking clock hook"
```

---

## Task 8: The tasks panel

**Files:**
- Create: `src/components/panels/tasks/TaskComposer.tsx`
- Create: `src/components/panels/tasks/TaskRow.tsx`
- Create: `src/components/panels/tasks/TasksPanel.tsx`
- Delete: `src/components/panels/EmbedPanel.tsx`
- Modify: `src/App.tsx:6, 43`

**Interfaces:**
- Consumes: `useNow` (Task 7), `urgencyOf` / `sortTasks` / `formatDueLabel` (Task 5), task actions (Task 6), and the existing `Card`, `CheckBox`, `Tag` UI primitives.
- Produces: `TasksPanel({ className }: { className?: string })`, mounted as the `secondary` pane of `SplitPane`.

- [ ] **Step 1: Build the composer**

`<input type="datetime-local">` is used deliberately — the native picker on iOS is better than anything hand-rolled, and this dashboard is used from a phone.

Create `src/components/panels/tasks/TaskComposer.tsx`:

```tsx
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
```

- [ ] **Step 2: Build the row**

Urgency is shown by a left rail plus a tinted due label — never a solid fill, which would wreck the title's contrast on the near-black surface. The label text states the urgency, so colour is never the only cue.

Create `src/components/panels/tasks/TaskRow.tsx`:

```tsx
import { X } from 'lucide-react'
import { CheckBox } from '@/components/ui/CheckBox'
import { Tag } from '@/components/ui/Tag'
import { useDashboard } from '@/store/useDashboard'
import { categoryColor } from '@/lib/colors'
import { formatDueLabel, urgencyOf, type TaskUrgency } from '@/lib/tasks'
import type { Task } from '@/data/types'
import { cn } from '@/lib/cn'

/** Uses only the reserved status tokens — never a series colour. */
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
```

Before writing this, open `src/components/ui/CheckBox.tsx` and `src/components/ui/Tag.tsx` and confirm the prop names used above (`checked`, `onChange`, `color`, `label`; `category`, `className`) match. They are taken from the call sites in `GoalsPanel.tsx:86-91` and `GoalsPanel.tsx:113`. Adjust if they differ.

- [ ] **Step 3: Build the panel**

Create `src/components/panels/tasks/TasksPanel.tsx`:

```tsx
import { useMemo } from 'react'
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
  const { tasks } = state.data
  const query = state.query.trim().toLowerCase()

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
                <TaskRow task={task} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card.Root>
  )
}
```

Open `src/components/ui/Card.tsx` first and confirm `Card.Root` accepts a `panelId` prop — `GoalsPanel.tsx:326` passes one. If it is required rather than optional, keep it; if no such prop exists, drop it.

- [ ] **Step 4: Swap it into the layout and delete the embed**

In `src/App.tsx`, replace the `EmbedPanel` import on line 6:

```tsx
import { TasksPanel } from '@/components/panels/tasks/TasksPanel'
```

Replace the `secondary` prop on line 43, and widen the pane slightly — a task list wants more room than an iframe did:

```tsx
          secondary={<TasksPanel />}
          defaultRatio={0.68}
```

Then delete the file:

```bash
rm src/components/panels/EmbedPanel.tsx
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`

Expected: PASS. If `tsc` reports `EmbedPanel` still imported somewhere, that import is the last reference — remove it.

- [ ] **Step 6: Verify it works in the browser**

Run: `npm run dev`, open `http://localhost:3000`.

Expected:
- The right column is the tasks panel, not an iframe. The Blue Hill embed is gone.
- Three seeded tasks appear: one overdue with a red rail and red "Xh overdue" text, one due today with an amber rail, one a few days out with neither.
- Typing a title and pressing Enter adds a task at the correct sorted position.
- The quick chips fill the datetime field; the added task lands in the right place.
- Checking a task strikes it through and drops it to the bottom; "clear completed" appears.
- Searching in the top bar filters the list.
- Narrow the window below 1024px: the panel stacks below the main column.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/tasks/ src/App.tsx
git rm src/components/panels/EmbedPanel.tsx
git commit -m "feat: replace the embed column with an integrated task list"
```

---

## Task 9: Surface overdue work outside the panel

**Files:**
- Create: `src/hooks/useTaskBadge.ts`
- Modify: `src/components/views/DailyView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `overdueCount` (Task 5), `useNow` (Task 7).
- Produces: `useTaskBadge(overdue: number): void` — a side-effect-only hook.

- [ ] **Step 1: Add the overdue stat tile**

In `src/components/views/DailyView.tsx`, add the imports:

```tsx
import { useNow } from '@/hooks/useNow'
import { overdueCount } from '@/lib/tasks'
```

Inside `DailyView`, after the existing `blocked` line:

```tsx
  const now = useNow()
  const overdue = overdueCount(data.tasks, now)
```

Add this tile immediately after the `Active goals` tile, keeping all four existing tiles. It mirrors how `Blocked` conditions its accent — the number is only worth colouring when it is non-zero:

```tsx
        <StatTile
          label="Overdue"
          value={overdue}
          accent={overdue ? 'var(--color-critical)' : undefined}
          hint={overdue ? 'past due' : 'nothing late'}
        />
```

That makes five tiles, so widen the grid on line 23 from `lg:grid-cols-4` to `lg:grid-cols-5`:

```tsx
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
```

- [ ] **Step 2: Write the badge hook**

Create `src/hooks/useTaskBadge.ts`:

```ts
import { useEffect } from 'react'

const BASE_TITLE = 'Dashboard'
const ICON_ID = 'task-favicon'

/**
 * Draws a 32x32 favicon: a rounded accent tile, plus a critical-coloured dot
 * when something is overdue. Returns null wherever canvas is unavailable —
 * a headless context, or a browser refusing the 2d context — so the caller
 * can fall back to the title alone.
 */
function drawFavicon(overdue: number): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#8b72ee'
    context.beginPath()
    context.roundRect(2, 2, 28, 28, 8)
    context.fill()

    context.fillStyle = '#f4f4f5'
    context.font = 'bold 18px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('D', 16, 17)

    if (overdue > 0) {
      context.fillStyle = '#e66767'
      context.beginPath()
      context.arc(24, 8, 7, 0, Math.PI * 2)
      context.fill()
    }

    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Puts the overdue count where it is visible without switching to the tab —
 * which matters because this dashboard opens automatically at the start of a
 * session and then sits in a background tab.
 */
export function useTaskBadge(overdue: number): void {
  useEffect(() => {
    document.title = overdue > 0 ? `(${overdue}) ${BASE_TITLE}` : BASE_TITLE

    const href = drawFavicon(overdue)
    if (!href) return

    let link = document.getElementById(ICON_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = ICON_ID
      link.rel = 'icon'
      document.head.append(link)
    }
    link.href = href
  }, [overdue])
}
```

`roundRect` is available in all current browsers; the `try`/`catch` covers anything older by falling back to the title alone.

- [ ] **Step 3: Call it from the dashboard root**

In `src/App.tsx`, add the imports:

```tsx
import { useNow } from '@/hooks/useNow'
import { useTaskBadge } from '@/hooks/useTaskBadge'
import { overdueCount } from '@/lib/tasks'
```

Inside `Dashboard`, after the `useDashboard()` call:

```tsx
  const now = useNow()
  useTaskBadge(overdueCount(state.data.tasks, now))
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000`.

Expected: the tab title reads `(1) Dashboard` with the seeded overdue task, and the favicon shows a red dot. Check the overdue task off — the title returns to `Dashboard`, the dot disappears, and the Overdue stat tile drops to 0 and loses its red accent.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTaskBadge.ts src/components/views/DailyView.tsx src/App.tsx
git commit -m "feat: surface overdue tasks in the tab title, favicon, and stat tile"
```

---

## Task 10: Content-hash revisions on the storage contract

**Files:**
- Modify: `api/data.ts`
- Modify: `server/fileStore.ts:79-127`
- Modify: `src/lib/sync.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, consumed by Task 11:
  - `GET /api/data` → `{ configured: true, data, rev }`, `rev` being 16 hex characters or `null` for an empty store.
  - `PUT /api/data` with `If-Match: <rev>` → `412` on mismatch; no header writes unconditionally.
  - `type SyncStatus = 'unknown' | 'local' | 'synced' | 'saving' | 'error' | 'conflict'`
  - `interface RemoteResult { configured: boolean; data: DashboardData | null; rev: string | null }`
  - `type PushResult = { status: 'ok'; rev: string | null } | { status: 'unconfigured' } | { status: 'conflict' }`
  - `fetchRemote(signal?: AbortSignal): Promise<RemoteResult>`
  - `pushRemote(data: DashboardData, rev: string | null): Promise<PushResult>`

- [ ] **Step 1: Add revisions to the Vercel function**

In `api/data.ts`, add this next to the other helpers:

```ts
/**
 * A revision is a content hash, not a stored field — so the document shape
 * never changes and there is no envelope to migrate.
 */
async function revisionOf(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
```

Replace the body of the `try` in `GET`:

```ts
    const raw = await command<string | null>(config, ['GET', KEY])
    return json({
      configured: true,
      data: raw ? JSON.parse(raw) : null,
      rev: raw ? await revisionOf(raw) : null,
    })
```

Replace the body of the `try` in `PUT`:

```ts
    const payload = await request.text()
    // Reject junk before it overwrites a good document.
    JSON.parse(payload)

    // A client that sends no If-Match writes unconditionally: that is the
    // first-ever write and the seed-an-empty-store path.
    const expected = request.headers.get('if-match')
    if (expected) {
      const current = await command<string | null>(config, ['GET', KEY])
      const currentRev = current ? await revisionOf(current) : null
      if (currentRev !== expected) {
        return json({ error: 'Stale document', rev: currentRev }, 412)
      }
    }

    await command(config, ['SET', KEY, payload])
    return json({ configured: true, ok: true, rev: await revisionOf(payload) })
```

The read-compare-write is not atomic. For a single user that is fine; Upstash REST supports `EVAL` if it ever needs to be a Lua compare-and-set.

- [ ] **Step 2: Mirror it in the local file store**

Dev and production must not diverge. In `server/fileStore.ts`, add at the top:

```ts
import { createHash } from 'node:crypto'
```

And this helper next to `writeDocument`:

```ts
/** Must match `revisionOf` in api/data.ts: first 8 bytes of SHA-256, as hex. */
function revisionOf(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16)
}
```

The two must hash the *same string*. The file store pretty-prints on write but hashes what it reads back, and the client compares only revisions the server gave it, so they stay consistent within a store.

In the `GET` branch, replace the success line:

```ts
        .then((raw) => json(response, { configured: true, data: JSON.parse(raw), rev: revisionOf(raw) }))
```

and the `ENOENT` branch:

```ts
            json(response, { configured: true, data: null, rev: null })
```

In the `PUT` branch, after the `JSON.parse` block and before `writeDocument`:

```ts
          const expected = request.headers['if-match']
          if (typeof expected === 'string') {
            const current = await readFile(file, 'utf8').catch(() => null)
            const currentRev = current === null ? null : revisionOf(current)
            if (currentRev !== expected) {
              json(response, { error: 'Stale document', rev: currentRev }, 412)
              return
            }
          }
```

And replace the success response:

```ts
          const written = await readFile(file, 'utf8')
          json(response, { configured: true, ok: true, rev: revisionOf(written) })
```

Reading the file back after writing is what keeps the revision matching what a later `GET` will compute, since `writeDocument` pretty-prints and the payload arrived minified.

- [ ] **Step 3: Update the client contract**

Replace the whole of `src/lib/sync.ts`:

```ts
import type { DashboardData } from '@/data/types'

const ENDPOINT = '/api/data'

declare global {
  interface Window {
    /** Set by the boot script in index.html; consumed once by `fetchRemote`. */
    __dashboardBoot?: Promise<Response>
  }
}

/**
 * `local`    — no store configured; localStorage only, no cross-device sync.
 * `synced`   — last read/write against the remote store succeeded.
 * `saving`   — a write is in flight.
 * `conflict` — another device wrote first; this device reloaded and lost its
 *              unsynced edit. Whole-document merging is out of scope.
 * `error`    — the store is configured but unreachable; local writes still land.
 */
export type SyncStatus = 'unknown' | 'local' | 'synced' | 'saving' | 'error' | 'conflict'

export interface RemoteResult {
  configured: boolean
  data: DashboardData | null
  /** Content hash of the stored document, or null when the store is empty. */
  rev: string | null
}

export type PushResult =
  | { status: 'ok'; rev: string | null }
  | { status: 'unconfigured' }
  | { status: 'conflict' }

function authHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_DASHBOARD_KEY
  return key ? { 'x-dashboard-key': key } : {}
}

/** A 501 means the deployment has no store wired up — offline-first, not a failure. */
async function readRemote(response: Response): Promise<RemoteResult> {
  if (response.status === 501) return { configured: false, data: null, rev: null }
  if (!response.ok) throw new Error(`GET ${ENDPOINT} failed: ${response.status}`)

  const body = (await response.json()) as { data: DashboardData | null; rev?: string | null }
  return { configured: true, data: body.data, rev: body.rev ?? null }
}

export async function fetchRemote(signal?: AbortSignal): Promise<RemoteResult> {
  // The boot script in index.html starts this request before the bundle has
  // even parsed. Consume it once, then fall through to real fetches so a
  // focus-refetch never replays a stale response.
  const boot = typeof window === 'undefined' ? undefined : window.__dashboardBoot
  if (boot) {
    window.__dashboardBoot = undefined
    try {
      return await readRemote(await boot)
    } catch {
      // The early request failed — fall through and try again properly.
    }
  }

  return readRemote(await fetch(ENDPOINT, { headers: authHeaders(), signal }))
}

export async function pushRemote(
  data: DashboardData,
  rev: string | null,
): Promise<PushResult> {
  const response = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      // Omitted when we have never seen a revision, which writes unconditionally.
      ...(rev ? { 'if-match': rev } : {}),
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  })

  if (response.status === 501) return { status: 'unconfigured' }
  if (response.status === 412) return { status: 'conflict' }
  if (!response.ok) throw new Error(`PUT ${ENDPOINT} failed: ${response.status}`)

  const body = (await response.json()) as { rev?: string | null }
  return { status: 'ok', rev: body.rev ?? null }
}
```

- [ ] **Step 4: Add the conflict state to the badge**

In `src/components/ui/SyncBadge.tsx`, add to the `PRESENTATION` record:

```ts
  conflict: {
    icon: TriangleAlert,
    label: 'Reloaded',
    title: 'Another device saved first — this tab reloaded and dropped its unsent change',
    className: 'text-warning',
  },
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`

Expected: FAIL — `DashboardProvider.tsx` still calls `pushRemote(data)` with one argument. That is Task 11's job; the plan intentionally splits them. If you need a green build at this commit, add `, null` to the existing call site as a placeholder and let Task 11 replace it properly.

- [ ] **Step 6: Verify the contract by hand**

Run: `npm run dev`, then in a second terminal:

```bash
curl -s localhost:3000/api/data | head -c 200
```

Expected: JSON including a `"rev":"<16 hex chars>"`.

```bash
REV=$(curl -s localhost:3000/api/data | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).rev))")
curl -s -X PUT localhost:3000/api/data -H 'content-type: application/json' -H "if-match: wrongrev" -d '{"goals":[]}' -w '\n%{http_code}\n'
```

Expected: `412` with a `Stale document` error.

```bash
curl -s -X PUT localhost:3000/api/data -H 'content-type: application/json' -H "if-match: $REV" -d "$(curl -s localhost:3000/api/data | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d).data)))")" -w '\n%{http_code}\n'
```

Expected: `200` with a new `rev`.

- [ ] **Step 7: Commit**

```bash
git add api/data.ts server/fileStore.ts src/lib/sync.ts src/components/ui/SyncBadge.tsx
git commit -m "feat: add content-hash revisions and If-Match to the storage contract"
```

---

## Task 11: Conditional hydration, focus refetch, conflict handling

**Files:**
- Modify: `src/store/DashboardProvider.tsx:51-122`

**Interfaces:**
- Consumes: `fetchRemote`, `pushRemote`, `PushResult`, `SyncStatus` from Task 10.
- Produces: no new public API. `state.syncStatus` can now be `'conflict'`.

- [ ] **Step 1: Track the revision alongside the cached document**

The last-seen revision is persisted so a reopen can tell "the store has not changed since I last wrote" from "I have never seen this document" — that is what makes the hydration re-render skippable.

In `src/store/DashboardProvider.tsx`, after the `hydratingRef` declaration (line 56), add:

```ts
  /**
   * Content hash of the document as the remote store last confirmed it.
   * The lazy `useState` initialiser is load-bearing: `useRef(loadJSON(...))`
   * would hit localStorage on every render and throw the result away.
   */
  const [storedRev] = useState(() => loadJSON<string>('rev'))
  const revRef = useRef<string | null>(storedRev)
  /** True while a local edit has not yet been accepted by the store. */
  const pendingRef = useRef(false)
```

This matches how `period` is already initialised at `src/store/DashboardProvider.tsx:43-45`.

- [ ] **Step 2: Skip the hydration re-render when nothing changed**

Replace the `if (result.data) { … } else { … }` block inside the mount effect (lines 72-78) with:

```ts
        if (result.data) {
          // The common case: this device wrote last, and the store still holds
          // exactly what is already on screen. Dispatching here would re-render
          // every panel and chart to produce an identical tree.
          if (result.rev !== null && result.rev === revRef.current) {
            setSyncStatus('synced')
            return
          }

          hydratingRef.current = true
          dispatch({ type: 'reset', data: normalizeData(result.data, todayRef.current) })
          revRef.current = result.rev
          saveJSON('rev', result.rev)
        } else {
          // Store is configured but empty — seed it from this device.
          const seeded = await pushRemote(dataRef.current, null)
          if (seeded.status === 'ok') {
            revRef.current = seeded.rev
            saveJSON('rev', seeded.rev)
          }
        }
        setSyncStatus('synced')
```

- [ ] **Step 3: Mark edits pending and handle push results**

Replace the debounced push effect (lines 102-122) with:

```ts
  // Debounced push to the remote store.
  useEffect(() => {
    if (!ready) return
    if (hydratingRef.current) {
      hydratingRef.current = false
      return
    }
    if (statusRef.current === 'local') return

    pendingRef.current = true

    const timer = setTimeout(() => {
      setSyncStatus('saving')
      pushRemote(dataRef.current, revRef.current)
        .then((result) => {
          if (result.status === 'unconfigured') {
            pendingRef.current = false
            setSyncStatus('local')
            return
          }

          if (result.status === 'conflict') {
            // Another device wrote first. Whole-document merging is out of
            // scope, so the remote wins and this tab's unsent edit is lost —
            // narrow in practice, because focus-refetch pulls before you type.
            pendingRef.current = false
            setSyncStatus('conflict')
            void refetch()
            return
          }

          pendingRef.current = false
          revRef.current = result.rev
          saveJSON('rev', result.rev)
          setSyncStatus('synced')
        })
        .catch((error: unknown) => {
          console.warn('Dashboard sync push failed:', error)
          pendingRef.current = false
          setSyncStatus('error')
        })
    }, PUSH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [data, ready, refetch])
```

- [ ] **Step 4: Add the refetch callback and wire it to focus**

Add this above the debounced push effect, so `refetch` is defined before the effect that depends on it:

```ts
  /**
   * Pulls the current document. Skipped while a local edit is unsent, so a
   * refetch can never overwrite something the user just typed.
   */
  const refetch = useCallback(async () => {
    if (statusRef.current === 'local') return
    if (pendingRef.current) return

    try {
      const result = await fetchRemote()

      if (!result.configured) {
        setSyncStatus('local')
        return
      }

      if (result.data && result.rev !== revRef.current) {
        hydratingRef.current = true
        dispatch({ type: 'reset', data: normalizeData(result.data, todayRef.current) })
        revRef.current = result.rev
        saveJSON('rev', result.rev)
      }

      setSyncStatus('synced')
    } catch (error: unknown) {
      console.warn('Dashboard refetch failed:', error)
      setSyncStatus('error')
    }
  }, [])

  // Returning to the tab is exactly the "just picked up my phone" moment, and
  // pulling here is what keeps the conflict window small enough to accept.
  useEffect(() => {
    if (!ready) return

    const onFocus = () => {
      if (!document.hidden) void refetch()
    }

    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [ready, refetch])
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`

Expected: PASS. If `refetch` is reported as used before declaration, move its `useCallback` above the push effect.

- [ ] **Step 6: Verify the sync behaviour**

Run: `npm run dev`. Open `http://localhost:3000` in two browser windows side by side.

Expected:
- Add a task in window A. Within a second the badge reads "Synced".
- Click into window B. It refetches on focus and the new task appears without a reload.
- Check `data/dashboard.json` — the task is there.
- Reload window A with devtools open: the network tab shows one `/api/data` request, and the panels do not visibly re-render, because the revision matched.

- [ ] **Step 7: Commit**

```bash
git add src/store/DashboardProvider.tsx
git commit -m "feat: skip redundant hydration, refetch on focus, surface conflicts"
```

---

## Task 12: Open-latency work

**Files:**
- Modify: `api/data.ts` (add the runtime export)
- Modify: `index.html`
- Modify: `src/main.tsx`
- Modify: `src/index.css:10-11`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `window.__dashboardBoot`, declared in `src/lib/sync.ts` in Task 10.
- Produces: no new API.

- [ ] **Step 1: Move the function to the edge runtime**

`api/data.ts` uses only `fetch`, `Request`/`Response`, `process.env`, and WebCrypto, all available at the edge. Without this it is a Node serverless function paying a cold start on exactly the first-open-of-the-day this dashboard is built for.

Add near the top of `api/data.ts`, below the doc comment:

```ts
/** Edge, not Node: a cold start is the largest cost on the open path. */
export const runtime = 'edge'
```

- [ ] **Step 2: Start the fetch before React exists**

This moves the request off the critical path behind bundle download, parse, and mount.

In `index.html`, add inside `<head>`, after the `<meta name="color-scheme">` line:

```html
    <!-- Optional shared secret. Vite substitutes this at build time; when the
         variable is unset the placeholder survives verbatim and is ignored. -->
    <meta name="dashboard-key" content="%VITE_DASHBOARD_KEY%" />
    <script>
      // Start the document fetch before the bundle has downloaded or parsed.
      // src/lib/sync.ts consumes this promise exactly once.
      (function () {
        var meta = document.querySelector('meta[name="dashboard-key"]')
        var key = meta ? meta.content : ''
        var headers = key && key.indexOf('%') === -1 ? { 'x-dashboard-key': key } : undefined
        try {
          window.__dashboardBoot = fetch('/api/data', headers ? { headers: headers } : undefined)
        } catch (error) {
          // Nothing to do — sync.ts falls back to its own fetch.
        }
      })()
    </script>
```

- [ ] **Step 3: Self-host the fonts**

`index.html` currently loads Outfit and Inter from Google Fonts — a third-party render-blocking stylesheet plus a second connection for the font files, on every cold open.

```bash
npm install @fontsource-variable/outfit @fontsource-variable/inter
```

Remove these lines from `index.html`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

In `src/main.tsx`, add these above the existing `./index.css` import so the font faces are registered first:

```ts
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
```

In `src/index.css`, update the two font tokens to the variable family names:

```css
  --font-display: 'Outfit Variable', ui-sans-serif, system-ui, sans-serif;
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Verify the open path**

Run: `npm run dev`, open `http://localhost:3000` with devtools on the Network tab, and hard-reload.

Expected:
- Typography is unchanged — the same Outfit headings and Inter body text.
- No requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
- `/api/data` starts early, before the JS bundle finishes, and there is exactly **one** such request, not two — proving the boot promise was consumed rather than duplicated.

- [ ] **Step 6: Update the README**

`README.md` documents the storage contract. Update it to cover: the `rev` / `If-Match` behaviour and the 412 response; the edge runtime; that fonts are now self-hosted; the tasks panel replacing the embed; and `npm test`. Also record the deferred items from the spec — OTP auth, the Supabase reassessment, and `Goal.due` still being a free-form string.

- [ ] **Step 7: Verify the whole suite one last time**

```bash
npm test && npm run build
```

Expected: all tests PASS, build PASSES.

- [ ] **Step 8: Commit**

```bash
git add api/data.ts index.html src/main.tsx src/index.css package.json package-lock.json README.md
git commit -m "perf: edge runtime, pre-bundle data fetch, and self-hosted fonts"
```

---

## Self-Review Notes

Checked against the spec:

- **§1 Task model** — Task 3 (type, normalisation, seed), Task 4 (reducer), Task 6 (provider actions). "No trash entry" is satisfied by omission; no trash code is added.
- **§2 Urgency** — Task 5 (logic and boundaries), Task 7 (`useNow`), Task 8 (rail/wash/label rendering, composer, panel, `SplitPane` swap), Task 9 (stat tile, tab title, favicon).
- **§3 Storage** — Task 10 (`rev`, `If-Match`, 412, client contract, both store implementations), Task 11 (conditional hydration, focus refetch, conflict state), Task 12 (edge runtime, boot fetch, self-hosted fonts). The "stay on Upstash, do not migrate to Supabase" decision needs no task — it is the absence of one.
- **§4 Dead code** — Task 1, covering the Dock machinery plus `clearStored`, `categoryBreakdown`, and `MacroKey`, and explicitly not touching `rollUpEpic`, `endOfMonth`, or `dashboardFileStore`.
- **§5 Testing** — Task 2 (Vitest), with tests written first in Tasks 3, 4, and 5. Every table row in the spec's testing section maps to a named test.
- **§6 Files** — matches the File Structure table above.

Type consistency verified across tasks: `sortTasks` takes one argument everywhere (spec corrected before planning, since a `now` parameter would be unused and `noUnusedParameters` is on); `pushRemote(data, rev)` is two-argument at its declaration in Task 10 and at both call sites in Task 11; `PushResult` is discriminated on `status` consistently; `rev` is `string | null` on every surface.

Known intentional wrinkle: Task 10 Step 5 leaves the build red because it changes `pushRemote`'s arity before Task 11 updates the caller. The step says so and gives the one-line stopgap.
