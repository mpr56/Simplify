import { useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { MACRO_COLORS } from '@/lib/colors'
import type { MacroTargets } from '@/data/types'

/** A day's numbers and a day's targets are the same four fields. */
export type MacroValues = MacroTargets

/** Atwater factors — how the macro grams add up to the calorie figure. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

const GRAM_FIELDS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
] as const

const MAX_GRAMS = 2000
const MAX_KCAL = 20000

const FIELD =
  'h-10 w-full rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'
const LABEL = 'text-xs font-medium text-ink-3'

/** Half-typed and empty values are normal mid-edit; only the result must be sane. */
function toInt(raw: string, max: number, min = 0): number {
  const parsed = Math.round(Number(raw))
  if (raw.trim() === '' || !Number.isFinite(parsed)) return min
  return Math.max(min, Math.min(max, parsed))
}

export function MacroForm({
  initial,
  submitLabel,
  minKcal = 0,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: MacroValues
  submitLabel: string
  /**
   * Targets pass 1: a zero *target* is a broken gauge, while a zero *logged*
   * day is just a fast, so the floor cannot live in the shared clamp.
   */
  minKcal?: number
  onSubmit: (values: MacroValues) => void
  onCancel: () => void
  /** Only for an existing entry — clearing a target makes no sense. */
  onDelete?: () => void
}) {
  const uid = useId()
  const [grams, setGrams] = useState({
    protein: String(initial?.protein ?? ''),
    carbs: String(initial?.carbs ?? ''),
    fat: String(initial?.fat ?? ''),
  })
  const [kcal, setKcal] = useState(String(initial?.kcal ?? ''))

  const values: MacroValues = {
    protein: toInt(grams.protein, MAX_GRAMS),
    carbs: toInt(grams.carbs, MAX_GRAMS),
    fat: toInt(grams.fat, MAX_GRAMS),
    kcal: toInt(kcal, MAX_KCAL, minKcal),
  }

  const fromGrams =
    values.protein * KCAL_PER_GRAM.protein +
    values.carbs * KCAL_PER_GRAM.carbs +
    values.fat * KCAL_PER_GRAM.fat

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(values)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="flex flex-col gap-3 rounded-xl border border-line-strong bg-surface-2 p-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GRAM_FIELDS.map((field, index) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label htmlFor={`${uid}-${field.key}`} className={`${LABEL} flex items-center gap-1.5`}>
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: MACRO_COLORS[field.key] }}
              />
              {field.label} (g)
            </label>
            <input
              id={`${uid}-${field.key}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_GRAMS}
              autoFocus={index === 0}
              value={grams[field.key]}
              onChange={(event) =>
                setGrams((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onBlur={() =>
                setGrams((current) => ({ ...current, [field.key]: String(values[field.key]) }))
              }
              placeholder="0"
              className={`${FIELD} nums`}
            />
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-kcal`} className={LABEL}>
            Calories
          </label>
          <input
            id={`${uid}-kcal`}
            type="number"
            inputMode="numeric"
            min={minKcal}
            max={MAX_KCAL}
            value={kcal}
            onChange={(event) => setKcal(event.target.value)}
            onBlur={() => setKcal(String(values.kcal))}
            placeholder="0"
            className={`${FIELD} nums`}
          />
        </div>
      </div>

      {/* Calories are entered, not computed: a label's figure rarely matches
          4/4/9 exactly, and the logged number should be the one on the label.
          This fills it from the grams when there is nothing better to go on. */}
      {fromGrams > 0 && fromGrams !== values.kcal && (
        <button
          type="button"
          onClick={() => setKcal(String(fromGrams))}
          className="self-start cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-accent-soft transition-colors duration-200 hover:bg-surface-3"
        >
          match macros ({fromGrams.toLocaleString()} kcal)
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-critical"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Clear day
          </button>
        )}
      </div>
    </form>
  )
}
