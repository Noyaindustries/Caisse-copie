import { useCallback, useEffect, useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from '../components/BrandLogo'
import {
  fetchOrganizations,
  fetchPlatformAdminStatus,
  fetchPlatformStats,
  loginPlatformAdmin,
  logoutPlatformAdmin,
  patchOrganization,
  runPlatformReminders,
  type AdminOrganization,
  type PlatformStats,
} from '../lib/platformAdmin/api'
import { getPlatformAdminSecret } from '../lib/platformAdmin/session'
import { adminThemeClasses, useAdminTheme, type AdminThemeClasses } from '../lib/platformAdmin/theme'
import { PaymentProvidersAdminPanel } from '../components/platformAdmin/PaymentProvidersAdminPanel'
import type { PlanId, SubscriptionStatus } from '../lib/subscription/types'
import { Badge, type BadgeTone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Kpi } from '../ui/Kpi'
import { cn } from '../ui/cn'
import {
  IconClose,
  IconDash,
  IconLogout,
  IconMenu,
  IconMobile,
  IconSync,
  IconShield,
  IconStore,
} from '../ui/icons'

type AdminSection = 'organizations' | 'payments'

const STATUS_OPTIONS: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
]

const PLAN_OPTIONS: PlanId[] = ['starter', 'pro', 'business']

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusTone(status: SubscriptionStatus): BadgeTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'trialing':
      return 'info'
    case 'past_due':
      return 'warning'
    case 'canceled':
      return 'neutral'
    case 'expired':
      return 'danger'
    default:
      return 'neutral'
  }
}

function statusLabel(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    trialing: 'Essai',
    active: 'Actif',
    past_due: 'Impayé',
    canceled: 'Annulé',
    expired: 'Expiré',
  }
  return labels[status]
}

type Props = {
  onExit: () => void
}

