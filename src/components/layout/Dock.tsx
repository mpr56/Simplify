import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Bookmark } from '@/data/types'
import { useDashboard } from '@/store/useDashboard'
import { normalizeBookmarkUrl } from '@/lib/bookmarks'

const BASE_SIZE = 48

function faviconFor(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`
  } catch {
    return null
  }
}

function DockIcon({ bookmark }: { bookmark: Bookmark }) {
  // Local PNG -> remote favicon -> lettered tile. A missing file must never
  // leave a hole in the dock.
  const [stage, setStage] = useState<'icon' | 'favicon' | 'letter'>(
    bookmark.icon ? 'icon' : 'favicon',
  )

  const source =
    stage === 'icon' ? bookmark.icon : stage === 'favicon' ? faviconFor(bookmark.url) : null

  if (!source || stage === 'letter') {
    return (
      <span
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center rounded-[28%] bg-surface-3 font-display text-lg font-bold text-ink-2"
      >
        {bookmark.label.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={source}
      alt=""
      draggable={false}
      onError={() => setStage(stage === 'icon' ? 'favicon' : 'letter')}
      className="h-full w-full rounded-[28%] object-cover"
    />
  )
}

function AddBookmarkForm({ onClose }: { onClose: () => void }) {
  const { actions } = useDashboard()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedLabel = label.trim()
    const normalized = normalizeBookmarkUrl(url)
    if (!trimmedLabel || !normalized) return
    actions.addBookmark({ label: trimmedLabel, url: normalized })
    onClose()
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line-strong bg-surface-1/95 p-2 shadow-pop backdrop-blur-xl"
    >
      <label htmlFor="dock-label" className="sr-only">
        Bookmark name
      </label>
      <input
        id="dock-label"
        autoFocus
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Name"
        className="h-9 w-32 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <label htmlFor="dock-url" className="sr-only">
        Bookmark URL
      </label>
      <input
        id="dock-url"
        type="text"
        inputMode="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="example.com"
        className="h-9 w-48 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!label.trim() || !url.trim()}
        className="h-9 cursor-pointer rounded-lg bg-accent px-3 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancel"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
  )
}

/**
 * macOS-style bookmark dock. Hover labels are a pointer affordance only —
 * they float above the row and never affect layout or focus order.
 */
export function Dock() {
  const { state, actions } = useDashboard()
  const bookmarks = state.data.bookmarks
  const [adding, setAdding] = useState(false)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center pb-5">
      <div className="pointer-events-auto">{adding && <AddBookmarkForm onClose={() => setAdding(false)} />}</div>

      <nav
        aria-label="Bookmarks"
        // Scrolls only on small screens. At md+ overflow stays visible so
        // hover labels are never clipped.
        className="pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto rounded-full border border-white/10 bg-surface-1/70 px-3 py-2.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl md:overflow-visible"
      >
        <ul className="flex items-end gap-5">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="group relative flex flex-col items-center">
              {/* Label floats above; it must not push the row around */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-xs text-ink opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {bookmark.label}
              </span>

              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={bookmark.label}
                style={{ width: BASE_SIZE, height: BASE_SIZE }}
                className="block cursor-pointer rounded-[28%] border border-white/5 bg-surface-2/80"
              >
                <DockIcon bookmark={bookmark} />
              </a>

              <button
                type="button"
                onClick={() => actions.removeBookmark(bookmark.id)}
                aria-label={`Remove ${bookmark.label}`}
                className="absolute -top-1 -right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface-2 text-ink-3 opacity-0 transition-opacity duration-200 hover:text-critical focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}

          {/* The dock's own way in. Without it the add form below had no
              trigger at all, and a new bookmark meant editing the document. */}
          <li className="group relative flex flex-col items-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-xs text-ink opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Add bookmark
            </span>

            <button
              type="button"
              onClick={() => setAdding((open) => !open)}
              aria-expanded={adding}
              aria-label="Add bookmark"
              style={{ width: BASE_SIZE, height: BASE_SIZE }}
              className="flex cursor-pointer items-center justify-center rounded-[28%] border border-dashed border-white/15 bg-surface-2/40 text-ink-3 transition-colors duration-200 hover:border-white/30 hover:text-ink"
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
