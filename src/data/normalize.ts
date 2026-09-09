import type {
  CategoryId,
  DashboardData,
  Epic,
  Goal,
  GoalStatus,
  Habit,
  HabitStep,
  ISODate,
  ISODateTime,
  MacroEntry,
  MacroTargets,
  Task,
  TrashEntry,
} from './types'
import {
  CATEGORIES,
  DEFAULT_STEP_ID,
  GOAL_STATUSES,
  MAX_HABIT_STEPS,
  TRASH_LIMIT,
} from './types'
import { createSeedData } from './seed'
import { toISO } from '@/lib/date'

/**
 * Fills in fields a stored document predates. Documents live in localStorage,
 * in `data/dashboard.json`, and in the remote store across deploys, so a newly
 * added field must not crash a browser holding yesterday's shape — and dropping
 * the whole document on a schema change would throw away real user data.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function category(value: unknown): CategoryId {
  return typeof value === 'string' && value in CATEGORIES ? (value as CategoryId) : 'work'
}

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

/** Goals predating the status workflow carry a `done` boolean instead. */
function status(value: unknown, legacyDone: unknown): GoalStatus {
  if (typeof value === 'string' && GOAL_STATUSES.includes(value as GoalStatus)) {
    return value as GoalStatus
  }
  return legacyDone === true ? 'done' : 'todo'
}

function normalizeEpic(input: unknown, today: string): Epic | null {
  if (!isRecord(input) || typeof input.id !== 'string') return null
  return {
    id: input.id,
    title: text(input.title, 'Untitled'),
    category: category(input.category),
    due: text(input.due, 'no due date'),
    createdAt: text(input.createdAt, today),
  }
}

function normalizeGoal(input: unknown, epicIds: Set<string>, today: string): Goal | null {
  if (!isRecord(input) || typeof input.id !== 'string') return null

  const subtasksTotal = int(input.subtasksTotal, 1, 1, 9999)
  // An epic that was deleted out from under a goal leaves the goal standalone
  // rather than orphaned in a group nothing renders.
  const epicId =
    typeof input.epicId === 'string' && epicIds.has(input.epicId) ? input.epicId : undefined
  // Whitespace-only is the same as absent — it would otherwise show an info
  // control that opens onto nothing.
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : undefined

  return {
    id: input.id,
    title: text(input.title, 'Untitled'),
    ...(description ? { description } : {}),
    category: category(input.category),
    status: status(input.status, input.done),
    ...(epicId ? { epicId } : {}),
    subtasksDone: int(input.subtasksDone, 0, 0, subtasksTotal),
    subtasksTotal,
    due: text(input.due, 'no due date'),
    progress: int(input.progress, 0, 0, 100),
    createdAt: text(input.createdAt, today),
  }
}

/** One boolean per day is all a history can hold, so 7 is the real ceiling. */
const MAX_PER_WEEK = 7
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Never empty: a habit with no slots would be untickable and never done. */
function normalizeSteps(input: unknown): HabitStep[] {
  const steps: HabitStep[] = []
  const seen = new Set<string>()

  if (Array.isArray(input)) {
    for (const raw of input) {
      if (!isRecord(raw) || typeof raw.id !== 'string' || seen.has(raw.id)) continue
      const label =
        typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : undefined
      seen.add(raw.id)
      steps.push({ id: raw.id, ...(label ? { label } : {}) })
      if (steps.length === MAX_HABIT_STEPS) break
    }
  }

  // A document predating steps gets the single implicit slot its boolean
  // history was already recording.
  return steps.length ? steps : [{ id: DEFAULT_STEP_ID }]
}

function normalizeHabit(input: unknown): Habit | null {
  if (!isRecord(input) || typeof input.id !== 'string') return null

  const steps = normalizeSteps(input.steps)
  const ids = new Set(steps.map((step) => step.id))

  // The history is sparse by contract — only days with a tick are keys.
  // Rebuild it rather than trusting it, so a junk key or an id belonging to a
  // deleted step cannot make the adherence math count a day that was never
  // logged.
  const history: Record<string, string[]> = {}
  if (isRecord(input.history)) {
    for (const [date, done] of Object.entries(input.history)) {
      if (!ISO_DATE.test(date)) continue

      // `true` is the pre-steps shape: one boolean meant the whole day was
      // done, so it maps onto every slot the habit now has.
      if (done === true) {
        history[date] = steps.map((step) => step.id)
        continue
      }

      if (!Array.isArray(done)) continue
      const kept = done.filter(
        (id): id is string => typeof id === 'string' && ids.has(id),
      )
      if (kept.length) history[date] = [...new Set(kept)]
    }
  }

  return {
    id: input.id,
    name: text(input.name, 'Untitled'),
    category: category(input.category),
    targetPerWeek: int(input.targetPerWeek, MAX_PER_WEEK, 1, MAX_PER_WEEK),
    steps,
    history,
  }
}

