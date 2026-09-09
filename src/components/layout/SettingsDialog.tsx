import { useEffect, useId, useRef, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import { useDashboard } from '@/store/useDashboard'
import { normalizeBookmarkUrl } from '@/lib/bookmarks'
import { CONFIRM_PHRASE, matchesConfirmPhrase } from '@/lib/confirm'
import {
  backupFilename,
  downloadBackup,
  matchesKey,
  parseBackup,
  requiresKey,
  summarize,
  type ParseResult,
} from '@/lib/backup'
import type { DashboardData } from '@/data/types'
import { cn } from '@/lib/cn'

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 hover:border-line-strong focus:border-accent focus:outline-none'
const LABEL = 'text-xs font-medium text-ink-3'

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs leading-snug text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Bookmarks() {
  const { state, actions } = useDashboard()
  const uid = useId()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const bookmarks = state.data.bookmarks
  const normalized = normalizeBookmarkUrl(url)
  const ready = Boolean(label.trim() && normalized)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready || !normalized) return
    actions.addBookmark({ label: label.trim(), url: normalized })
    setLabel('')
    setUrl('')
  }

  return (
    <>
      {bookmarks.length > 0 && (
        <ul className="mb-3 flex flex-col divide-y divide-line rounded-lg border border-line">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{bookmark.label}</span>
                <span className="block truncate text-xs text-ink-3">{bookmark.url}</span>
              </span>
              <button
                type="button"
                onClick={() => actions.removeBookmark(bookmark.id)}
                aria-label={`Remove ${bookmark.label}`}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-28 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-label`} className={LABEL}>
            Name
          </label>
          <input
            id={`${uid}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Gmail"
            className={FIELD}
          />
        </div>
        <div className="flex min-w-40 flex-[2] flex-col gap-1">
          <label htmlFor={`${uid}-url`} className={LABEL}>
            Address
          </label>
          <input
            id={`${uid}-url`}
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="mail.google.com"
            className={FIELD}
          />
        </div>
        <button
          type="submit"
          disabled={!ready}
          className="h-10 shrink-0 cursor-pointer rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </>
  )
}

/** Null until a file has been chosen and read. */
type Staged = { name: string; result: ParseResult } | null

function Data({ data, today }: { data: DashboardData; today: Date }) {
  const { actions } = useDashboard()
  const uid = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [staged, setStaged] = useState<Staged>(null)
  const [secret, setSecret] = useState('')
  const [done, setDone] = useState(false)

  const gated = requiresKey()
  const unlocked = gated ? matchesKey(secret) : matchesConfirmPhrase(secret)

  const choose = async (file: File | undefined) => {
    setDone(false)
    setSecret('')
    if (!file) {
      setStaged(null)
      return
    }
    setStaged({ name: file.name, result: parseBackup(await file.text(), today) })
  }

  const confirm = () => {
    if (!staged?.result.ok || !unlocked) return
    actions.importData(staged.result.data)
    setStaged(null)
    setSecret('')
    setDone(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadBackup(data, backupFilename(today))}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Export {backupFilename(today)}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium text-ink-2 transition-colors duration-200 hover:border-line-strong hover:text-ink"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          Import a backup
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void choose(event.target.files?.[0])}
          className="sr-only"
        />
      </div>

      {done && (
        <p className="mt-3 text-sm text-ink-2">
          Imported. The restored document is on screen and syncing.
        </p>
      )}

      {staged && !staged.result.ok && (
        <p className="mt-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
          {staged.result.error}
        </p>
      )}

      {staged?.result.ok && (
        <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-sm leading-snug text-ink-2">
            <span className="font-medium text-ink">{staged.name}</span> holds{' '}
            {summarize(staged.result.data)}. Importing replaces everything currently on
            the dashboard, including the recycle bin.
          </p>

          {/* An import overwrites a synced document on every device, so it sits
              behind the same kind of gate as the reset. */}
          <label htmlFor={`${uid}-secret`} className="mt-3 block text-sm font-medium text-ink">
            {gated ? (
              'Enter the dashboard key to confirm'
            ) : (
              <>
                Type <span className="nums font-semibold text-critical">{CONFIRM_PHRASE}</span>{' '}
                to confirm
              </>
            )}
          </label>
          <input
            id={`${uid}-secret`}
            type={gated ? 'password' : 'text'}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={gated ? 'dashboard key' : CONFIRM_PHRASE}
            className={`${FIELD} mt-1.5`}
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setStaged(null)
                setSecret('')
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!unlocked}
              className={cn(
                'h-10 rounded-lg border px-4 text-sm font-semibold transition-colors duration-200',
                unlocked
                  ? 'cursor-pointer border-critical bg-critical/10 text-critical hover:bg-critical/20'
                  : 'cursor-not-allowed border-line bg-surface-2 text-ink-3',
              )}
            >
              Replace everything
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * The dashboard's settings. Deliberately a dialog rather than a page: every
 * setting here is something you change once and leave, and none of it is worth
 * a route.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { state, meta } = useDashboard()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Keep Tab inside the dialog — the dashboard behind it must not be
      // reachable while this is open.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not(.sr-only), [href]',
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 py-10">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-xl border border-line-strong bg-surface-1 p-5 shadow-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Section title="Bookmarks" hint="The dock along the bottom of the dashboard.">
            <Bookmarks />
          </Section>

          <Section
            title="Backup"
            hint="Export keeps a copy you own. Import restores one, replacing everything."
          >
            <Data data={state.data} today={meta.today} />
          </Section>
        </div>
      </div>
    </div>
  )
}
