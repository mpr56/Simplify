import type { CategoryId } from '@/data/types'
import { CATEGORIES } from '@/data/types'
import { categoryVars } from '@/lib/colors'
import { cn } from '@/lib/cn'

export function Tag({
  category,
  label,
  className,
}: {
  category: CategoryId
  /** Overrides the category's own label — e.g. a linked goal's title, colored by its category. */
  label?: string
  className?: string
}) {
  return (
    <span
      style={categoryVars(category)}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium',
        'bg-[var(--c-tint)] text-[var(--c-text)]',
        className,
      )}
    >
      {label ?? CATEGORIES[category].label}
    </span>
  )
}
