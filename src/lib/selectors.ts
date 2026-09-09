import type {
  DashboardData,
  Epic,
  Goal,
  GoalStatus,
  Habit,
  ISODate,
  MacroEntry,
  MacroTargets,
} from '@/data/types'
import { addDays, eachDay, toISO } from './date'

export interface DaySlice {
  date: Date
  iso: ISODate
  /** Habits completed that day. */
  completed: number
  /** Habits tracked that day. */
  total: number
  macros: MacroEntry | null
  isFuture: boolean
}

/**
 * Steps ticked on a day, ignoring ids for steps the habit no longer has — a
 * shrunken habit must not stay "done" on the strength of a slot it dropped.
 */
export function stepsDoneOn(habit: Habit, iso: ISODate): number {
  const done = habit.history[iso]
  if (!done?.length) return 0
  if (habit.steps.length === 1) {
    return done.includes(habit.steps[0].id) ? 1 : 0
  }
  const ids = new Set(habit.steps.map((step) => step.id))
  return done.reduce((sum, id) => sum + (ids.has(id) ? 1 : 0), 0)
}

/**
 * The single definition of a completed habit-day, used by the streak, the
 * adherence maths, the day strip and the heatmap alike: every step ticked.
 * Partial days count for nothing here, which is what keeps "3 of 5 gym
 * sessions this week" meaning what it always meant.
 */
export function isHabitDoneOn(habit: Habit, iso: ISODate): boolean {
  return habit.steps.length > 0 && stepsDoneOn(habit, iso) >= habit.steps.length
}

/** One row per day in the range — the shared substrate for every period view. */
export function sliceRange(
  data: DashboardData,
  start: Date,
  end: Date,
  today: Date,
): DaySlice[] {
  const todayISO = toISO(today)
  return eachDay(start, end).map((date) => {
    const iso = toISO(date)
    return {
      date,
      iso,
      completed: data.habits.reduce(
        (sum, habit) => sum + (isHabitDoneOn(habit, iso) ? 1 : 0),
        0,
      ),
      total: data.habits.length,
      macros: data.macros[iso] ?? null,
      isFuture: iso > todayISO,
    }
  })
}

/**
 * Consecutive days ending today (or yesterday, so a day still in progress
 * does not read as a broken streak) with at least one habit completed.
 */
