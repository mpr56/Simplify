import type { CategoryId } from '@/data/types'
import { CATEGORIES } from '@/data/types'

/**
 * Category color as three derived roles. Text is lightened off the base hue:
 * the series steps are tuned for >=3:1 as *marks*, and a chip label is text,
 * which needs 4.5:1.
 */
export function categoryVars(category: CategoryId): React.CSSProperties {
  const base = CATEGORIES[category].token
  return {
    '--c-base': base,
    '--c-tint': `color-mix(in oklab, ${base} 18%, transparent)`,
    '--c-text': `color-mix(in oklab, ${base} 45%, white)`,
  } as React.CSSProperties
}

export function categoryColor(category: CategoryId): string {
  return CATEGORIES[category].token
}

/** Macro nutrients get their own fixed slots, assigned in order and never cycled. */
export const MACRO_COLORS = {
  protein: 'var(--color-series-1)',
  carbs: 'var(--color-series-3)',
  fat: 'var(--color-series-2)',
} as const
