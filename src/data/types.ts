/** ISO date, always `YYYY-MM-DD` in local time. */
export type ISODate = string

/** ISO 8601 datetime with offset, e.g. `2026-09-04T15:00:00.000Z`. */
export type ISODateTime = string

export type Period = 'daily' | 'weekly' | 'monthly'

export type CategoryId = 'money' | 'gym' | 'coding' | 'work' | 'health'

export interface Category {
  id: CategoryId
  label: string
  /** CSS custom property name from the validated series palette. */
  token: string
}

/**
 * Where a goal sits in its workflow. `blocked` is deliberately a state of its
 * own rather than a flag: work that is stalled on something external reads
 * differently from work nobody has started, and a checkbox cannot say so.
 */
export type GoalStatus = 'todo' | 'doing' | 'blocked' | 'done'

/** Board column order, left to right. Also the order the row control cycles. */
export const GOAL_STATUSES: GoalStatus[] = ['todo', 'doing', 'blocked', 'done']

export const STATUS_LABELS: Record<GoalStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

export interface Goal {
  id: string
  title: string
  /**
   * The detail a one-line title cannot hold — why this matters, what done
   * looks like, what it is waiting on. Optional, and absent rather than empty:
   * a goal with nothing to say should not render an empty disclosure.
   */
  description?: string
  category: CategoryId
  status: GoalStatus
  /** The long-term goal this rolls up into. Unset means standalone. */
  epicId?: string
  subtasksDone: number
  subtasksTotal: number
  /** Free-form for now ("due Fri", "ongoing"); becomes a real date when goals get scheduling. */
  due: string
  /** 0–100. Tracked separately from subtasks: weighted progress, not task count. */
  progress: number
  createdAt: ISODate
}

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

/**
 * A long-term goal — the epic of this board. It owns no progress of its own:
 * status and percentage are always rolled up from the goals pointing at it,
 * so finishing the last child finishes the epic and nothing can drift.
 */
export interface Epic {
  id: string
  title: string
  category: CategoryId
  due: string
  createdAt: ISODate
}

/**
 * One tickable slot inside a habit's day — a glass of water, a specific
 * vitamin. The label is optional because both shapes are wanted: three
 * interchangeable glasses need no names, four different pills do.
 */
export interface HabitStep {
  id: string
  /** Unnamed slots render as plain boxes; named ones show their initial. */
  label?: string
}

/** Enough for a pill organiser without letting the row stop fitting a phone. */
export const MAX_HABIT_STEPS = 12

/** The slot every habit has before anyone splits it up, and after a migration. */
export const DEFAULT_STEP_ID = 'step-1'

export interface Habit {
  id: string
  name: string
  category: CategoryId
  /** Times per week the habit is meant to be hit. Drives weekly/monthly adherence. */
  targetPerWeek: number
  /** Ordered slots to tick each day. Never empty — a habit has at least one. */
  steps: HabitStep[]
  /**
   * Sparse map: only days with at least one tick appear, and each holds the
   * step ids completed that day. A day counts as done only once every step is
   * in it, so a one-step habit behaves exactly as it did when this was a
   * boolean.
   */
  history: Record<ISODate, string[]>
}

export interface MacroEntry {
  date: ISODate
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface MacroTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Bookmark {
  id: string
  label: string
  url: string
  /** Path under /public, e.g. `/icons/gmail.png`. Falls back to a lettered tile. */
  icon?: string
}

/**
 * A deleted long-term goal or habit, kept so an accidental delete is
 * recoverable. Habits carry irreplaceable history and epics carry structure —
 * neither should vanish on one misclick.
 */
export type TrashEntry =
  | {
      id: string
      kind: 'epic'
      /** ISO datetime — the bin is ordered newest first. */
      deletedAt: string
      item: Epic
      /**
       * Goals that pointed at this epic when it was deleted. They stay in the
       * board as standalone; restoring re-attaches whichever still exist.
       */
      goalIds: string[]
    }
  | {
      id: string
      kind: 'habit'
      deletedAt: string
      /** Includes its logged history, which is the whole point of keeping it. */
      item: Habit
    }

/** Oldest entries are dropped past this, so the bin cannot grow without bound. */
export const TRASH_LIMIT = 25

/** The whole persisted document. Bump STORAGE_VERSION when this shape changes. */
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

export const CATEGORIES: Record<CategoryId, Category> = {
  money: { id: 'money', label: 'Money', token: 'var(--color-series-1)' },
  gym: { id: 'gym', label: 'Gym', token: 'var(--color-series-2)' },
  coding: { id: 'coding', label: 'Coding', token: 'var(--color-series-3)' },
  work: { id: 'work', label: 'Work', token: 'var(--color-series-4)' },
  health: { id: 'health', label: 'Health', token: 'var(--color-series-5)' },
}

export const CATEGORY_LIST: Category[] = Object.values(CATEGORIES)
