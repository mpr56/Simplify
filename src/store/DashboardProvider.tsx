import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { createSeedData } from '@/data/seed'
import { normalizeData } from '@/data/normalize'
import { addDays, rangeFor, startOfWeek, toISO } from '@/lib/date'
import { loadJSON, saveJSON } from '@/lib/storage'
import { fetchRemote, pushRemote, type SyncStatus } from '@/lib/sync'
import { reducer } from './reducer'
import { DashboardContext, type DashboardContextValue } from './context'

/** How long edits settle before a write goes out. */
const PUSH_DEBOUNCE_MS = 800

/**
 * The anchor is the precise day the view is pointed at, never snapped to the
 * start of its week or month: `rangeFor` already derives the window from any
 * day inside it, so snapping only threw the day away — which is what made
 * Daily → Weekly → Daily land on Monday.
 */
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // A snapshot, not a constant: it holds still through a session so nothing
  // shifts mid-interaction, and the rollover effect below advances it when the
  // wall clock actually crosses midnight.
  const [today, setToday] = useState<Date>(() => new Date())
  const todayRef = useRef(today)
  todayRef.current = today
  const todayISO = useMemo(() => toISO(today), [today])

  // Render immediately from cache (or seed); the remote document lands after.
  const [data, dispatch] = useReducer(reducer, null, () => {
    const cached = loadJSON<DashboardData>('data')
    return cached ? normalizeData(cached, todayRef.current) : createSeedData(todayRef.current)
  })
  const [period, setPeriodState] = useState<Period>(
    () => loadJSON<Period>('period') ?? 'daily',
  )
  const [anchor, setAnchorState] = useState<Date>(() => today)
  const [query, setQuery] = useState('')
  const [ready, setReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unknown')

  const dataRef = useRef(data)
  dataRef.current = data
  const statusRef = useRef(syncStatus)
  statusRef.current = syncStatus
  /** Read by the midnight rollover, which is mounted once and never re-run. */
  const periodRef = useRef(period)
  periodRef.current = period
  /** Set when a change came *from* the remote, so it is not echoed back. */
  const hydratingRef = useRef(false)
  /**
   * Content hash of the document as the remote store last confirmed it.
   * The lazy `useState` initialiser is load-bearing: `useRef(loadJSON(...))`
   * would hit localStorage on every render and throw the result away.
   */
  const [storedRev] = useState(() => loadJSON<string>('rev'))
  const revRef = useRef<string | null>(storedRev)
  /** True while a local edit has not yet been accepted by the store. */
  const pendingRef = useRef(false)

  // Hydrate from the remote store on mount.
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    fetchRemote(controller.signal)
      .then(async (result) => {
        if (cancelled) return

        if (!result.configured) {
          setSyncStatus('local')
          return
        }

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
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return
        console.warn('Dashboard sync unavailable, using local data:', error)
        setSyncStatus('error')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  // Local cache is written on every change, unconditionally — it is the
  // fallback when the network or the store is unavailable.
  useEffect(() => {
    saveJSON('data', data)
  }, [data])

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

  /**
   * Midnight rollover. A dashboard is exactly the kind of tab that stays open
   * overnight, and without this "today" stays on the day the tab was opened —
   * so the Daily view goes on offering yesterday's habits to tick, and the
   * date in the header quietly lies.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = () => {
      const now = new Date()
      const previous = todayRef.current

      if (toISO(now) !== toISO(previous)) {
        setToday(now)
        // Follow the clock only when the view was still sitting on the period
        // that just ended. Someone who deliberately stepped back to last week
        // should not have it yanked out from under them at midnight.
        setAnchorState((current) => {
          const { start, end } = rangeFor(periodRef.current, current)
          const heldPrevious =
            toISO(start) <= toISO(previous) && toISO(previous) <= toISO(end)
          return heldPrevious ? now : current
        })
      }

      schedule()
    }

    /** Aimed at the next local midnight, rather than polling for it. */
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(check, midnight.getTime() - now.getTime() + 1_000)
    }

    // A machine that slept through midnight fires the timer late or not at
    // all, so coming back to the tab is the other moment worth checking.
    const onVisible = () => {
      if (!document.hidden) check()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(() => {
    saveJSON('period', period)
  }, [period])

  // Changing period always returns to now — to today, to this week, to this
  // month. Carrying the old anchor across meant Monthly → Daily landed on the
  // 1st; keeping the day instead would still leave you in March when you
  // switched, and "where am I?" is the wrong question to ask of a tab click.
  const setPeriod = useCallback((next: Period) => {
    setPeriodState(next)
    setAnchorState(new Date())
  }, [])

  const setAnchor = useCallback((next: Date) => setAnchorState(next), [])

  const stepAnchor = useCallback(
    (direction: -1 | 1) => {
      setAnchorState((current) => {
        if (period === 'daily') return addDays(current, direction)
        if (period === 'weekly') return addDays(startOfWeek(current), direction * 7)
        return new Date(current.getFullYear(), current.getMonth() + direction, 1)
      })
    },
    [period],
  )

  const goToToday = useCallback(() => {
    setAnchorState(new Date())
  }, [])

  const actions = useMemo(
    () => ({
      setPeriod,
      setAnchor,
      stepAnchor,
      goToToday,
      setQuery,
      toggleHabit: (habitId: string, date: ISODate, stepId: string) =>
        dispatch({ type: 'toggleHabit', habitId, date, stepId }),
      addHabit: (habit: Omit<Habit, 'id' | 'history'>) =>
        dispatch({
          type: 'addHabit',
          // A new habit starts with a genuinely empty history — backfilling it
          // would put days in the charts that never happened.
          habit: { ...habit, id: `habit-${crypto.randomUUID()}`, history: {} },
        }),
      updateHabit: (habitId: string, patch: Partial<Habit>) =>
        dispatch({ type: 'updateHabit', habitId, patch }),
      removeHabit: (habitId: string) =>
        dispatch({
          type: 'removeHabit',
          habitId,
          entryId: crypto.randomUUID(),
          at: new Date().toISOString(),
        }),
      setMacroEntry: (date: ISODate, values: MacroTargets) =>
        dispatch({ type: 'setMacroEntry', date, values }),
      removeMacroEntry: (date: ISODate) => dispatch({ type: 'removeMacroEntry', date }),
      setMacroTargets: (targets: MacroTargets) =>
        dispatch({ type: 'setMacroTargets', targets }),
      setGoalStatus: (goalId: string, status: GoalStatus) =>
        dispatch({ type: 'setGoalStatus', goalId, status }),
      updateGoal: (goalId: string, patch: Partial<Goal>) =>
        dispatch({ type: 'updateGoal', goalId, patch }),
      addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) =>
        dispatch({
          type: 'addGoal',
          goal: {
            ...goal,
            id: `goal-${crypto.randomUUID()}`,
            createdAt: toISO(new Date()),
          },
        }),
      removeGoal: (goalId: string) => dispatch({ type: 'removeGoal', goalId }),
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
      addEpic: (epic: Omit<Epic, 'id' | 'createdAt'>) =>
        dispatch({
          type: 'addEpic',
          epic: {
            ...epic,
            id: `epic-${crypto.randomUUID()}`,
            createdAt: toISO(new Date()),
          },
        }),
      updateEpic: (epicId: string, patch: Partial<Epic>) =>
        dispatch({ type: 'updateEpic', epicId, patch }),
      removeEpic: (epicId: string) =>
        dispatch({
          type: 'removeEpic',
          epicId,
          entryId: crypto.randomUUID(),
          at: new Date().toISOString(),
        }),
      restoreTrash: (entryId: string) => dispatch({ type: 'restoreTrash', entryId }),
      purgeTrash: (entryId?: string) => dispatch({ type: 'purgeTrash', entryId }),
      addBookmark: (bookmark: Omit<Bookmark, 'id'>) =>
        dispatch({
          type: 'addBookmark',
          bookmark: { ...bookmark, id: `bookmark-${crypto.randomUUID()}` },
        }),
      removeBookmark: (bookmarkId: string) =>
        dispatch({ type: 'removeBookmark', bookmarkId }),
      resetData: () => dispatch({ type: 'reset', data: createSeedData(todayRef.current) }),
      importData: (next: DashboardData) => dispatch({ type: 'reset', data: next }),
    }),
    [setPeriod, setAnchor, stepAnchor, goToToday],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({
      state: { data, period, anchor, query, ready, syncStatus },
      actions,
      meta: { today, todayISO },
    }),
    [data, period, anchor, query, ready, syncStatus, actions, today, todayISO],
  )

  return <DashboardContext value={value}>{children}</DashboardContext>
}
