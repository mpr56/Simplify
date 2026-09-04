import { useId, useState } from 'react'
import { useMeasure } from '@/hooks/useMeasure'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import { cn } from '@/lib/cn'

export interface TrendPoint {
  iso: string
  label: string
  /** null = no data for that day; the line breaks rather than interpolating. */
  value: number | null
}

const HEIGHT = 150
const PAD_TOP = 12
const PAD_BOTTOM = 22

/**
 * Line + area over time with a crosshair. Gaps are real gaps: connecting
 * across a missing day would invent data that was never logged.
 */
export function TrendLine({
  points,
  color,
  unit,
  reference,
  className,
}: {
  points: TrendPoint[]
  color: string
  unit: string
  /** Optional target line, e.g. a calorie goal. */
  reference?: { value: number; label: string }
  className?: string
}) {
  const gradientId = useId()
  const { ref, width } = useMeasure<HTMLDivElement>()
  const { tooltip, show, hide } = useChartTooltip()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const values = points.map((point) => point.value).filter((v): v is number => v !== null)
  const rawMax = Math.max(reference?.value ?? 0, ...values, 1)
  const max = rawMax * 1.1
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM

  const xFor = (index: number) =>
    points.length > 1 ? (index / (points.length - 1)) * width : width / 2
  const yFor = (value: number) => PAD_TOP + plotHeight * (1 - value / max)

  // Split into contiguous runs so null days break the line instead of
  // being drawn through.
  const runs: { index: number; value: number }[][] = []
  let current: { index: number; value: number }[] = []
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) runs.push(current)
      current = []
    } else {
      current.push({ index, value: point.value })
    }
  })
  if (current.length) runs.push(current)

  const toPath = (run: { index: number; value: number }[]) =>
    run
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.index)} ${yFor(p.value)}`)
      .join(' ')

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!width || points.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const index = Math.max(
      0,
      Math.min(points.length - 1, Math.round((x / width) * (points.length - 1))),
    )
    const point = points[index]
    setActiveIndex(index)
    show({
      x: xFor(index),
      y: point.value === null ? PAD_TOP : yFor(point.value),
      title: point.label,
      rows: [
        {
          label: unit,
          value: point.value === null ? 'no data' : point.value.toLocaleString(),
          color,
        },
      ],
    })
  }

  const handleLeave = () => {
    setActiveIndex(null)
    hide()
  }

  return (
    <div
      ref={ref}
      className={cn('relative touch-pan-y', className)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <ChartTooltip tooltip={tooltip} />
      <svg width={width || '100%'} height={HEIGHT} role="img" aria-label={`${unit} over time`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {reference && width > 0 && (
          <>
            <line
              x1={0}
              x2={width}
              y1={yFor(reference.value)}
              y2={yFor(reference.value)}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={width}
              y={yFor(reference.value) - 5}
              textAnchor="end"
              className="fill-ink-3 text-[10px]"
            >
              {reference.label}
            </text>
          </>
        )}

        {width > 0 &&
          runs.map((run, i) => (
            <g key={i}>
              {run.length > 1 && (
                <path
                  d={`${toPath(run)} L ${xFor(run[run.length - 1].index)} ${
                    PAD_TOP + plotHeight
                  } L ${xFor(run[0].index)} ${PAD_TOP + plotHeight} Z`}
                  fill={`url(#${gradientId})`}
                />
              )}
              <path
                d={toPath(run)}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

        {activeIndex !== null && width > 0 && (
          <>
            <line
              x1={xFor(activeIndex)}
              x2={xFor(activeIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
            />
            {points[activeIndex].value !== null && (
              <circle
                cx={xFor(activeIndex)}
                cy={yFor(points[activeIndex].value)}
                r={4.5}
                fill={color}
                stroke="var(--color-surface-1)"
                strokeWidth={2}
              />
            )}
          </>
        )}

        {/* Sparse ticks — first, middle, last — so labels never collide. */}
        {width > 0 &&
          [0, Math.floor(points.length / 2), points.length - 1]
            .filter((index, i, arr) => points[index] && arr.indexOf(index) === i)
            .map((index) => (
              <text
                key={index}
                x={Math.min(Math.max(xFor(index), 14), width - 14)}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-ink-3 text-[10px]"
              >
                {points[index].label}
              </text>
            ))}
      </svg>
    </div>
  )
}