const MAX_GRAMS = 2000
const MAX_KCAL = 20000

function macroValues(input: Record<string, unknown>, fallback: MacroTargets): MacroTargets {
  return {
    kcal: int(input.kcal, fallback.kcal, 0, MAX_KCAL),
    protein: int(input.protein, fallback.protein, 0, MAX_GRAMS),
    carbs: int(input.carbs, fallback.carbs, 0, MAX_GRAMS),
    fat: int(input.fat, fallback.fat, 0, MAX_GRAMS),
  }
}

const EMPTY_MACROS: MacroTargets = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/** Keyed by date, and the key wins — an entry's own `date` is redundant copy. */
function normalizeMacros(input: unknown): Record<ISODate, MacroEntry> {
  const macros: Record<ISODate, MacroEntry> = {}
  if (!isRecord(input)) return macros

  for (const [date, entry] of Object.entries(input)) {
    if (!ISO_DATE.test(date) || !isRecord(entry)) continue
    macros[date] = { date, ...macroValues(entry, EMPTY_MACROS) }
  }
  return macros
}

/**
 * A binned entry is normalized exactly like a live one — it is going to be
 * restored into the live document one day, and something unusable in the bin
 * would only fail at that point, when the user is counting on it.
 */
function normalizeTrash(input: unknown, today: string): TrashEntry | null {
  if (!isRecord(input) || typeof input.id !== 'string') return null
  const deletedAt = text(input.deletedAt, today)

  if (input.kind === 'habit') {
    const habit = normalizeHabit(input.item)
    return habit ? { id: input.id, kind: 'habit', deletedAt, item: habit } : null
  }

  if (input.kind === 'epic') {
    const epic = normalizeEpic(input.item, today)
    if (!epic) return null
    return {
      id: input.id,
      kind: 'epic',
      deletedAt,
      item: epic,
      goalIds: Array.isArray(input.goalIds)
        ? input.goalIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  }

  return null
}

export function normalizeData(input: unknown, today: Date): DashboardData {
  const fallback = createSeedData(today)
  if (!isRecord(input)) return fallback

  const todayISO = toISO(today)
  const nowISO = today.toISOString()
  const candidate = input as Partial<DashboardData>

  const rawTargets: Record<string, unknown> = isRecord(candidate.macroTargets)
    ? candidate.macroTargets
    : {}
  const targetKcal = int(rawTargets.kcal, 0, 0, MAX_KCAL)

  const epics = Array.isArray(candidate.epics)
    ? candidate.epics
        .map((epic) => normalizeEpic(epic, todayISO))
        .filter((epic): epic is Epic => epic !== null)
    : []
  const epicIds = new Set(epics.map((epic) => epic.id))

  return {
    epics,
    trash: Array.isArray(candidate.trash)
      ? candidate.trash
          .map((entry) => normalizeTrash(entry, todayISO))
          .filter((entry): entry is TrashEntry => entry !== null)
          .slice(0, TRASH_LIMIT)
      : [],
    goals: Array.isArray(candidate.goals)
      ? candidate.goals
          .map((goal) => normalizeGoal(goal, epicIds, todayISO))
          .filter((goal): goal is Goal => goal !== null)
      : fallback.goals,
    // A document predating tasks migrates to an empty list. Falling back to
    // `fallback.tasks` here would inject seed tasks into a real document.
    tasks: Array.isArray(candidate.tasks)
      ? candidate.tasks
          .map((task) => normalizeTask(task, nowISO))
          .filter((task): task is Task => task !== null)
      : [],
    habits: Array.isArray(candidate.habits)
      ? candidate.habits
          .map((habit) => normalizeHabit(habit))
          .filter((habit): habit is Habit => habit !== null)
      : fallback.habits,
    macros: isRecord(candidate.macros)
      ? normalizeMacros(candidate.macros)
      : fallback.macros,
    macroTargets: {
      ...macroValues(rawTargets, fallback.macroTargets),
      // A zero calorie target would make the ring a division by nothing.
      // Clamping it to 1 would be worse than useless, so a non-positive
      // target falls back to the seed rather than to an absurd one.
      kcal: targetKcal > 0 ? targetKcal : fallback.macroTargets.kcal,
    },
    bookmarks: Array.isArray(candidate.bookmarks)
      ? candidate.bookmarks
      : fallback.bookmarks,
  }
}
