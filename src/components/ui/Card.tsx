import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { loadJSON, saveJSON } from '@/lib/storage'
import { cn } from '@/lib/cn'

interface CollapseState {
  collapsed: boolean
  toggle: () => void
  /** Ties the title's `aria-controls` to the body it opens. */
  bodyId: string
}

/** Null for a plain card — Title and Body then render exactly as they always did. */
const CollapseContext = createContext<CollapseState | null>(null)

/**
 * Collapsed state is per panel per device, like the split ratio: which panels
 * you keep folded away is a property of the screen you are looking at, not of
 * the data, so it stays out of the synced document.
 */
function useCollapse(panelId: string | undefined): CollapseState | null {
  const generatedId = useId()
  const [collapsed, setCollapsed] = useState(
    () => (panelId ? (loadJSON<boolean>(`collapsed:${panelId}`) ?? false) : false),
  )

  useEffect(() => {
    if (panelId) saveJSON(`collapsed:${panelId}`, collapsed)
  }, [panelId, collapsed])

  const toggle = useCallback(() => setCollapsed((current) => !current), [])

  return useMemo(
    () => (panelId ? { collapsed, toggle, bodyId: `${generatedId}-body` } : null),
    [panelId, collapsed, toggle, generatedId],
  )
}

function Root({
  children,
  className,
  panelId,
  ...props
}: React.ComponentProps<'section'> & {
  /** Set to make the card collapsible; also the localStorage key for its state. */
  panelId?: string
}) {
  const collapse = useCollapse(panelId)

  return (
    <CollapseContext value={collapse}>
      <section
        className={cn(
          'flex min-h-0 flex-col rounded-card border border-line bg-surface-1 shadow-card',
          className,
        )}
        {...props}
      >
        {children}
      </section>
    </CollapseContext>
  )
}

function Header({ children, className, ...props }: React.ComponentProps<'header'>) {
  const collapse = useContext(CollapseContext)

  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3',
        // Nothing follows a collapsed body, so the header carries the padding.
        collapse?.collapsed && 'pb-5',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  )
}

function Title({ children, className, ...props }: React.ComponentProps<'h2'>) {
  const collapse = useContext(CollapseContext)
  const heading = cn(
    'font-display text-lg font-semibold tracking-tight text-ink',
    className,
  )

  if (!collapse) {
    return (
      <h2 className={heading} {...props}>
        {children}
      </h2>
    )
  }

  // The heading stays a heading and holds the button, rather than becoming one:
  // the header's other controls ("new goal", "edit") must not end up nested
  // inside it.
  return (
    <h2 className={cn(heading, 'min-w-0')} {...props}>
      <button
        type="button"
        onClick={collapse.toggle}
        aria-expanded={!collapse.collapsed}
        aria-controls={collapse.bodyId}
        className="-ml-1 flex cursor-pointer items-center gap-1 rounded-lg px-1 text-left transition-colors duration-200 hover:text-ink-2"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200',
            !collapse.collapsed && 'rotate-90',
          )}
        />
        {children}
      </button>
    </h2>
  )
}

function Body({ children, className, ...props }: React.ComponentProps<'div'>) {
  const collapse = useContext(CollapseContext)

  if (!collapse) {
    return (
      <div className={cn('min-h-0 flex-1 px-5 pb-5', className)} {...props}>
        {children}
      </div>
    )
  }

  return (
    // 0fr -> 1fr animates to the content's natural height without measuring it.
    // The track size is an inline style because Tailwind has no utility for an
    // `fr` row value — `grid-rows-[0fr]` compiles to nothing at all.
    <div
      id={collapse.bodyId}
      style={{ gridTemplateRows: collapse.collapsed ? '0fr' : '1fr' }}
      className="grid min-h-0 flex-1 transition-[grid-template-rows] duration-300 ease-out"
    >
      {/* The clipper carries no padding of its own: padding on a zero-height
          row still paints, and would leave a sliver of every collapsed panel. */}
      <div className="min-h-0 overflow-hidden">
        {/* `inert` keeps collapsed content out of the tab order and the
            accessibility tree — clipped to zero height is not hidden. */}
        <div
          inert={collapse.collapsed}
          className={cn('px-5 pb-5', className)}
          {...props}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** Shown in place of Body when a panel has nothing to render. */
function Empty({ children, className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('px-5 pb-6 pt-2 text-sm text-ink-3', className)} {...props}>
      {children}
    </p>
  )
}

/** Muted right-hand slot in a header: "last 7 days", "live", a count. */
function Meta({ children, className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span className={cn('text-sm text-ink-3', className)} {...props}>
      {children}
    </span>
  )
}

export const Card = { Root, Header, Title, Meta, Body, Empty }
