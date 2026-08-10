import { useEffect, useState } from 'react'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from './BrandLogo'
import { useSubscription } from '../context/SubscriptionContext'
import {
  attachStoreCode,
  fetchPlans,
  loginOrganization,
  registerOrganization,
} from '../lib/subscription/api'
import {
  isGmailAddress,
  normalizeGmail,
  validateOwnerPassword,
} from '../lib/subscription/ownerAuth'
import type { SubscriptionSnapshot } from '../lib/subscription/types'
import { formatTrialPeriod, planLabel } from '../lib/subscription/plans'
import type { PlanDefinition, PlanId } from '../lib/subscription/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import { Tabs } from '../ui/Tabs'
import { ROUTES, useSitePath } from '../lib/siteRoutes'
import { cn } from '../ui/cn'
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconKey,
  IconShield,
  IconSparkles,
  IconStar,
  IconStore,
  IconZap,
} from '../ui/icons'

type Mode = 'create' | 'login' | 'attach'

function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  required,
  minLength,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="flex-1"
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </Button>
    </div>
  )
}

const PLAN_ACCENT: Record<
  PlanId,
  { ring: string; gradient: string; glow: string; icon: string }
> = {
  starter: {
    ring: 'ring-slate-400/50',
    gradient: 'from-slate-50/90 to-white',
    glow: 'from-slate-300/20',
    icon: 'text-slate-500',
  },
  pro: {
    ring: 'ring-violet-500/60',
    gradient: 'from-violet-50/90 via-white to-indigo-50/50',
    glow: 'from-violet-400/25',
    icon: 'text-violet-600',
  },
  business: {
    ring: 'ring-amber-400/50',
    gradient: 'from-amber-50/80 via-white to-orange-50/40',
    glow: 'from-amber-300/20',
    icon: 'text-amber-600',
  },
}

const DEFAULT_PLANS: Pick<PlanDefinition, 'id' | 'name' | 'priceFcfa' | 'description'>[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceFcfa: 9_900,
    description: 'Caisse, catalogue et stocks pour un point de vente.',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceFcfa: 24_900,
    description: 'Modules avancés pour restaurants et commerces actifs.',
  },
  {
    id: 'business',
    name: 'Business',
    priceFcfa: 49_900,
    description: 'Multi-sites, CRM, RH et intégrations partenaires.',
  },
]

function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount)
}

