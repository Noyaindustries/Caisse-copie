import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchSubscriptionPlansAdmin,
  saveSubscriptionPlansAdmin,
  type AdminModuleRow,
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

const PLAN_LABELS: Record<PlanId, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

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
  const [modulePlans, setModulePlans] = useState<Record<string, PlanId>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [modulesMessage, setModulesMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [modulesBusy, setModulesBusy] = useState(false)

  const applyStatus = useCallback((data: SubscriptionPlansAdminStatus) => {
    setStatus(data)
    setPrices({
      starter: String(data.prices.starter),
      pro: String(data.prices.pro),
      business: String(data.prices.business),
    })
    setModulePlans({ ...(data.moduleMinPlans ?? {}) })
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

  const modulesBySection = useMemo(() => {
    const rows = status?.modules ?? []
    const map = new Map<string, AdminModuleRow[]>()
    for (const row of rows) {
      const list = map.get(row.section) ?? []
      list.push(row)
      map.set(row.section, list)
    }
    return Array.from(map.entries())
  }, [status?.modules])

  const handleSavePrices = async (e: React.FormEvent) => {
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

  const handleSaveModules = async (e: React.FormEvent) => {
    e.preventDefault()
    setModulesBusy(true)
    setModulesMessage(null)
    try {
      const next = await saveSubscriptionPlansAdmin({
        moduleMinPlans: modulePlans,
      })
      applyStatus(next)
      setModulesMessage('Modules des abonnements enregistrés.')
    } catch (error) {
      setModulesMessage(
        error instanceof Error ? error.message : 'Enregistrement échoué',
      )
    } finally {
      setModulesBusy(false)
    }
  }

  const handleResetModules = async () => {
    if (!status) return
    setModulesBusy(true)
    setModulesMessage(null)
    try {
      const next = await saveSubscriptionPlansAdmin({
        moduleMinPlans: { ...status.moduleDefaults },
      })
      applyStatus(next)
      setModulesMessage('Modules réinitialisés aux valeurs par défaut.')
    } catch (error) {
      setModulesMessage(
        error instanceof Error ? error.message : 'Réinitialisation échouée',
      )
    } finally {
      setModulesBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

          <form onSubmit={(e) => void handleSavePrices(e)} className="space-y-4">
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

      <Card className={theme.card}>
        <CardHeader
          title="Modules des abonnements"
          subtitle="Choisissez le plan minimum à partir duquel chaque module ou capacité plateforme est inclus. Les plans supérieurs héritent automatiquement."
        />
        <CardContent className="space-y-4">
          {status ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={status.modulesSource === 'db' ? 'success' : 'neutral'}>
                {status.modulesSource === 'db'
                  ? 'Modules admin'
                  : 'Défauts code'}
              </Badge>
              <span className={theme.muted}>
                {(status.modules ?? []).length} éléments configurables
              </span>
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSaveModules(e)} className="space-y-5">
            {modulesBySection.map(([section, rows]) => (
              <div key={section} className="space-y-2">
                <p
                  className={cn(
                    'text-[11px] font-bold uppercase tracking-wider',
                    theme.subtle,
                  )}
                >
                  {section}
                </p>
                <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs dark:bg-zinc-900/60">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Module</th>
                        <th className="hidden px-3 py-2 font-semibold sm:table-cell">
                          Type
                        </th>
                        <th className="px-3 py-2 font-semibold">Disponible dès</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const current =
                          modulePlans[row.id] ?? row.minPlan ?? row.defaultMinPlan
                        const changed = current !== row.defaultMinPlan
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-zinc-100 dark:border-zinc-800"
                          >
                            <td className="px-3 py-2.5">
                              <p className="font-medium">{row.label}</p>
                              <p className={cn('mt-0.5 text-[11px]', theme.muted)}>
                                {row.description}
                              </p>
                              {changed ? (
                                <p className={cn('mt-1 text-[10px]', theme.subtle)}>
                                  Défaut : {PLAN_LABELS[row.defaultMinPlan]}
                                </p>
                              ) : null}
                            </td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                              <Badge tone="neutral">
                                {row.kind === 'view' ? 'Menu' : 'Plateforme'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                className={cn(
                                  inputClass,
                                  'min-w-[8.5rem] rounded-lg border px-2 py-1.5 text-sm',
                                )}
                                value={current}
                                onChange={(e) => {
                                  const value = e.target.value as PlanId
                                  setModulePlans((prev) => ({
                                    ...prev,
                                    [row.id]: value,
                                  }))
                                }}
                              >
                                {PLAN_IDS.map((id) => (
                                  <option key={id} value={id}>
                                    {PLAN_LABELS[id]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {modulesMessage ? (
              <p
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-medium',
                  modulesMessage.includes('échou')
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
                )}
              >
                {modulesMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="accent" loading={modulesBusy}>
                Enregistrer les modules
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={modulesBusy || !status}
                onClick={() => void handleResetModules()}
              >
                Revenir aux défauts
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
