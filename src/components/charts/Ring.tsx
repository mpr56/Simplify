import { useId } from 'react'

export interface RingSegment {
  key: string
  label: string
  /** Contribution in the same unit as `total`. */
  value: number
  color: string
}

const SIZE = 190
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Surface gap between adjacent segments, in px along the arc. */
const GAP = 2

/**
 * Part-to-whole gauge: the filled arc is the sum of its segments against a
 * target, with the total as the hero number. Butt caps, not round — round
 * caps overrun the 2px separator and misreport small segments.
 */
export function Ring({
  segments,
  total,
  centerValue,
  centerLabel,
}: {
  segments: RingSegment[]
  total: number
  centerValue: string
  centerLabel: string
}) {
  const titleId = useId()
  const consumed = segments.reduce((sum, segment) => sum + segment.value, 0)

  let offset = 0
  const arcs = segments.map((segment) => {
    const raw = total > 0 ? (segment.value / total) * CIRCUMFERENCE : 0
    const length = Math.max(0, raw - GAP)
    const arc = { ...segment, length, offset }
    offset += raw
    return arc
  })

  return (
    <figure className="flex flex-col items-center">
      <div className="relative">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-labelledby={titleId}
          className="-rotate-90"
        >
          <title id={titleId}>
            {centerValue} of {total} {centerLabel}, split by macronutrient
          </title>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth={STROKE}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-500"
            >
              <title>
                {arc.label}: {Math.round(arc.value)} kcal
              </title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="nums font-display text-4xl font-bold leading-none text-ink">
            {centerValue}
          </span>
          <span className="nums mt-1 text-xs text-ink-3">
            / {total.toLocaleString()} {centerLabel}
          </span>
        </div>
      </div>
      <figcaption className="sr-only">
        {consumed.toLocaleString()} of {total.toLocaleString()} {centerLabel} consumed.
      </figcaption>
    </figure>
  )
}
