import { useState } from 'react'
import { Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Ring } from '@/components/charts/Ring'
import { MacroForm } from './MacroForm'
import { useDashboard } from '@/store/useDashboard'
import { MACRO_COLORS } from '@/lib/colors'
import { toISO } from '@/lib/date'

const MACROS = [
  { key: 'protein', label: 'protein', kcalPerGram: 4 },
  { key: 'carbs', label: 'carbs', kcalPerGram: 4 },
  { key: 'fat', label: 'fat', kcalPerGram: 9 },
] as const

type Editing = 'entry' | 'targets' | null

export function MacrosPanel({ className }: { className?: string }) {
  const { state, actions, meta } = useDashboard()
  const [editing, setEditing] = useState<Editing>(null)
  const iso = toISO(state.anchor)
  const entry = state.data.macros[iso]
  const targets = state.data.macroTargets
  const isToday = iso === meta.todayISO

  return (
    <Card.Root panelId="macros" className={className}>
      <Card.Header>
        <Card.Title>{isToday ? 'Macros today' : 'Macros'}</Card.Title>
        <div className="flex items-center gap-1">
          <Card.Meta className="mr-1 hidden sm:inline">
            {entry ? 'logged' : 'not logged'}
          </Card.Meta>
          <button
            type="button"
            onClick={() => setEditing((current) => (current === 'targets' ? null : 'targets'))}
            aria-expanded={editing === 'targets'}
            title="Edit daily targets"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Edit daily targets</span>
          </button>
          <button
            type="button"
            onClick={() => setEditing((current) => (current === 'entry' ? null : 'entry'))}
            aria-expanded={editing === 'entry'}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-accent-soft transition-colors duration-200 hover:bg-surface-2"
          >
            {entry ? (
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Plus aria-hidden="true" className="h-4 w-4" />
            )}
            {entry ? 'edit' : 'log'}
          </button>
        </div>
      </Card.Header>

      <Card.Body className="flex min-h-0 flex-col gap-4">
        {editing === 'targets' && (
          <div>
            <p className="pb-2 text-xs text-ink-3">
              Daily targets — what a full ring means.
            </p>
            <MacroForm
              initial={targets}
              submitLabel="Save targets"
              minKcal={1}
              onSubmit={(values) => {
                actions.setMacroTargets(values)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {editing === 'entry' && (
          <div>
            <p className="pb-2 text-xs text-ink-3">
              Logging{' '}
              {isToday
                ? 'today'
                : state.anchor.toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
              .
            </p>
            <MacroForm
              key={iso}
              initial={entry}
              submitLabel={entry ? 'Save' : 'Log macros'}
              onSubmit={(values) => {
                actions.setMacroEntry(iso, values)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
              onDelete={
                entry
                  ? () => {
                      actions.removeMacroEntry(iso)
                      setEditing(null)
                    }
                  : undefined
              }
            />
          </div>
        )}

        {!entry ? (
          editing !== 'entry' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
              <p className="text-sm text-ink-3">Nothing logged for this day yet.</p>
              <button
                type="button"
                onClick={() => setEditing('entry')}
                className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Log macros
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-6 pt-2">
            <Ring
              total={targets.kcal}
              centerValue={entry.kcal.toLocaleString()}
              centerLabel="kcal"
              segments={MACROS.map((macro) => ({
                key: macro.key,
                label: macro.label,
                value: entry[macro.key] * macro.kcalPerGram,
                color: MACRO_COLORS[macro.key],
              }))}
            />

            {/* Direct labels double as the legend — identity is never color-alone. */}
            <dl className="grid w-full grid-cols-3 gap-2 text-center">
              {MACROS.map((macro) => (
                <div key={macro.key}>
                  <dt className="flex items-center justify-center gap-1.5 text-xs text-ink-3">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: MACRO_COLORS[macro.key] }}
                    />
                    {macro.label}
                  </dt>
                  <dd className="nums mt-1 font-display text-xl font-semibold text-ink">
                    {entry[macro.key]}
                    <span className="text-sm font-medium text-ink-3">g</span>
                  </dd>
                  <dd className="nums text-[11px] text-ink-3">of {targets[macro.key]}g</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card.Body>
    </Card.Root>
  )
}
