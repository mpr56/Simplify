import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { cn } from '@/lib/cn'

const GUTTER = 10
const MIN_PRIMARY_PX = 420
const MIN_SECONDARY_PX = 280
const KEY_STEP = 0.02
const PAGE_STEP = 0.1

function clampRatio(ratio: number, containerWidth: number): number {
  if (containerWidth <= 0) return ratio
  const usable = containerWidth - GUTTER
  const min = MIN_PRIMARY_PX / usable
  const max = 1 - MIN_SECONDARY_PX / usable
  // A narrow container can invert the bounds; center is the only sane answer.
  if (min > max) return 0.5
  return Math.max(min, Math.min(max, ratio))
}

/**
 * Two-pane layout with a draggable, keyboard-operable separator.
 * Below `lg` the panes stack and the separator is removed from the tree
 * entirely — a separator you cannot drag should not be announced.
 */
export function SplitPane({
  primary,
  secondary,
  defaultRatio = 0.72,
  storageKey = 'split-ratio',
  className,
}: {
  primary: React.ReactNode
  secondary: React.ReactNode
  defaultRatio?: number
  storageKey?: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio, resetRatio] = useLocalStorage(storageKey, defaultRatio)
  const [dragging, setDragging] = useState(false)
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => setIsWide(event.matches)
    setIsWide(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Re-clamp when the window resizes: a ratio valid at 1600px can violate
  // the minimums at 1100px.
  useEffect(() => {
    const onResize = () => {
      const width = containerRef.current?.clientWidth ?? 0
      setRatio((current) => clampRatio(current, width))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setRatio])

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const node = containerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const next = (clientX - rect.left - GUTTER / 2) / (rect.width - GUTTER)
      setRatio(clampRatio(next, rect.width))
    },
    [setRatio],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Pointer capture keeps the drag alive over iframes and off-window.
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.preventDefault()
    updateFromClientX(event.clientX)
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  const nudge = (delta: number) => {
    const width = containerRef.current?.clientWidth ?? 0
    setRatio((current) => clampRatio(current + delta, width))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        nudge(-KEY_STEP)
        break
      case 'ArrowRight':
        event.preventDefault()
        nudge(KEY_STEP)
        break
      case 'PageDown':
        event.preventDefault()
        nudge(-PAGE_STEP)
        break
      case 'PageUp':
        event.preventDefault()
        nudge(PAGE_STEP)
        break
      case 'Home':
        event.preventDefault()
        setRatio(clampRatio(0, containerRef.current?.clientWidth ?? 0))
        break
      case 'End':
        event.preventDefault()
        setRatio(clampRatio(1, containerRef.current?.clientWidth ?? 0))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        resetRatio()
        break
    }
  }

  // Suppress selection and cursor flicker globally while dragging.
  useEffect(() => {
    if (!dragging) return
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = ''
    }
  }, [dragging])

  if (!isWide) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {primary}
        {secondary}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('grid min-h-0 items-stretch', className)}
      style={{
        gridTemplateColumns: `minmax(0, ${ratio}fr) ${GUTTER}px minmax(0, ${1 - ratio}fr)`,
      }}
    >
      <div className="min-w-0">{primary}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize dashboard and app panel"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={resetRatio}
        onKeyDown={onKeyDown}
        title="Drag to resize · double-click to reset"
        className="group relative flex cursor-col-resize touch-none items-center justify-center"
      >
        {/* Hairline rail */}
        <span
          aria-hidden="true"
          className={cn(
            'h-full w-px rounded-full transition-colors duration-200',
            dragging
              ? 'bg-accent'
              : 'bg-line-strong group-hover:bg-accent-soft group-focus-visible:bg-accent-soft',
          )}
        />
        {/* Grip: appears on hover/focus/drag so the rail stays quiet at rest */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 h-10 w-1 -translate-y-1/2 rounded-full transition-opacity duration-200',
            dragging
              ? 'bg-accent opacity-100'
              : 'bg-accent-soft opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        />
      </div>

      <div className="min-w-0">{secondary}</div>
    </div>
  )
}
