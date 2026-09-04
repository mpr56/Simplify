import { createContext, use, useCallback, useId, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'

interface TabsContextValue<T extends string = string> {
  value: T
  setValue: (value: T) => void
  baseId: string
  register: (value: string, node: HTMLButtonElement | null) => void
  focusRelative: (from: string, delta: number | 'first' | 'last') => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = use(TabsContext)
  if (!context) throw new Error('Tabs subcomponents must be used inside <Tabs.Root>')
  return context
}

interface RootProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  children: React.ReactNode
  className?: string
}

function Root<T extends string>({
  value,
  onValueChange,
  children,
  className,
}: RootProps<T>) {
  const baseId = useId()
  // Ordered map of trigger nodes so arrow keys can move focus without
  // the parent having to know the tab list up front.
  const nodesRef = useRef(new Map<string, HTMLButtonElement>())

  const register = useCallback((tabValue: string, node: HTMLButtonElement | null) => {
    if (node) nodesRef.current.set(tabValue, node)
    else nodesRef.current.delete(tabValue)
  }, [])

  const focusRelative = useCallback((from: string, delta: number | 'first' | 'last') => {
    const entries = [...nodesRef.current.entries()]
    if (!entries.length) return
    const index = entries.findIndex(([key]) => key === from)
    let nextIndex: number
    if (delta === 'first') nextIndex = 0
    else if (delta === 'last') nextIndex = entries.length - 1
    else nextIndex = (index + delta + entries.length) % entries.length
    entries[nextIndex]?.[1].focus()
  }, [])

  const context = useMemo<TabsContextValue>(
    () => ({
      value,
      setValue: onValueChange as (next: string) => void,
      baseId,
      register,
      focusRelative,
    }),
    [value, onValueChange, baseId, register, focusRelative],
  )

  return (
    <TabsContext value={context}>
      <div className={className}>{children}</div>
    </TabsContext>
  )
}

function List({
  children,
  label,
  className,
}: {
  children: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-line bg-surface-1 p-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Trigger({
  value: tabValue,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const { value, setValue, baseId, register, focusRelative } = useTabs()
  const selected = value === tabValue

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${tabValue}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${tabValue}`}
      // Roving tabindex: one stop for the whole tablist, arrows move within.
      tabIndex={selected ? 0 : -1}
      ref={(node) => {
        register(tabValue, node)
        return () => register(tabValue, null)
      }}
      onClick={() => setValue(tabValue)}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            focusRelative(tabValue, 1)
            break
          case 'ArrowLeft':
            event.preventDefault()
            focusRelative(tabValue, -1)
            break
          case 'Home':
            event.preventDefault()
            focusRelative(tabValue, 'first')
            break
          case 'End':
            event.preventDefault()
            focusRelative(tabValue, 'last')
            break
        }
      }}
      onFocus={() => setValue(tabValue)}
      className={cn(
        'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200',
        selected
          ? 'bg-surface-3 text-ink'
          : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
      )}
    >
      {children}
    </button>
  )
}

function Panel({
  value: tabValue,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { value, baseId } = useTabs()
  if (value !== tabValue) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${tabValue}`}
      aria-labelledby={`${baseId}-tab-${tabValue}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}

export const Tabs = { Root, List, Trigger, Panel }
