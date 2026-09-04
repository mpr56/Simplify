import type {
  Bookmark,
  CategoryId,
  DashboardData,
  Epic,
  Goal,
  Habit,
  ISODate,
  MacroEntry,
  Task,
} from './types'
import { CATEGORIES } from './types'
import { addDays, toISO } from '@/lib/date'
import epicsSeed from './seed/epics.json'
import goalsSeed from './seed/goals.json'
import habitsSeed from './seed/habits.json'
import macroTargetsSeed from './seed/macro-targets.json'
import bookmarksSeed from './seed/bookmarks.json'
import tasksSeed from './seed/tasks.json'

/**
 * Entities (epics, goals, habits, targets) live in ./seed/*.json so they can be
 * hand-edited without touching code. Completion *history* is generated demo
 * filler — once a real store is connected, history comes from there, and
 * writing 120 days of sample logs by hand would be noise in the repo.
 */
interface HabitSeed {
  id: string
  name: string
  category: string
  targetPerWeek: number
  /** PRNG seed for the sample history. */
  sampleSeed: number
  /** Share of days completed in the sample history, 0–1. */
  sampleHitRate: number
}

interface TaskSeed {
  id: string
  title: string
  /** Offset from today, resolved at seed time so samples never go stale. */
  dueInDays: number
  /** 24-hour `HH:MM`, local time. */
  dueTime: string
  category?: string
}

/** Deterministic PRNG — sample history must be stable across reloads. */
function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HISTORY_DAYS = 120

function buildHabitHistory(
  seed: number,
  hitRate: number,
  today: Date,
): Record<ISODate, boolean> {
  const random = mulberry32(seed)
  const history: Record<ISODate, boolean> = {}
  for (let i = HISTORY_DAYS; i >= 0; i--) {
    const date = addDays(today, -i)
    // Weekends drift a little — makes the weekly view show a real pattern.
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const chance = isWeekend ? hitRate * 0.7 : hitRate
    if (random() < chance) history[toISO(date)] = true
  }
  return history
}

function buildMacroHistory(today: Date): Record<ISODate, MacroEntry> {
  const random = mulberry32(99)
  const macros: Record<ISODate, MacroEntry> = {}
  for (let i = HISTORY_DAYS; i >= 0; i--) {
    const date = addDays(today, -i)
    const iso = toISO(date)
    const protein = Math.round(120 + random() * 60)
    const carbs = Math.round(150 + random() * 90)
    const fat = Math.round(45 + random() * 30)
    macros[iso] = {
      date: iso,
      kcal: protein * 4 + carbs * 4 + fat * 9,
      protein,
      carbs,
      fat,
    }
  }
  const todayISO = toISO(today)
  macros[todayISO] = { date: todayISO, kcal: 1850, protein: 140, carbs: 190, fat: 58 }
  return macros
}

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

export function createSeedData(today: Date): DashboardData {
  const habits: Habit[] = (habitsSeed as HabitSeed[]).map((seed) => ({
    id: seed.id,
    name: seed.name,
    category: seed.category as CategoryId,
    targetPerWeek: seed.targetPerWeek,
    history: buildHabitHistory(seed.sampleSeed, seed.sampleHitRate, today),
  }))

  const created = toISO(addDays(today, -90))

  const epics: Epic[] = (epicsSeed as Omit<Epic, 'createdAt'>[]).map((epic) => ({
    ...epic,
    category: epic.category as CategoryId,
    createdAt: created,
  }))

  const goals: Goal[] = (goalsSeed as Omit<Goal, 'createdAt'>[]).map((goal) => ({
    ...goal,
    category: goal.category as CategoryId,
    createdAt: created,
  }))

  return {
    epics,
    goals,
    tasks: buildTasks(today),
    trash: [],
    habits,
    macros: buildMacroHistory(today),
    macroTargets: macroTargetsSeed,
    bookmarks: bookmarksSeed as Bookmark[],
  }
}
