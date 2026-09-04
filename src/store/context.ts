import { createContext } from 'react'
import type {
  Bookmark,
  DashboardData,
  Epic,
  Goal,
  GoalStatus,
  Habit,
  ISODate,
  MacroTargets,
  Period,
  Task,
} from '@/data/types'
import type { SyncStatus } from '@/lib/sync'

/**
 * The contract between the dashboard UI and whatever is backing it.
 * The panels only ever read this interface, so swapping the localStorage
 * provider for an API-backed one is a change to the provider alone.
 */
export interface DashboardState {
  data: DashboardData
  period: Period
  /** The date the current period is anchored on. */
  anchor: Date
  query: string
  ready: boolean
  /** Whether edits are reaching the shared store, or staying on this device. */
  syncStatus: SyncStatus
}

export interface DashboardActions {
  setPeriod: (period: Period) => void
  setAnchor: (anchor: Date) => void
  stepAnchor: (direction: -1 | 1) => void
  goToToday: () => void
  setQuery: (query: string) => void
  toggleHabit: (habitId: string, date: ISODate) => void
  addHabit: (habit: Omit<Habit, 'id' | 'history'>) => void
  updateHabit: (habitId: string, patch: Partial<Habit>) => void
  /** Takes the habit's logged history with it — there is no undo. */
  removeHabit: (habitId: string) => void
  /** Logs or replaces one day's macros. */
  setMacroEntry: (date: ISODate, values: MacroTargets) => void
  removeMacroEntry: (date: ISODate) => void
  setMacroTargets: (targets: MacroTargets) => void
  setGoalStatus: (goalId: string, status: GoalStatus) => void
  updateGoal: (goalId: string, patch: Partial<Goal>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void
  removeGoal: (goalId: string) => void
  /** A new task is never born done, so `done` is not the caller's to set. */
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'done'>) => void
  updateTask: (taskId: string, patch: Partial<Task>) => void
  /** Owns the done/completedAt pair; do not flip `done` through `updateTask`. */
  toggleTask: (taskId: string) => void
  removeTask: (taskId: string) => void
  clearCompletedTasks: () => void
  addEpic: (epic: Omit<Epic, 'id' | 'createdAt'>) => void
  updateEpic: (epicId: string, patch: Partial<Epic>) => void
  /** Deleting an epic leaves its goals standalone; it never deletes work. */
  removeEpic: (epicId: string) => void
  /** Puts a deleted long-term goal or habit back, history and grouping intact. */
  restoreTrash: (entryId: string) => void
  /** Discards one binned entry for good, or the whole bin when given no id. */
  purgeTrash: (entryId?: string) => void
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => void
  removeBookmark: (bookmarkId: string) => void
  resetData: () => void
}

export interface DashboardMeta {
  /** Frozen at mount so a long-lived tab does not drift mid-session. */
  today: Date
  todayISO: ISODate
}

export interface DashboardContextValue {
  state: DashboardState
  actions: DashboardActions
  meta: DashboardMeta
}

export const DashboardContext = createContext<DashboardContextValue | null>(null)
