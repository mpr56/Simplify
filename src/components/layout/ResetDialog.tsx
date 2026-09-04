import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CONFIRM_PHRASE, matchesConfirmPhrase } from '@/lib/confirm'
import type { DashboardData } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * What the reset would actually destroy, counted from live state. A generic
 * "this cannot be undone" is easy to click past; "9 habits" is not.
 */
function lossSummary(data: DashboardData): string[] {
  const counts: Array<[number, string, string]> = [
    [data.goals.length, 'goal', 'goals'],
    [data.tasks.length, 'task', 'tasks'],
    [data.epics.length, 'long-term goal', 'long-term goals'],
    [data.habits.length, 'habit', 'habits'],
    [Object.keys(data.macros).length, 'logged macro day', 'logged macro days'],
    [data.bookmarks.length, 'bookmark', 'bookmarks'],
  ]

  return counts
    .filter(([count]) => count > 0)
    .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`)
}

interface ResetDialogProps {
  data: DashboardData
  onConfirm: () => void
  onClose: () => void
}

/**
 * The gate in front of "reset to sample data". Two clicks were not enough —
 * both land on the same 44px target, so a fumbled press could still wipe the
 * document. Typing a word cannot be done by accident.
 */
export function ResetDialog({ data, onConfirm, onClose }: ResetDialogProps) {
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const descriptionId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unlocked = matchesConfirmPhrase(typed)
  const losses = lossSummary(data)
  const binned = data.trash.length

  useEffect(() => {
    inputRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Keep Tab inside the dialog: behind the backdrop is a whole dashboard
      // of controls that must not be reachable while this is open.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-xl border border-line-strong bg-surface-1 p-5 shadow-pop"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-critical"
          >
            <AlertTriangle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              Reset to sample data?
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-snug text-ink-2">
              This replaces everything on the dashboard with the sample data set.
              It cannot be undone.
            </p>
          </div>
        </div>

        {losses.length > 0 && (
          <p className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm leading-snug text-ink-2">
            You would lose <span className="font-medium text-ink">{losses.join(', ')}</span>.
          </p>
        )}

        {binned > 0 && (
          <p className="mt-2 text-xs leading-snug text-ink-3">
            The recycle bin is emptied too — the {binned} deleted{' '}
            {binned === 1 ? 'item' : 'items'} in it{' '}
            {binned === 1 ? 'is' : 'are'} not recoverable afterwards.
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (unlocked) onConfirm()
          }}
          className="mt-4"
        >
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            Type <span className="nums font-semibold text-critical">{CONFIRM_PHRASE}</span> to
            confirm
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={CONFIRM_PHRASE}
            className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none"
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 cursor-pointer items-center rounded-xl border border-line bg-surface-1 px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!unlocked}
              className={cn(
                'flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition-colors duration-200',
                unlocked
                  ? 'cursor-pointer border-critical bg-critical/10 text-critical hover:bg-critical/20'
                  : 'cursor-not-allowed border-line bg-surface-2 text-ink-3',
              )}
            >
              Reset everything
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
