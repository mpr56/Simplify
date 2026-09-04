import { useId, useRef, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { SyncBadge } from '@/components/ui/SyncBadge'
import { RecycleBinMenu } from './RecycleBinMenu'
import { ResetDialog } from './ResetDialog'
import { useDashboard } from '@/store/useDashboard'
import { activeGoals } from '@/lib/selectors'
import { greeting } from '@/lib/date'

export function TopBar() {
  const { state, actions, meta } = useDashboard()
  const searchId = useId()
  const [resetOpen, setResetOpen] = useState(false)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const inMotion = activeGoals(state.data.goals).length

  const closeReset = () => {
    setResetOpen(false)
    // Leave focus where it started rather than adrift on the body.
    resetButtonRef.current?.focus()
  }

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {greeting(meta.today)}
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {meta.today.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })}
          {' · '}
          {inMotion} {inMotion === 1 ? 'goal' : 'goals'} in motion
        </p>
        <div className="mt-2">
          <SyncBadge status={state.syncStatus} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* min-w-0: an input's intrinsic width would otherwise stop the row
            from shrinking, pushing the buttons off a narrow screen. */}
        <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
          <label htmlFor={searchId} className="sr-only">
            Search goals and habits
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
          <input
            id={searchId}
            type="search"
            value={state.query}
            onChange={(event) => actions.setQuery(event.target.value)}
            placeholder="Search goals, habits…"
            className="h-11 w-full rounded-xl border border-line bg-surface-1 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none"
          />
        </div>

        <RecycleBinMenu />

        {/* Reset replaces the whole document — goals, habits, macros, and the
            recycle bin with them. Clicking only opens the dialog; the
            destructive step is behind a word you have to type. */}
        <button
          ref={resetButtonRef}
          type="button"
          onClick={() => setResetOpen(true)}
          aria-haspopup="dialog"
          title="Reset to sample data"
          aria-label="Reset to sample data"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-1 text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {resetOpen && (
        <ResetDialog
          data={state.data}
          onClose={closeReset}
          onConfirm={() => {
            actions.resetData()
            closeReset()
          }}
        />
      )}
    </header>
  )
}
