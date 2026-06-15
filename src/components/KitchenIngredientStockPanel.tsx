import { useCallback } from 'react'
import type { KitchenIngredientWithStock } from '../lib/kitchenStock'
import {
  adjustKitchenIngredientStock,
  ingredientStatus,
  kitchenIngredientStats,
} from '../lib/kitchenStock'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Kpi } from '../ui/Kpi'
import { IconAlert, IconCheckCircle, IconStocks } from '../ui/icons'

type Props = {
  storeId: string
  rows: KitchenIngredientWithStock[]
  projectedUsage?: Map<string, number>
  canAdjust?: boolean
  compact?: boolean
  onLoadDemo?: () => void | Promise<void>
  loadDemoBusy?: boolean
}

function statusTone(status: ReturnType<typeof ingredientStatus>) {
  if (status === 'rupture') return 'danger' as const
  if (status === 'alerte') return 'warning' as const
  return 'success' as const
}

function statusLabel(status: ReturnType<typeof ingredientStatus>) {
  if (status === 'rupture') return 'Rupture'
  if (status === 'alerte') return 'Alerte'
  return 'OK'
}

export function KitchenIngredientStockPanel({
  storeId,
  rows,
  projectedUsage,
  canAdjust = false,
  compact = false,
  onLoadDemo,
  loadDemoBusy = false,
}: Props) {
  const stats = kitchenIngredientStats(rows)

  const adjust = useCallback(
    async (ingredientId: string, current: number, delta: number) => {
      await adjustKitchenIngredientStock(storeId, ingredientId, current + delta)
    },
    [storeId],
  )

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p className="text-[12px] text-ink-subtle">
            Aucun ingrédient cuisine configuré. Gérez-les dans{' '}
            <strong className="text-ink">Stocks → Ingrédients cuisine</strong>, ou chargez les
            exemples de démo.
          </p>
          {onLoadDemo ? (
            <Button
              size="sm"
              variant="accent"
              disabled={loadDemoBusy}
              onClick={() => void onLoadDemo()}
            >
              {loadDemoBusy ? 'Chargement…' : 'Charger les exemples cuisine'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Ingrédients en rupture"
            value={String(stats.rupture)}
            tone="rose"
            icon={<IconAlert />}
          />
          <Kpi
            label="Sous le seuil"
            value={String(stats.low)}
            hint={`Sur ${stats.total} références`}
            tone="amber"
            icon={<IconStocks />}
          />
          <Kpi
            label="Stock confortable"
            value={String(stats.ok)}
            tone="accent"
            icon={<IconCheckCircle />}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">Stock ingrédients cuisine</h3>
            <Badge tone="neutral">{rows.length} réf.</Badge>
          </div>
          <div className="space-y-2">
            {rows.map((row) => {
              const status = ingredientStatus(row)
              const projected = projectedUsage?.get(row.id) ?? 0
              const remaining = row.stock - projected
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-sunken/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-ink">{row.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {row.stock} {row.unit}
                      {projected > 0 ? (
                        <span className="text-amber-700">
                          {' '}
                          · réservé {Math.round(projected * 1000) / 1000} · reste{' '}
                          {Math.round(remaining * 1000) / 1000}
                        </span>
                      ) : null}
                      {row.productId ? (
                        <span className="text-ink-subtle"> · lié au catalogue</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
                    {canAdjust ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void adjust(row.id, row.stock, -1)}
                        >
                          -1
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void adjust(row.id, row.stock, 1)}
                        >
                          +1
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void adjust(row.id, row.stock, -0.1)}
                        >
                          -0.1
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void adjust(row.id, row.stock, 0.1)}
                        >
                          +0.1
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
