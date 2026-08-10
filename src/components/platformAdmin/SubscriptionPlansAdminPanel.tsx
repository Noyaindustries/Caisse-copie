import { useCallback, useEffect, useState } from 'react'
import {
  fetchSubscriptionPlansAdmin,
  saveSubscriptionPlansAdmin,
  type SubscriptionPlansAdminStatus,
} from '../../lib/platformAdmin/api'
import type { PlanId } from '../../lib/subscription/types'
import type { AdminThemeClasses } from '../../lib/platformAdmin/theme'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, CardContent, CardHeader } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { cn } from '../../ui/cn'

type Props = {
  theme: AdminThemeClasses
  inputClass: string
}

const PLAN_IDS: PlanId[] = ['starter', 'pro', 'business']

function formatFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

export function SubscriptionPlansAdminPanel({ theme, inputClass }: Props) {
  const [status, setStatus] = useState<SubscriptionPlansAdminStatus | null>(null)
  const [prices, setPrices] = useState<Record<PlanId, string>>({
    starter: '',
    pro: '',
    business: '',
  })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const applyStatus = useCallback((data: SubscriptionPlansAdminStatus) => {
    setStatus(data)
    setPrices({
      starter: String(data.prices.starter),
      pro: String(data.prices.pro),
      business: String(data.prices.business),
    })
  }, [])

  const reload = useCallback(async () => {
    setLoadError(null)
    try {
      applyStatus(await fetchSubscriptionPlansAdmin())
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Chargement impossible',
      )
    }
  }, [applyStatus])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSaveMessage(null)
    try {
      const parse = (raw: string, label: string): number => {
        const n = Number.parseInt(raw.replace(/\s/g, ''), 10)
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Prix ${label} invalide.`)
        }
        return n
      }
      const next = await saveSubscriptionPlansAdmin({
        starter: parse(prices.starter, 'Starter'),
        pro: parse(prices.pro, 'Pro'),
        business: parse(prices.business, 'Business'),
      })
      applyStatus(next)
      setSaveMessage('Prix des abonnements enregistrés.')
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Enregistrement échoué',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!status) return
    setBusy(true)
    setSaveMessage(null)
    try {
      const next = await saveSubscriptionPlansAdmin({
        starter: status.defaults.starter,
        pro: status.defaults.pro,
        business: status.defaults.business,
      })
      applyStatus(next)
      setSaveMessage('Prix réinitialisés aux valeurs par défaut.')
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Réinitialisation échouée',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className={theme.card}>
        <CardHeader
          title="Prix des abonnements"
          subtitle="Ces montants s’affichent sur le site, à l’inscription et aux paiements (Wave, Orange Money, Stripe)."
        />
        <CardContent className="space-y-4">
          {loadError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {loadError}
            </p>
          ) : null}

          {status ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={status.source === 'db' ? 'success' : 'neutral'}>
                {status.source === 'db' ? 'Prix admin' : 'Défauts code'}
              </Badge>
              {status.updatedAt ? (
                <span className={theme.muted}>
                  MAJ{' '}
                  {new Date(status.updatedAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            {PLAN_IDS.map((id) => {
              const plan = status?.plans.find((p) => p.id === id)
              const defaultPrice = status?.defaults[id]
              return (
                <div
                  key={id}
                  className={cn(
                    'rounded-xl border p-4',
                    theme.detailBox ?? 'border-zinc-200',
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">{plan?.name ?? id}</p>
                      <p className={cn('mt-0.5 text-xs', theme.muted)}>
                        {plan?.description ?? '—'}
                      </p>
                    </div>
                    {defaultPrice != null ? (
                      <p className={cn('text-[11px]', theme.subtle)}>
                        Défaut : {formatFcfa(defaultPrice)} / mois
                      </p>
                    ) : null}
                  </div>
                  <Field label={`Prix mensuel ${plan?.name ?? id} (FCFA)`} required>
                    <Input
                      inputMode="numeric"
                      value={prices[id]}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      className={cn(inputClass, 'font-mono-nums')}
                      placeholder="Ex. 9900"
                    />
                  </Field>
                </div>
              )
            })}

            {saveMessage ? (
              <p
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-medium',
                  saveMessage.includes('échou') || saveMessage.includes('invalide')
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
                )}
              >
                {saveMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="accent" loading={busy}>
                Enregistrer les prix
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !status}
                onClick={() => void handleResetDefaults()}
              >
                Revenir aux défauts
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void reload()}
              >
                Actualiser
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