function DetailPanel({
  selected,
  actionMessage,
  actionBusy,
  editPlan,
  editStatus,
  activateDays,
  extendDays,
  theme,
  onEditPlan,
  onEditStatus,
  onActivateDays,
  onExtendDays,
  onRunAction,
  onSmsReminder,
}: {
  selected: AdminOrganization | null
  actionMessage: string | null
  actionBusy: boolean
  editPlan: PlanId
  editStatus: SubscriptionStatus
  activateDays: string
  extendDays: string
  theme: AdminThemeClasses
  onEditPlan: (plan: PlanId) => void
  onEditStatus: (status: SubscriptionStatus) => void
  onActivateDays: (value: string) => void
  onExtendDays: (value: string) => void
  onRunAction: (fn: () => Promise<AdminOrganization>) => void
  onSmsReminder: () => void
}) {
  const inputClass = theme.input

  if (!selected) {
    return (
      <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', theme.muted)}>
        <IconStore className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Sélectionnez une organisation dans le tableau.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 text-sm">
      <div className={cn('rounded-xl border p-4', theme.detailBox)}>
        <p className="text-lg font-bold">{selected.name}</p>
        <p className={cn('mt-1', theme.muted)}>{selected.email}</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          <dt className={theme.subtle}>Licence</dt>
          <dd className="font-mono">{selected.licenseKey}</dd>
          <dt className={theme.subtle}>Magasin</dt>
          <dd>{selected.storeCode ?? '—'}</dd>
          <dt className={theme.subtle}>Essai</dt>
          <dd>{formatDate(selected.trialEndsAt)}</dd>
          <dt className={theme.subtle}>Période</dt>
          <dd>{formatDate(selected.currentPeriodEnd)}</dd>
          <dt className={theme.subtle}>Paiement</dt>
          <dd>{selected.billingProvider ?? '—'}</dd>
        </dl>
      </div>

      {actionMessage ? (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-medium',
            actionMessage.includes('échoué') || actionMessage.includes('impossible')
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
              : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
          )}
        >
          {actionMessage}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className={cn('text-xs font-semibold uppercase tracking-wide', theme.subtle)}>
          Abonnement
        </legend>
        <div className="flex gap-2">
          <select
            value={editPlan}
            onChange={(e) => onEditPlan(e.target.value as PlanId)}
            className={cn(inputClass, 'flex-1 py-1.5')}
            aria-label="Plan"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={actionBusy}
            onClick={() =>
              onRunAction(() => patchOrganization(selected.licenseKey, { planId: editPlan }))
            }
          >
            Plan
          </Button>
        </div>
        <div className="flex gap-2">
          <select
            value={editStatus}
            onChange={(e) => onEditStatus(e.target.value as SubscriptionStatus)}
            className={cn(inputClass, 'flex-1 py-1.5')}
            aria-label="Statut"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={actionBusy}
            onClick={() =>
              onRunAction(() =>
                patchOrganization(selected.licenseKey, { status: editStatus }),
              )
            }
          >
            Statut
          </Button>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={cn('text-xs font-semibold uppercase tracking-wide', theme.subtle)}>
          Durées
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={activateDays}
            onChange={(e) => onActivateDays(e.target.value)}
            className={cn(inputClass, 'w-16 py-1.5')}
            aria-label="Jours d'activation"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={actionBusy}
            onClick={() =>
              onRunAction(() =>
                patchOrganization(selected.licenseKey, {
                  activate: { planId: editPlan, days: Number(activateDays) || 30 },
                }),
              )
            }
          >
            Activer
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={extendDays}
            onChange={(e) => onExtendDays(e.target.value)}
            className={cn(inputClass, 'w-16 py-1.5')}
            aria-label="Jours à prolonger"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={actionBusy}
            onClick={() =>
              onRunAction(() =>
                patchOrganization(selected.licenseKey, {
                  extendTrialDays: Number(extendDays) || 14,
                }),
              )
            }
          >
            + Essai
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={actionBusy}
            onClick={() =>
              onRunAction(() =>
                patchOrganization(selected.licenseKey, {
                  extendPeriodDays: Number(extendDays) || 14,
                }),
              )
            }
          >
            + Période
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={actionBusy}
          onClick={() =>
            onRunAction(() =>
              patchOrganization(selected.licenseKey, {
                grantMobileMoney: { planId: editPlan },
              }),
            )
          }
        >
          Simuler paiement mobile money
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={actionBusy} onClick={onSmsReminder}>
          Rappel SMS (cette org.)
        </Button>
      </div>
    </div>
  )
}

export function PlatformAdminPage({ onExit }: Props) {
  const { dark, toggle } = useAdminTheme()
  const theme = dark ? adminThemeClasses.dark : adminThemeClasses.light
  const inputClass = theme.input

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [authenticated, setAuthenticated] = useState(() => Boolean(getPlatformAdminSecret()))
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [orgs, setOrgs] = useState<AdminOrganization[]>([])
  const [selected, setSelected] = useState<AdminOrganization | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [activateDays, setActivateDays] = useState('30')
  const [extendDays, setExtendDays] = useState('14')
  const [editPlan, setEditPlan] = useState<PlanId>('starter')
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>('trialing')
  const [section, setSection] = useState<AdminSection>('organizations')

  useEffect(() => {
    void fetchPlatformAdminStatus()
      .then((s) => {
        setConfigured(s.configured)
        setMfaRequired(Boolean(s.mfaRequired))
      })
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setEditPlan(selected.planId)
    setEditStatus(selected.status)
  }, [selected])

  const reload = useCallback(async () => {
    setLoadError(null)
    try {
      const [statsData, orgData] = await Promise.all([
        fetchPlatformStats(),
        fetchOrganizations({
          status: filterStatus || undefined,
          plan: filterPlan || undefined,
          q: search.trim() || undefined,
          limit: 200,
        }),
      ])
      setStats(statsData)
      setOrgs(orgData.organizations)
      if (selected) {
        const fresh = orgData.organizations.find((o) => o.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chargement impossible'
      if (message.includes('401') || message.includes('Accès refusé')) {
        logoutPlatformAdmin()
        setAuthenticated(false)
      }
      setLoadError(message)
    }
  }, [filterStatus, filterPlan, search, selected])

  useEffect(() => {
    if (!authenticated) return
    const timer = globalThis.setTimeout(() => {
      void reload()
    }, search ? 300 : 0)
    return () => globalThis.clearTimeout(timer)
  }, [authenticated, reload, search])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginBusy(true)
    setLoginError(null)
    try {
      await loginPlatformAdmin(password, totpCode)
      setAuthenticated(true)
      setPassword('')
      setTotpCode('')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Connexion refusée')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleLogout = () => {
    logoutPlatformAdmin()
    setAuthenticated(false)
    setStats(null)
    setOrgs([])
    setSelected(null)
  }

  const runAction = async (fn: () => Promise<AdminOrganization>) => {
    setActionBusy(true)
    setActionMessage(null)
    try {
      const updated = await fn()
      setSelected(updated)
      setActionMessage('Modification enregistrée.')
      await reload()
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Action échouée')
    } finally {
      setActionBusy(false)
    }
  }

  const kpiCards = useMemo(() => {
    if (!stats) return []
    return [
      { label: 'Organisations', value: stats.total, tone: 'accent' as const },
      { label: 'Actives', value: stats.byStatus.active ?? 0, tone: 'accent' as const },
      { label: 'En essai', value: stats.byStatus.trialing ?? 0, tone: 'sky' as const },
      { label: 'Inscriptions (30 j)', value: stats.recentSignups, tone: 'violet' as const },
    ]
  }, [stats])

  const shellClass = cn('flex min-h-svh flex-col', theme.shell)

  const authShell = (
    <div className={cn(shellClass, 'items-center justify-center px-4 py-10')}>
      <Card className={cn('w-full max-w-md shadow-lg', theme.card)}>
        <CardContent className="p-8">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex-1 text-center">
              <div
                className={cn(
                  'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl',
                  dark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700',
                )}
              >
                <IconShield className="h-6 w-6" />
              </div>
              <BrandLogo size="sm" alt="" className="mx-auto mb-2" />
              <h1 className="text-xl font-bold">Console opérateur</h1>
              <p className={cn('mt-1 text-sm', theme.muted)}>Gestion plateforme {BRAND_NAME}</p>
            </div>
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'rounded-lg p-2 transition',
                dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100',
              )}
              aria-label={dark ? 'Mode clair' : 'Mode sombre'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          {!configured ? (
            <div className="space-y-4 text-center">
              <p className={cn('text-sm leading-relaxed', theme.muted)}>
                Ajoutez{' '}
                <code className={cn('rounded px-1.5 py-0.5 text-xs', theme.detailBox)}>
                  PLATFORM_ADMIN_SECRET
                </code>{' '}
                dans <code className={cn('rounded px-1.5 py-0.5 text-xs', theme.detailBox)}>.env</code>
              </p>
              <Button type="button" variant="secondary" onClick={onExit}>
                Retour au site
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              <label className="block text-left text-sm font-medium">
                Mot de passe administrateur
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClass, 'mt-1.5')}
                  placeholder="Secret défini dans .env"
                />
              </label>
              {mfaRequired ? (
                <label className="block text-left text-sm font-medium">
                  Code MFA (6 chiffres)
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={cn(inputClass, 'mt-1.5 font-mono tracking-widest')}
                    placeholder="000000"
                  />
                </label>
              ) : null}
              {loginError ? (
                <p
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  role="alert"
                >
                  {loginError}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  loginBusy ||
                  !password.trim() ||
                  (mfaRequired && totpCode.length !== 6)
                }
              >
                {loginBusy ? 'Connexion…' : 'Accéder à la console'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={onExit}>
                Retour au site
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )

  if (configured === null) {
    return (
      <div className={cn(shellClass, 'items-center justify-center')}>
        <div
          className={cn(
            'h-10 w-10 animate-spin rounded-full border-2',
            dark ? 'border-zinc-700 border-t-zinc-200' : 'border-zinc-200 border-t-zinc-900',
          )}
        />
      </div>
    )
  }

  if (!configured || !authenticated) {
    return authShell
  }

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 border-b border-inherit px-5 py-4">
        <BrandLogo size="sm" alt="" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{BRAND_NAME}</p>
          <p className={cn('truncate text-xs', theme.subtle)}>Console opérateur</p>
        </div>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fermer le menu"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div>
          <p className={cn('mb-2 px-2 text-[10px] font-bold uppercase tracking-widest', theme.subtle)}>
            Navigation
          </p>
          <button
            type="button"
            onClick={() => {
              setSection('organizations')
              setSidebarOpen(false)
            }}
            className={cn(
              'mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
              section === 'organizations' ? theme.navActive : theme.navIdle,
            )}
          >
            <IconDash className="h-4 w-4" />
            Organisations
          </button>
          <button
            type="button"
            onClick={() => {
              setSection('payments')
              setSidebarOpen(false)
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
              section === 'payments' ? theme.navActive : theme.navIdle,
            )}
          >
            <IconMobile className="h-4 w-4" />
            Wave & Orange
          </button>
        </div>

        {section === 'organizations' ? (
        <>
        <div>
          <p className={cn('mb-2 px-2 text-[10px] font-bold uppercase tracking-widest', theme.subtle)}>
            Filtres
          </p>
          <div className="space-y-2 px-1">
            <input
              type="search"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, 'py-1.5 text-sm')}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={cn(inputClass, 'py-1.5 text-sm')}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous statuts</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className={cn(inputClass, 'py-1.5 text-sm')}
              aria-label="Filtrer par plan"
            >
              <option value="">Tous plans</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 px-1">
            {[
              { label: 'Toutes', value: '' },
              { label: 'Actives', value: 'active' },
              { label: 'Essai', value: 'trialing' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setFilterStatus(chip.value)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition',
                  filterStatus === chip.value
                    ? 'border-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200'
                    : cn('border-transparent', theme.navIdle),
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {stats ? (
          <div className={cn('mx-2 rounded-xl border p-3 text-xs', theme.detailBox)}>
            <p className={cn('mb-2 font-semibold uppercase tracking-wide', theme.subtle)}>Aperçu</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={theme.subtle}>Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
              <div>
                <p className={theme.subtle}>Actives</p>
                <p className="text-lg font-bold">{stats.byStatus.active ?? 0}</p>
              </div>
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </nav>

      <div className="space-y-1 border-t border-inherit p-3">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
            theme.navIdle,
          )}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? 'Mode clair' : 'Mode sombre'}
        </button>
        <button
          type="button"
          onClick={() => void reload()}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
            theme.navIdle,
          )}
        >
          <IconSync className="h-4 w-4" />
          Actualiser
        </button>
        <button
          type="button"
          onClick={onExit}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
            theme.navIdle,
          )}
        >
          Site public
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30',
          )}
        >
          <IconLogout className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </>
  )

  return (
    <div className={cn('flex min-h-svh', theme.shell)}>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r backdrop-blur-sm transition-transform duration-200 lg:translate-x-0',
          theme.sidebar,
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header
          className={cn(
            'sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-sm sm:px-6',
            theme.header,
          )}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn('rounded-lg p-2 lg:hidden', dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold sm:text-base">
                {section === 'payments'
                  ? 'Wave & Orange Money'
                  : 'Abonnements plateforme'}
              </h1>
              <p className={cn('text-xs', theme.muted)}>
                {section === 'payments'
                  ? 'Clés API paiement'
                  : `${orgs.length} organisation(s)`}
              </p>
            </div>
          </div>
          {section === 'organizations' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              iconLeft={<IconSync className="h-3.5 w-3.5" />}
              onClick={() => void reload()}
            >
              Actualiser
            </Button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {section === 'payments' ? (
              <PaymentProvidersAdminPanel theme={theme} inputClass={inputClass} />
            ) : (
              <>
            {loadError ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {loadError}
              </p>
            ) : null}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((kpi) => (
                <Kpi
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  tone={kpi.tone}
                  className={theme.kpi}
                />
              ))}
            </section>

            <Card className={theme.card}>
              <CardHeader title="Organisations" subtitle="Cliquez sur une ligne pour gérer l’abonnement" />
              <CardContent className="overflow-x-auto p-0 pt-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className={cn('border-y text-xs uppercase tracking-wide', theme.tableHead)}>
                    <tr>
                      <th className="px-5 py-3 font-semibold">Magasin</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Statut</th>
                      <th className="px-4 py-3 font-semibold">Fin période</th>
                      <th className="px-4 py-3 font-semibold">Accès</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org) => (
                      <tr
                        key={org.id}
                        onClick={() => {
                          setSelected(org)
                          setActionMessage(null)
                        }}
                        className={cn(
                          'cursor-pointer border-b border-border/40 transition dark:border-zinc-800/80',
                          theme.tableRowHover,
                          selected?.id === org.id && theme.tableRowSelected,
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-semibold">{org.name}</p>
                          <p className={cn('mt-0.5 text-xs', theme.muted)}>
                            {org.storeCode ?? '—'} · {org.email}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone="violet">{org.planName}</Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone(org.status)} dot>
                            {statusLabel(org.status)}
                          </Badge>
                        </td>
                        <td className={cn('px-4 py-3.5', theme.muted)}>
                          {formatDate(org.currentPeriodEnd)}
                        </td>
                        <td className="px-4 py-3.5">
                          {org.usable ? (
                            <Badge tone="success">Oui</Badge>
                          ) : (
                            <Badge tone="danger">Non</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orgs.length === 0 ? (
                  <p className={cn('px-5 py-10 text-center text-sm', theme.muted)}>
                    Aucune organisation trouvée.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className={cn('mt-6 xl:hidden', theme.card)}>
              <CardHeader title="Détail & actions" />
              <CardContent className="p-0">
                <DetailPanel
                  selected={selected}
                  actionMessage={actionMessage}
                  actionBusy={actionBusy}
                  editPlan={editPlan}
                  editStatus={editStatus}
                  activateDays={activateDays}
                  extendDays={extendDays}
                  theme={theme}
                  onEditPlan={setEditPlan}
                  onEditStatus={setEditStatus}
                  onActivateDays={setActivateDays}
                  onExtendDays={setExtendDays}
                  onRunAction={(fn) => void runAction(fn)}
                  onSmsReminder={() => {
                    if (!selected) return
                    void (async () => {
                      setActionBusy(true)
                      try {
                        const result = await runPlatformReminders(selected.id)
                        setActionMessage(
                          `Rappels SMS : ${result.sent} envoyé(s) / ${result.checked} contrôlé(s)`,
                        )
                      } catch (error) {
                        setActionMessage(
                          error instanceof Error ? error.message : 'Rappels échoués',
                        )
                      } finally {
                        setActionBusy(false)
                      }
                    })()
                  }}
                />
              </CardContent>
            </Card>
              </>
            )}
          </main>

          {section === 'organizations' ? (
          <aside
            className={cn(
              'hidden w-[380px] shrink-0 overflow-y-auto border-l xl:block',
              dark ? 'border-zinc-800 bg-[#141a24]/50' : 'border-zinc-200/80 bg-white/50',
            )}
          >
            <div className={cn('border-b px-5 py-4', dark ? 'border-zinc-800' : 'border-zinc-200/80')}>
              <h2 className="text-sm font-bold">Détail & actions</h2>
              <p className={cn('text-xs', theme.muted)}>Organisation sélectionnée</p>
            </div>
            <DetailPanel
              selected={selected}
              actionMessage={actionMessage}
              actionBusy={actionBusy}
              editPlan={editPlan}
              editStatus={editStatus}
              activateDays={activateDays}
              extendDays={extendDays}
              theme={theme}
              onEditPlan={setEditPlan}
              onEditStatus={setEditStatus}
              onActivateDays={setActivateDays}
              onExtendDays={setExtendDays}
              onRunAction={(fn) => void runAction(fn)}
              onSmsReminder={() => {
                if (!selected) return
                void (async () => {
                  setActionBusy(true)
                  try {
                    const result = await runPlatformReminders(selected.id)
                    setActionMessage(
                      `Rappels SMS : ${result.sent} envoyé(s) / ${result.checked} contrôlé(s)`,
                    )
                  } catch (error) {
                    setActionMessage(
                      error instanceof Error ? error.message : 'Rappels échoués',
                    )
                  } finally {
                    setActionBusy(false)
                  }
                })()
              }}
            />
          </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
