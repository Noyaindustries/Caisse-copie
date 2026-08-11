import { useEffect, useMemo, useState } from 'react'
import { profileSecretMatches } from '../auth/permissions'
import {
  DEFAULT_OWNER_PIN,
  ensureOwnerAdminProfile,
  hydrateStaffFromRemote,
  listActiveStaffProfiles,
  roleLabel,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { StaffAuthMethod, StaffProfile } from '../auth/types'
import { useSubscription } from '../context/SubscriptionContext'
import { db } from '../db/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { BRAND_NAME } from '../brand'
import { BrandLogo } from './BrandLogo'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input } from '../ui/Input'
import { IconArrowLeft, IconArrowRight, IconEye, IconEyeOff, IconShield } from '../ui/icons'

type Props = {
  onSuccess: (profile: StaffProfile, authMethod: StaffAuthMethod) => void
  onBackToStorefront?: () => void
  onOpenSubscription?: () => void
}

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

export function LoginScreen({
  onSuccess,
  onBackToStorefront,
  onOpenSubscription,
}: Props) {
  const { organization } = useSubscription()
  const [profiles, setProfiles] = useState<StaffProfile[]>(() =>
    listActiveStaffProfiles(),
  )
  const [selected, setSelected] = useState<StaffProfile | null>(null)
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [bootstrappedOwner, setBootstrappedOwner] = useState(false)
  const stores = useLiveQuery(() => db.stores.orderBy('sortOrder').toArray(), [], []) ?? []
  const storeNameById = new Map(stores.map((store) => [store.id, store.name]))

  useEffect(() => {
    setProfiles(listActiveStaffProfiles())
    if (listActiveStaffProfiles().length > 0) return
    const created = ensureOwnerAdminProfile(organization?.name ?? 'Administrateur')
    if (created) {
      setBootstrappedOwner(true)
      setProfiles(listActiveStaffProfiles())
    }
  }, [organization?.name])

  useEffect(() => {
    let cancelled = false
    void hydrateStaffFromRemote().then((count) => {
      if (cancelled || count === 0) return
      setProfiles(listActiveStaffProfiles())
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return subscribeStaffProfiles(() => {
      const next = listActiveStaffProfiles()
      setProfiles(next)
      setSelected((prev) =>
        prev ? next.find((p) => p.id === prev.id) ?? null : prev,
      )
    })
  }, [])

  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [lockedUntil])

  const lockRemainingSec = useMemo(() => {
    if (lockedUntil <= now) return 0
    return Math.ceil((lockedUntil - now) / 1000)
  }, [lockedUntil, now])

  const handleSelect = (p: StaffProfile) => {
    setSelected(p)
    setSecret('')
    setError(null)
    setShowSecret(false)
  }

  const handleBack = () => {
    setSelected(null)
    setSecret('')
    setError(null)
    setShowSecret(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    if (lockRemainingSec > 0) {
      setError(`Trop d’essais. Réessayez dans ${lockRemainingSec}s.`)
      return
    }
    const s = secret.trim()
    if (!profileSecretMatches(selected, s)) {
      const nextFails = failedAttempts + 1
      setFailedAttempts(nextFails)
      if (nextFails >= MAX_FAILED_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS)
        setFailedAttempts(0)
        setError(`Trop d’essais. Compte verrouillé 30 secondes.`)
      } else {
        setError(
          `PIN ou mot de passe incorrect (${MAX_FAILED_ATTEMPTS - nextFails} essai(s) restant(s))`,
        )
      }
      return
    }
    setFailedAttempts(0)
    setLockedUntil(0)
    const authMethod: StaffAuthMethod =
      selected.password !== undefined && s === selected.password
        ? 'password'
        : 'pin'
    onSuccess(selected, authMethod)
  }

  return (
    <div className="grid h-svh max-h-svh max-w-[100vw] grid-cols-1 overflow-hidden lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-zinc-900 lg:block">
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute -left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute -right-1/4 bottom-1/4 h-[600px] w-[600px] rounded-full bg-violet-400 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12 text-zinc-100">
          <div className="flex items-center gap-3">
            <BrandLogo size="lg" alt={BRAND_NAME} ring="dark" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
              Espace interne
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Le point de vente,
              <br />
              entièrement local et sécurisé.
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-zinc-400">
              Caisse, stocks, paiements, rapport quotidien et synchronisation
              cloud — fonctionne hors ligne.
            </p>
          </div>
          <p className="text-[11px] text-zinc-500">
            © {new Date().getFullYear()} · Démo locale · Vos données restent sur
            cet appareil
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-zinc-50">
      <div className="mx-auto my-auto w-full max-w-md p-6">
        <div className="w-full">
          {onBackToStorefront || onOpenSubscription ? (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {onBackToStorefront ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  iconLeft={<IconArrowLeft />}
                  onClick={onBackToStorefront}
                >
                  Boutique
                </Button>
              ) : null}
              {onOpenSubscription ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onOpenSubscription}
                >
                  Mon abonnement
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <IconShield className="h-3 w-3" />
              Session sécurisée
            </span>
            <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-zinc-900">
              Connexion
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              {selected
                ? `Saisissez votre PIN${selected.password ? ' ou mot de passe' : ''}.`
                : 'Sélectionnez votre profil pour continuer.'}
            </p>
            {bootstrappedOwner && !selected ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Premier accès : connectez-vous avec le PIN{' '}
                <span className="font-mono font-semibold">{DEFAULT_OWNER_PIN}</span>
                , puis changez-le dans Personnel.
              </p>
            ) : null}
          </div>

          {!selected ? (
            <div className="space-y-2">
              {profiles.length === 0 ? (
                <EmptyState
                  title="Aucun profil actif"
                  description="Demandez à un administrateur de créer un utilisateur dans Personnel."
                />
              ) : (
                profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="ui-card-hover group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-bold text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white">
                      {p.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-zinc-900">
                        {p.displayName}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {roleLabel(p.role)}
                        {p.storeId
                          ? ` · ${storeNameById.get(p.storeId) ?? p.storeId}`
                          : ''}
                      </span>
                    </span>
                    <IconArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
                  </button>
                ))
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-[12px] font-bold text-white">
                    {selected.initials}
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-zinc-900">
                      {selected.displayName}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {roleLabel(selected.role)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={<IconArrowLeft />}
                  onClick={handleBack}
                >
                  Autre
                </Button>
              </div>

              <Field
                label="PIN ou mot de passe"
                error={error ?? undefined}
                required
              >
                <div className="flex items-center gap-2">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    autoComplete="current-password"
                    inputMode="numeric"
                    value={secret}
                    onChange={(e) => {
                      setSecret(e.target.value)
                      setError(null)
                    }}
                    placeholder="••••"
                    autoFocus
                    disabled={lockRemainingSec > 0}
                    className="font-mono-nums text-base tracking-wider"
                    invalid={!!error}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={
                      showSecret ? 'Masquer le secret' : 'Afficher le secret'
                    }
                    onClick={() => setShowSecret((v) => !v)}
                  >
                    {showSecret ? <IconEyeOff /> : <IconEye />}
                  </Button>
                </div>
              </Field>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={lockRemainingSec > 0}
              >
                {lockRemainingSec > 0
                  ? `Réessayer dans ${lockRemainingSec}s`
                  : 'Ouvrir l’espace gestion'}
              </Button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