function PlanPicker({
  plans,
  selectedPlanId,
  onSelect,
}: {
  plans: Pick<PlanDefinition, 'id' | 'name' | 'priceFcfa' | 'description'>[]
  selectedPlanId: PlanId
  onSelect: (id: PlanId) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id
        const accent = PLAN_ACCENT[plan.id]
        const isFeatured = plan.id === 'pro'

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300',
              selected
                ? `border-transparent shadow-[0_12px_32px_-12px_rgba(23,32,51,0.25)] ring-2 ring-offset-2 ${accent.ring}`
                : 'border-border/70 bg-white hover:border-border-strong hover:shadow-md',
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute inset-0 bg-linear-to-br opacity-0 transition duration-300',
                accent.gradient,
                selected && 'opacity-100',
              )}
            />
            <div
              className={cn(
                'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-linear-to-br blur-2xl transition',
                accent.glow,
                selected ? 'opacity-100' : 'opacity-0',
              )}
            />

            {isFeatured ? (
              <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                <IconStar className="h-2.5 w-2.5 fill-current" />
                Populaire
              </span>
            ) : null}

            <div className="relative">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border bg-white/90 shadow-sm',
                    accent.icon,
                  )}
                >
                  {plan.id === 'business' ? (
                    <IconZap className="h-3.5 w-3.5" />
                  ) : plan.id === 'pro' ? (
                    <IconSparkles className="h-3.5 w-3.5" />
                  ) : (
                    <IconStore className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="font-bold text-ink">{plan.name}</span>
              </div>

              <p className="mt-2 font-mono text-base font-bold tracking-tight text-ink">
                {formatFcfa(plan.priceFcfa)}
                <span className="text-[11px] font-normal text-ink-subtle"> /mois</span>
              </p>

              {plan.description ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted line-clamp-3">
                  {plan.description}
                </p>
              ) : null}

              {selected ? (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <IconCheckCircle className="h-3.5 w-3.5" />
                  Plan sélectionné
                </div>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function BrandPanel({ trialDays }: { trialDays: number }) {
  const trialLabel = formatTrialPeriod(trialDays)
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-linear-to-br from-[#0c1222] via-[#141b2e] to-[#1a1040] p-10 text-white lg:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 15% 25%, rgba(99,102,241,0.45) 0%, transparent 50%),
            radial-gradient(circle at 85% 15%, rgba(20,99,255,0.35) 0%, transparent 45%),
            radial-gradient(circle at 50% 90%, rgba(168,85,247,0.2) 0%, transparent 55%)`,
        }}
      />
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative">
        <BrandLogo size="xl" alt={BRAND_NAME} ring="dark" className="brightness-110" />
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300/90">
          Bienvenue
        </p>
        <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
          La caisse{' '}
          <span className="bg-linear-to-r from-white to-indigo-200 bg-clip-text text-transparent">
            nouvelle génération
          </span>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
          Offline-first, mobile money intégré, multi-postes. Démarrez en quelques minutes
          avec {trialLabel} d’essai gratuit.
        </p>
      </div>

      <ul className="relative mt-10 space-y-4">
        {[
          {
            icon: IconShield,
            color: 'bg-emerald-500/20 text-emerald-300',
            title: 'Compte Gmail + mot de passe',
            desc: 'Le gérant crée l’entreprise avec son adresse @gmail.com.',
          },
          {
            icon: IconStore,
            color: 'bg-sky-500/20 text-sky-300',
            title: 'Employés au quotidien',
            desc: 'Connexion par PIN caissier, simple et sécurisé.',
          },
          {
            icon: IconKey,
            color: 'bg-amber-500/20 text-amber-300',
            title: 'Licence admin',
            desc: 'Clé complète visible dans Abonnement.',
          },
        ].map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                item.color,
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="relative mt-8 flex flex-wrap gap-2">
        <Badge className="border-white/10 bg-white/10 text-white backdrop-blur-sm">
          Essai {trialLabel}
        </Badge>
        <Badge className="border-white/10 bg-white/10 text-white backdrop-blur-sm">
          Mobile money CI
        </Badge>
        <Badge className="border-white/10 bg-white/10 text-white backdrop-blur-sm">
          Offline 7 j
        </Badge>
      </div>
    </div>
  )
}

function WelcomeScreen({
  welcome,
  pendingSnapshot,
  trialDays,
  onCopy,
  onContinue,
}: {
  welcome: { storeCode: string; planName: string; orgName: string }
  pendingSnapshot: SubscriptionSnapshot | null
  trialDays: number
  onCopy: () => void
  onContinue: () => void
}) {
  const trialLabel = formatTrialPeriod(trialDays)
  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-surface-muted via-white to-indigo-50/30 px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/50 bg-white shadow-[0_24px_80px_-24px_rgba(23,32,51,0.35)]">
        <div className="relative overflow-hidden bg-linear-to-br from-[#0c1222] via-[#141b2e] to-[#1a1040] px-8 py-10 text-center text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
            <IconCheck className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <h1 className="relative mt-5 text-2xl font-bold tracking-tight">
            Magasin créé avec succès
          </h1>
          <p className="relative mt-2 text-sm text-slate-300">
            <strong className="text-white">{welcome.orgName}</strong> — plan{' '}
            {welcome.planName}, essai {trialLabel} activé.
          </p>
        </div>

        <div className="p-8">
          <div className="rounded-2xl border border-sky-200/80 bg-linear-to-br from-sky-50 to-indigo-50/50 px-5 py-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-sky-800">
              Code magasin
            </p>
            <p className="mt-3 font-mono text-4xl font-bold tracking-[0.2em] text-sky-950">
              {welcome.storeCode}
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-sky-900/75">
              Sur chaque tablette ou PC supplémentaire, choisissez{' '}
              <strong>« Rejoindre un magasin »</strong> et saisissez ce code.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => void onCopy()}
            >
              Copier le code
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onContinue}
              iconRight={<IconArrowRight className="h-4 w-4" />}
              disabled={!pendingSnapshot}
            >
              Accéder à la caisse
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrganizationSetup({
  onNavigate,
}: {
  onNavigate: (to: string) => void
}) {
  const { completeOnboarding } = useSubscription()
  const [pathname] = useSitePath()
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'create'
    const path = window.location.pathname.toLowerCase()
    const hash = window.location.hash.toLowerCase()
    if (path.startsWith('/connexion') || hash.includes('connexion')) return 'login'
    if (hash.includes('rejoindre')) return 'attach'
    return 'create'
  })
  const [plans, setPlans] = useState<PlanDefinition[]>([])
  const [trialDays, setTrialDays] = useState(30)
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('starter')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSnapshot, setPendingSnapshot] = useState<SubscriptionSnapshot | null>(
    null,
  )
  const [welcome, setWelcome] = useState<{
    storeCode: string
    planName: string
    orgName: string
  } | null>(null)

  useEffect(() => {
    void fetchPlans()
      .then((data) => {
        setPlans(data.plans)
        setTrialDays(data.trialDays)
      })
      .catch(() => {
        /* plans par défaut si API indisponible */
      })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = params.get('plan')
    if (plan === 'starter' || plan === 'pro' || plan === 'business') {
      setSelectedPlanId(plan)
    }
    const path = pathname.toLowerCase()
    const hash = window.location.hash.toLowerCase()
    if (path.startsWith('/connexion') || hash.includes('connexion')) {
      setMode('login')
    } else if (hash.includes('rejoindre')) {
      setMode('attach')
    }
  }, [pathname])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'create') {
        const canonicalEmail = normalizeGmail(email)
        if (!isGmailAddress(email)) {
          throw new Error('Utilisez une adresse Gmail (@gmail.com).')
        }
        const pwdError = validateOwnerPassword(password)
        if (pwdError) throw new Error(pwdError)
        if (password !== confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas.')
        }
        const snap = await registerOrganization({
          name: name.trim(),
          email: canonicalEmail,
          password,
          planId: selectedPlanId,
        })
        setPendingSnapshot(snap)
        if (snap.storeCode) {
          setWelcome({
            storeCode: snap.storeCode,
            planName: planLabel(snap.planId),
            orgName: snap.name,
          })
        } else {
          completeOnboarding(snap)
        }
      } else if (mode === 'login') {
        const canonicalEmail = normalizeGmail(email)
        if (!isGmailAddress(email)) {
          throw new Error('Utilisez votre adresse Gmail (@gmail.com).')
        }
        if (!password) throw new Error('Mot de passe requis.')
        const snap = await loginOrganization({
          email: canonicalEmail,
          password,
        })
        completeOnboarding(snap)
      } else {
        if (!password) throw new Error('Mot de passe gérant requis.')
        const snap = await attachStoreCode(storeCode, password)
        completeOnboarding(snap)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opération impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyCode = async () => {
    if (!welcome?.storeCode) return
    try {
      await navigator.clipboard.writeText(welcome.storeCode)
    } catch {
      /* ignore */
    }
  }

  if (welcome) {
    return (
      <WelcomeScreen
        welcome={welcome}
        pendingSnapshot={pendingSnapshot}
        trialDays={trialDays}
        onCopy={handleCopyCode}
        onContinue={() => {
          if (pendingSnapshot) completeOnboarding(pendingSnapshot)
          setPendingSnapshot(null)
          setWelcome(null)
        }}
      />
    )
  }

  const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS

  return (
    <div className="flex h-svh max-h-svh overflow-hidden bg-surface-muted">
      {/* Panneau marque — desktop (fixe, hors scroll) */}
      <div className="hidden h-full w-[42%] max-w-xl shrink-0 lg:block">
        <BrandPanel trialDays={trialDays} />
      </div>

      {/* Formulaire — seule colonne scrollable */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div className="mx-auto my-auto w-full max-w-2xl px-4 py-8 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => onNavigate(ROUTES.home)}
          className="mb-4 self-start text-sm font-medium text-ink-subtle transition hover:text-ink"
        >
          ← Retour au site
        </button>
        {/* En-tête mobile */}
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <BrandLogo size="lg" alt={BRAND_NAME} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
            Activez votre espace
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            Créez votre magasin ou rejoignez-le avec le code fourni par le gérant.
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <div className="mb-6 hidden lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              Configuration
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
              Activez votre espace CaisseCI
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Choisissez votre plan, créez le magasin ou rejoignez une équipe existante.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-[0_16px_48px_-20px_rgba(23,32,51,0.2)]">
            <div className="border-b border-border/50 bg-linear-to-r from-surface-muted/80 to-white px-6 py-5 sm:px-8">
              <Tabs
                variant="segmented"
                className="w-full"
                active={mode}
                onChange={(v) => {
                  const next = v as Mode
                  setMode(next)
                  setError(null)
                  if (next === 'login') onNavigate(ROUTES.login)
                  else if (next === 'attach') onNavigate(`${ROUTES.signup}#rejoindre`)
                  else onNavigate(ROUTES.signup)
                }}
                items={[
                  { id: 'create', label: 'Créer', icon: <IconSparkles /> },
                  { id: 'login', label: 'Connexion', icon: <IconKey /> },
                  { id: 'attach', label: 'Rejoindre', icon: <IconStore /> },
                ]}
              />
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 p-6 sm:p-8">
              {mode === 'create' ? (
                <>
                  <div>
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-ink">Choisissez votre plan</h2>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          Essai gratuit {formatTrialPeriod(trialDays)} · sans engagement
                        </p>
                      </div>
                      <Badge tone="accent">{formatTrialPeriod(trialDays)} offert</Badge>
                    </div>
                    <PlanPicker
                      plans={displayPlans}
                      selectedPlanId={selectedPlanId}
                      onSelect={setSelectedPlanId}
                    />
                    <p className="mt-3 text-center text-[11px] text-ink-subtle sm:text-left">
                      Paiement mobile money ou carte bancaire à la fin de l’essai.
                    </p>
                    <p className="mt-2 text-center text-xs text-ink-subtle sm:text-left">
                      Déjà inscrit ?{' '}
                      <button
                        type="button"
                        className="font-semibold text-accent hover:underline"
                        onClick={() => {
                          setMode('login')
                          setError(null)
                          onNavigate(ROUTES.login)
                        }}
                      >
                        Connectez-vous avec Gmail
                      </button>
                    </p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border/50 bg-surface-muted/30 p-5">
                    <Field label="Nom de l’entreprise">
                      <Input
                        id="org-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex. Restaurant Le Palmier"
                        required
                        autoComplete="organization"
                      />
                    </Field>
                    <Field label="Compte Gmail du gérant" hint="Adresse @gmail.com (points et +alias = même compte)">
                      <Input
                        id="org-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre.nom@gmail.com"
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                    </Field>
                    <Field label="Mot de passe" hint="8 caractères minimum">
                      <PasswordInput
                        id="org-password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                    </Field>
                    <Field label="Confirmer le mot de passe">
                      <PasswordInput
                        id="org-password-confirm"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                    </Field>
                  </div>
                </>
              ) : mode === 'login' ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-dashed border-violet-300/80 bg-linear-to-br from-violet-50/80 to-indigo-50/40 p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <IconKey className="h-6 w-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-bold text-ink">Connexion gérant</h2>
                    <p className="mt-2 text-sm text-ink-muted">
                      Retrouvez votre magasin avec votre Gmail et le mot de passe créé à l’inscription.
                    </p>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-border/50 bg-surface-muted/30 p-5">
                    <Field label="Adresse Gmail" hint="Même boîte Gmail = même compte (points / +alias)">
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre.nom@gmail.com"
                        required
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Mot de passe">
                      <PasswordInput
                        id="login-password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="current-password"
                        required
                      />
                    </Field>
                  </div>
                  <p className="text-center text-xs text-ink-subtle">
                    Pas encore de compte ?{' '}
                    <button
                      type="button"
                      className="font-semibold text-accent hover:underline"
                      onClick={() => {
                        setMode('create')
                        setError(null)
                        onNavigate(ROUTES.signup)
                      }}
                    >
                      Créer mon magasin
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-dashed border-sky-300/80 bg-linear-to-br from-sky-50/80 to-indigo-50/40 p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <IconStore className="h-6 w-6" />
                    </span>
                    <h2 className="mt-4 text-lg font-bold text-ink">Rejoindre un magasin</h2>
                    <p className="mt-2 text-sm text-ink-muted">
                      Saisissez le code court fourni par le gérant lors de la création du
                      compte.
                    </p>
                  </div>

                  <Field label="Code magasin">
                    <Input
                      id="store-code"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                      placeholder="MAG-A1B2"
                      required
                      className="text-center font-mono text-lg uppercase tracking-[0.25em]"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Mot de passe du gérant">
                    <PasswordInput
                      id="attach-password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                  <p className="text-center text-xs text-ink-subtle">
                    Le code et le mot de passe sont requis une seule fois par appareil.
                  </p>
                </div>
              )}

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-12 w-full text-sm font-semibold"
                variant="primary"
                disabled={busy}
                loading={busy}
                iconRight={!busy ? <IconArrowRight className="h-4 w-4" /> : undefined}
              >
                {busy
                  ? 'Activation en cours…'
                  : mode === 'create'
                    ? 'Créer mon compte'
                    : mode === 'login'
                      ? 'Se connecter'
                      : 'Rejoindre le magasin'}
              </Button>
            </form>
          </div>

          {/* Infos mobile — panneau masqué sur desktop */}
          <ul className="mt-6 space-y-3 lg:hidden">
            {[
              { icon: IconShield, tone: 'text-emerald-600 bg-emerald-50', text: '1er poste : création. Autres : code magasin.' },
              { icon: IconStore, tone: 'text-sky-600 bg-sky-50', text: 'Employés : PIN caissier au quotidien.' },
              { icon: IconKey, tone: 'text-amber-600 bg-amber-50', text: 'Licence admin dans Abonnement.' },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-white px-4 py-3 text-[13px] text-ink-muted shadow-sm"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    item.tone,
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    </div>
  )
}