export function habitStreak(habits: Habit[], today: Date): number {
  const hasAny = (date: Date) => {
    const iso = toISO(date)
    return habits.some((habit) => isHabitDoneOn(habit, iso))
  }

  let cursor = hasAny(today) ? today : addDays(today, -1)
  let streak = 0
  // Bounded so a corrupt history can never spin forever.
  for (let i = 0; i < 3650; i++) {
    if (!hasAny(cursor)) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function habitsDoneOn(habits: Habit[], iso: ISODate): number {
  return habits.reduce((sum, habit) => sum + (isHabitDoneOn(habit, iso) ? 1 : 0), 0)
}

export function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter((goal) => goal.status !== 'done')
}

export function goalsByStatus(goals: Goal[], status: GoalStatus): Goal[] {
  return goals.filter((goal) => goal.status === status)
}

export interface EpicRollup {
  epic: Epic
  /** Children, in document order. */
  goals: Goal[]
  done: number
  blocked: number
  /** 0–100, averaged over the children's own weighted progress. */
  progress: number
  /**
   * Derived, never stored: `done` only once every child is done, and an epic
   * with no children yet is `todo` however long it has existed.
   */
  status: GoalStatus
}

export function rollUpEpic(epic: Epic, goals: Goal[]): EpicRollup {
  const children = goals.filter((goal) => goal.epicId === epic.id)
  const done = children.filter((goal) => goal.status === 'done').length
  const blocked = children.filter((goal) => goal.status === 'blocked').length

  // Averaging the children's progress, rather than counting completed ones,
  // keeps a long goal that is 90% of the way there from reading as 0%.
  const progress = children.length
    ? Math.round(children.reduce((sum, goal) => sum + goal.progress, 0) / children.length)
    : 0

  let status: GoalStatus = 'todo'
  if (children.length && done === children.length) status = 'done'
  else if (blocked && blocked === children.length - done) status = 'blocked'
  else if (children.some((goal) => goal.status !== 'todo')) status = 'doing'

  return { epic, goals: children, done, blocked, progress, status }
}

export function epicRollups(epics: Epic[], goals: Goal[]): EpicRollup[] {
  return epics.map((epic) => rollUpEpic(epic, goals))
}

/** Goals that roll up to nothing — the board's loose ends. */
export function standaloneGoals(goals: Goal[], epics: Epic[]): Goal[] {
  const ids = new Set(epics.map((epic) => epic.id))
  return goals.filter((goal) => !goal.epicId || !ids.has(goal.epicId))
}

export function filterGoals(goals: Goal[], query: string): Goal[] {
  const q = query.trim().toLowerCase()
  if (!q) return goals
  return goals.filter(
    (goal) => goal.title.toLowerCase().includes(q) || goal.category.includes(q),
  )
}

/** An epic matches on its own title, or on any child the query matches. */
export function filterEpics(epics: Epic[], goals: Goal[], query: string): Epic[] {
  const q = query.trim().toLowerCase()
  if (!q) return epics
  const matched = new Set(filterGoals(goals, q).map((goal) => goal.epicId))
  return epics.filter(
    (epic) => epic.title.toLowerCase().includes(q) || matched.has(epic.id),
  )
}

export function filterHabits(habits: Habit[], query: string): Habit[] {
  const q = query.trim().toLowerCase()
  if (!q) return habits
  return habits.filter((habit) => habit.name.toLowerCase().includes(q))
}

export interface HabitPeriodStat {
  habit: Habit
  completed: number
  /** Days in range that have already happened. */
  elapsed: number
  /** Scheduled hits for the range, from targetPerWeek. */
  target: number
  /** 0–100, capped. */
  adherence: number
  days: { iso: ISODate; done: boolean; isFuture: boolean }[]
}

export function habitStats(
  habits: Habit[],
  slices: DaySlice[],
): HabitPeriodStat[] {
  const elapsed = slices.filter((slice) => !slice.isFuture).length
  const weeks = slices.length / 7

  return habits.map((habit) => {
    const days = slices.map((slice) => ({
      iso: slice.iso,
      done: isHabitDoneOn(habit, slice.iso),
      isFuture: slice.isFuture,
    }))
    const completed = days.filter((day) => day.done).length
    const target = Math.max(1, Math.round(habit.targetPerWeek * weeks))
    return {
      habit,
      completed,
      elapsed,
      target,
      adherence: Math.min(100, Math.round((completed / target) * 100)),
      days,
    }
  })
}

export interface MacroSummary {
  /** Average across days that have data. */
  avg: MacroEntry
  /** Days with logged macros. */
  loggedDays: number
  targets: MacroTargets
  /** Per-day kcal series for trend charts; null where nothing was logged. */
  series: { iso: ISODate; date: Date; kcal: number | null }[]
}

export function macroSummary(
  slices: DaySlice[],
  targets: MacroTargets,
): MacroSummary {
  const logged = slices.filter((slice) => slice.macros && !slice.isFuture)
  const totals = logged.reduce(
    (acc, slice) => {
      const m = slice.macros!
      acc.kcal += m.kcal
      acc.protein += m.protein
      acc.carbs += m.carbs
      acc.fat += m.fat
      return acc
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const n = Math.max(1, logged.length)

  return {
    avg: {
      date: slices[0]?.iso ?? '',
      kcal: Math.round(totals.kcal / n),
      protein: Math.round(totals.protein / n),
      carbs: Math.round(totals.carbs / n),
      fat: Math.round(totals.fat / n),
    },
    loggedDays: logged.length,
    targets,
    series: slices.map((slice) => ({
      iso: slice.iso,
      date: slice.date,
      kcal: slice.isFuture ? null : (slice.macros?.kcal ?? null),
    })),
  }
}

/** Overall completion rate across every tracked habit-day in the range. */
export function completionRate(slices: DaySlice[]): number {
  const elapsed = slices.filter((slice) => !slice.isFuture)
  const possible = elapsed.reduce((sum, slice) => sum + slice.total, 0)
  if (!possible) return 0
  const done = elapsed.reduce((sum, slice) => sum + slice.completed, 0)
  return Math.round((done / possible) * 100)
}
