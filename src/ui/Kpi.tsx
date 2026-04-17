import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'
import { cn } from './cn'
import { IconArrowDownRight, IconArrowUpRight } from './icons'

export type KpiTone = 'neutral' | 'accent' | 'violet' | 'amber' | 'sky' | 'rose'

const SPARK_COLOR: Record<KpiTone, string> = {
  neutral: '#71717a',
  accent: '#059669',
  violet: '#7c3aed',
  amber: '#d97706',
  sky: '#0284c7',
  rose: '#e11d48',
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

  return (
    <div
      className={cn(
        'ui-card relative overflow-hidden p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ui-eyebrow">{label}</p>
        {icon ? (
          <span className="text-zinc-400 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate font-mono-nums text-[20px] font-semibold tracking-tight text-zinc-900 sm:text-[22px]">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              deltaPositive === undefined
                ? 'text-zinc-500'
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
        {hint ? <span className="text-zinc-500">{hint}</span> : null}
      </div>

      {sparkData.length > 1 ? (
        <div className="mt-3 h-9 w-full">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      ) : null}
    </div>
  )
}
