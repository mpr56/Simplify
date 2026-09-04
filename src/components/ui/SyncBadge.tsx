import { Check, CloudOff, Loader2, MonitorSmartphone, TriangleAlert } from 'lucide-react'
import type { SyncStatus } from '@/lib/sync'

/** Status is never color-alone — each state ships an icon and a label. */
const PRESENTATION: Record<
  Exclude<SyncStatus, 'unknown'>,
  { icon: typeof Check; label: string; title: string; className: string }
> = {
  synced: {
    icon: Check,
    label: 'Synced',
    title: 'Saved to your shared store — available on every device',
    className: 'text-good',
  },
  saving: {
    icon: Loader2,
    label: 'Saving',
    title: 'Writing changes to the shared store',
    className: 'text-ink-3',
  },
  local: {
    icon: MonitorSmartphone,
    label: 'This device',
    title: 'No data store configured — changes stay in this browser only',
    className: 'text-ink-3',
  },
  error: {
    icon: TriangleAlert,
    label: 'Offline',
    title: 'Store unreachable — changes are saved locally and will need a re-save',
    className: 'text-warning',
  },
  conflict: {
    icon: TriangleAlert,
    label: 'Reloaded',
    title: 'Another device saved first — this tab reloaded and dropped its unsent change',
    className: 'text-warning',
  },
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === 'unknown') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-3">
        <CloudOff aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="sr-only">Checking sync status</span>
      </span>
    )
  }

  const { icon: Icon, label, title, className } = PRESENTATION[status]

  return (
    <span
      title={title}
      aria-live="polite"
      className={`flex items-center gap-1.5 text-xs font-medium ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${status === 'saving' ? 'animate-spin' : ''}`}
      />
      {label}
    </span>
  )
}
