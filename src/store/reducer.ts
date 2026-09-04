import type {
  Bookmark,
  DashboardData,
  Epic,
  Goal,
  GoalStatus,
  Habit,
  ISODate,
  ISODateTime,
  MacroTargets,
  Task,
  TrashEntry,
} from '@/data/types'
import { TRASH_LIMIT } from '@/data/types'

/**
 * Every write to the dashboard document, in one pure function. Ids and
 * timestamps are supplied by the caller so this stays deterministic and
 * directly testable.
 */
export type Action =
  | { type: 'toggleHabit'; habitId: string; date: ISODate }
  | { type: 'addHabit'; habit: Habit }
  | { type: 'updateHabit'; habitId: string; patch: Partial<Habit> }
  // Deletes carry their id and timestamp: the reducer stays pure, so the
  // clock and the id generator live in the action creators.
  | { type: 'removeHabit'; habitId: string; entryId: string; at: string }
  | { type: 'setGoalStatus'; goalId: string; status: GoalStatus }
  | { type: 'updateGoal'; goalId: string; patch: Partial<Goal> }
  | { type: 'addGoal'; goal: Goal }
  | { type: 'removeGoal'; goalId: string }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; taskId: string; patch: Partial<Task> }
  // Carries its own timestamp so the reducer stays pure, matching the deletes.
  | { type: 'toggleTask'; taskId: string; at: ISODateTime }
  | { type: 'removeTask'; taskId: string }
  | { type: 'clearCompletedTasks' }
  | { type: 'setMacroEntry'; date: ISODate; values: MacroTargets }
  | { type: 'removeMacroEntry'; date: ISODate }
  | { type: 'setMacroTargets'; targets: MacroTargets }
  | { type: 'addEpic'; epic: Epic }
  | { type: 'updateEpic'; epicId: string; patch: Partial<Epic> }
  | { type: 'removeEpic'; epicId: string; entryId: string; at: string }
  | { type: 'restoreTrash'; entryId: string }
  /** With no id, empties the bin. */
  | { type: 'purgeTrash'; entryId?: string }
  | { type: 'addBookmark'; bookmark: Bookmark }
  | { type: 'removeBookmark'; bookmarkId: string }
  | { type: 'reset'; data: DashboardData }

/** Newest first, capped — an unbounded bin would bloat the synced document. */
function pushTrash(trash: TrashEntry[], entry: TrashEntry): TrashEntry[] {
  return [entry, ...trash].slice(0, TRASH_LIMIT)
}

export function reducer(state: DashboardData, action: Action): DashboardData {
  switch (action.type) {
    case 'toggleHabit': {
      const habits = state.habits.map((habit) => {
        if (habit.id !== action.habitId) return habit
        const history = { ...habit.history }
        if (history[action.date]) delete history[action.date]
        else history[action.date] = true
        return { ...habit, history }
      })
      return { ...state, habits }
    }
    case 'addHabit':
      return { ...state, habits: [...state.habits, action.habit] }
    case 'updateHabit':
      return {
        ...state,
        habits: state.habits.map((habit) =>
          habit.id === action.habitId ? { ...habit, ...action.patch } : habit,
        ),
      }
    case 'removeHabit': {
      const habit = state.habits.find((candidate) => candidate.id === action.habitId)
      if (!habit) return state
      return {
        ...state,
        habits: state.habits.filter((candidate) => candidate.id !== action.habitId),
        trash: pushTrash(state.trash, {
          id: `trash-${action.entryId}`,
          kind: 'habit',
          deletedAt: action.at,
          item: habit,
        }),
      }
    }
    case 'setGoalStatus':
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.goalId ? { ...goal, status: action.status } : goal,
        ),
      }
    case 'updateGoal':
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.goalId ? { ...goal, ...action.patch } : goal,
        ),
      }
    case 'addGoal':
      return { ...state, goals: [...state.goals, action.goal] }
    case 'removeGoal':
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.goalId) }
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
    case 'setMacroEntry':
      return {
        ...state,
        macros: {
          ...state.macros,
          [action.date]: { date: action.date, ...action.values },
        },
      }
    case 'removeMacroEntry': {
      const macros = { ...state.macros }
      delete macros[action.date]
      return { ...state, macros }
    }
    case 'setMacroTargets':
      return { ...state, macroTargets: action.targets }
    case 'addEpic':
      return { ...state, epics: [...state.epics, action.epic] }
    case 'updateEpic':
      return {
        ...state,
        epics: state.epics.map((epic) =>
          epic.id === action.epicId ? { ...epic, ...action.patch } : epic,
        ),
      }
    case 'removeEpic': {
      const epic = state.epics.find((candidate) => candidate.id === action.epicId)
      if (!epic) return state
      const children = state.goals.filter((goal) => goal.epicId === action.epicId)
      // Children outlive their epic: deleting the umbrella must not delete the
      // work under it, so they fall back to standalone — and the bin remembers
      // which ones, so a restore can put the grouping back.
      return {
        ...state,
        epics: state.epics.filter((candidate) => candidate.id !== action.epicId),
        goals: state.goals.map((goal) =>
          goal.epicId === action.epicId ? { ...goal, epicId: undefined } : goal,
        ),
        trash: pushTrash(state.trash, {
          id: `trash-${action.entryId}`,
          kind: 'epic',
          deletedAt: action.at,
          item: epic,
          goalIds: children.map((goal) => goal.id),
        }),
      }
    }
    case 'restoreTrash': {
      const entry = state.trash.find((candidate) => candidate.id === action.entryId)
      if (!entry) return state
      const trash = state.trash.filter((candidate) => candidate.id !== action.entryId)

      if (entry.kind === 'habit') {
        // A habit deleted and restored twice must not appear twice.
        if (state.habits.some((habit) => habit.id === entry.item.id)) {
          return { ...state, trash }
        }
        return { ...state, habits: [...state.habits, entry.item], trash }
      }

      const restoring = new Set(entry.goalIds)
      return {
        ...state,
        epics: state.epics.some((epic) => epic.id === entry.item.id)
          ? state.epics
          : [...state.epics, entry.item],
        // Only re-attach goals that are still unassigned: one reassigned to
        // another epic in the meantime keeps its newer home.
        goals: state.goals.map((goal) =>
          restoring.has(goal.id) && !goal.epicId
            ? { ...goal, epicId: entry.item.id }
            : goal,
        ),
        trash,
      }
    }
    case 'purgeTrash':
      return {
        ...state,
        trash: action.entryId
          ? state.trash.filter((entry) => entry.id !== action.entryId)
          : [],
      }
    case 'addBookmark':
      return { ...state, bookmarks: [...state.bookmarks, action.bookmark] }
    case 'removeBookmark':
      return {
        ...state,
        bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== action.bookmarkId),
      }
    case 'reset':
      return action.data
  }
}
