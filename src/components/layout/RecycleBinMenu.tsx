import { useEffect, useId, useRef, useState } from 'react'
import { Repeat, Target, Trash2, X } from 'lucide-react'
import { useDashboard } from '@/store/useDashboard'
import type { TrashEntry } from '@/data/types'
import { cn } from '@/lib/cn'

/** Coarse on purpose — "3 days ago" is all this needs to say. */
function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'recently'

  const minutes = Math.round((now.getTime() - then) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

function titleOf(entry: TrashEntry): string {
  return entry.kind === 'epic' ? entry.item.title : entry.item.name
}

function describe(entry: TrashEntry): string {
  if (entry.kind === 'habit') {
    const logged = Object.keys(entry.item.history).length
    return logged
      ? `habit · ${logged} logged ${logged === 1 ? 'day' : 'days'} kept`
      : 'habit'
  }
  const count = entry.goalIds.length
  return count
    ? `long-term goal · ${count} ${count === 1 ? 'goal' : 'goals'} to re-attach`
    : 'long-term goal'
}

/**
 * Deleted long-term goals and habits, in a dropdown off the header. It stays
 * mounted even when empty: a recovery affordance that disappears exactly when
 * you have not needed it yet is one you will not find when you do.
 */
export function RecycleBinMenu() {
  const { state, actions, meta } = useDashboard()
  const { trash } = state.data
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape should leave focus where it started, not adrift on the body.
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={trash.length ? `Recycle bin — ${trash.length} deleted` : 'Recycle bin'}
        aria-label={
          trash.length
            ? `Recycle bin, ${trash.length} deleted ${trash.length === 1 ? 'item' : 'items'}`
            : 'Recycle bin, empty'
        }
        className={cn(
          'relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border bg-surface-1 transition-colors duration-200',
          open
            ? 'border-line-strong text-ink'
            : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
        )}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        {trash.length > 0 && (
          <span
            aria-hidden="true"
            className="nums absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
          >
            {trash.length}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Recycle bin"
          // Right-aligned under the trigger, and never wider than the viewport.
          className="absolute right-0 top-full z-50 mt-2 w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line-strong bg-surface-1 shadow-pop"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Recycle bin</h2>
            {trash.length > 0 && (
              <button
                type="button"
                onClick={() => actions.purgeTrash()}
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-critical"
              >
                empty bin
              </button>
            )}
          </header>

          {trash.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-3">
              Nothing deleted. Long-term goals and habits land here when removed.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {trash.map((entry) => (
                <li key={entry.id} className="group flex items-center gap-2.5 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3"
                  >
                    {entry.kind === 'epic' ? (
                      <Target className="h-4 w-4" />
                    ) : (
                      <Repeat className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {titleOf(entry)}
                    </p>
                    {/* Wraps rather than truncates: "2 goals to re-attach" is
                        the line that tells you what restoring will do. */}
                    <p className="text-xs leading-snug text-ink-3">
                      {describe(entry)} · {timeAgo(entry.deletedAt, meta.today)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => actions.restoreTrash(entry.id)}
                    className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                  >
                    <Repeat aria-hidden="true" className="h-3 w-3" />
                    Restore
                    <span className="sr-only">{titleOf(entry)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => actions.purgeTrash(entry.id)}
                    aria-label={`Delete "${titleOf(entry)}" for good`}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
