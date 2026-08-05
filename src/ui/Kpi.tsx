'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'
import { cn } from './cn'
import { IconArrowDownRight, IconArrowUpRight } from './icons'

export type KpiTone = 'neutral' | 'accent' | 'violet' | 'amber' | 'sky' | 'rose'

const SPARK_COLOR: Record<KpiTone, string> = {
  neutral: '#5f6f8d',
  accent: '#1463ff',
  violet: '#7452d8',
  amber: '#c98613',
  sky: '#2a86d4',
  rose: '#d84b7a',
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  deltaPositive,
  spark,
  tone = 'neutral',
  className,
  icon,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  delta?: ReactNode
  deltaPositive?: boolean
  spark?: number[]
  tone?: KpiTone
  className?: string
  icon?: ReactNode
}) {
  const sparkData = spark?.map((v, i) => ({ i, v })) ?? []
  const sparkColor = SPARK_COLOR[tone]
  const gradId = `kpi-spark-${tone}`
  // Recharts mesure le parent au 1er paint ; sans layout → width/height -1 en console.
  const [chartReady, setChartReady] = useState(false)
  useEffect(() => {
    if (sparkData.length < 2) return
    const id = requestAnimationFrame(() => setChartReady(true))
    return () => cancelAnimationFrame(id)
  }, [sparkData.length])

  return (
    <div
      className={cn(
        'ui-card relative overflow-hidden p-4 before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-br before:from-white/60 before:to-transparent',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ui-eyebrow">{label}</p>
        {icon ? (
          <span className="text-ink-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate font-mono-nums text-[20px] font-semibold tracking-tight text-ink sm:text-[22px]">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              deltaPositive === undefined
                ? 'text-ink-subtle'
                : deltaPositive
                  ? 'text-emerald-700'
                  : 'text-rose-600',
            )}
          >
            {deltaPositive === undefined ? null : deltaPositive ? (
              <IconArrowUpRight className="h-3 w-3" />
            ) : (
              <IconArrowDownRight className="h-3 w-3" />
            )}
            {delta}
          </span>
        ) : null}
        {hint ? <span className="text-ink-subtle">{hint}</span> : null}
      </div>

      {sparkData.length > 1 ? (
        <div className="mt-3 h-9 w-full min-w-0">
          {chartReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={36}>
              <AreaChart
                data={sparkData}
                margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
