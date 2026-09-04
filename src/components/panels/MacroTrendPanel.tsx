import { Card } from '@/components/ui/Card'
import { TrendLine } from '@/components/charts/TrendLine'
import { MACRO_COLORS } from '@/lib/colors'
import type { MacroSummary } from '@/lib/selectors'

const AVG_KEYS = [
  { key: 'protein', label: 'protein' },
  { key: 'carbs', label: 'carbs' },
  { key: 'fat', label: 'fat' },
] as const

/** Calorie trend over the range, with daily macro averages underneath. */
export function MacroTrendPanel({
  summary,
  rangeLabel,
  tickFormat,
  className,
}: {
  summary: MacroSummary
  rangeLabel: string
  tickFormat: (date: Date) => string
  className?: string
}) {
  return (
    <Card.Root panelId="calories" className={className}>
      <Card.Header>
        <Card.Title>Calories</Card.Title>
        <Card.Meta>{rangeLabel}</Card.Meta>
      </Card.Header>

      <Card.Body>
        {summary.loggedDays === 0 ? (
          <p className="py-4 text-sm text-ink-3">Nothing logged in this range.</p>
        ) : (
          <>
            <p className="nums font-display text-3xl font-bold text-ink">
              {summary.avg.kcal.toLocaleString()}
              <span className="ml-1.5 text-sm font-medium text-ink-3">
                avg kcal · {summary.loggedDays} days logged
              </span>
            </p>

            <TrendLine
              className="mt-2"
              color="var(--color-accent)"
              unit="kcal"
              reference={{ value: summary.targets.kcal, label: 'target' }}
              points={summary.series.map((point) => ({
                iso: point.iso,
                label: tickFormat(point.date),
                value: point.kcal,
              }))}
            />

            {/* Swatches tie these back to the macro ring on the daily tab. */}
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              {AVG_KEYS.map((macro) => (
                <div key={macro.key}>
                  <dt className="flex items-center justify-center gap-1.5 text-xs text-ink-3">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: MACRO_COLORS[macro.key] }}
                    />
                    avg {macro.label}
                  </dt>
                  <dd className="nums mt-0.5 font-display text-lg font-semibold text-ink">
                    {summary.avg[macro.key]}g
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card.Body>
    </Card.Root>
  )
}
