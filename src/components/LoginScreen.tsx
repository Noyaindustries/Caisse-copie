import { useEffect, useState } from 'react'
import { profileSecretMatches } from '../auth/permissions'
import {
  listStaffProfiles,
  roleLabel,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { StaffAuthMethod, StaffProfile } from '../auth/types'
import { BRAND_LOGO_SRC, BRAND_NAME } from '../brand'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import { IconArrowLeft, IconArrowRight, IconShield } from '../ui/icons'

type Props = {
  onSuccess: (profile: StaffProfile, authMethod: StaffAuthMethod) => void
}

export function LoginScreen({ onSuccess }: Props) {
  const [profiles, setProfiles] = useState<StaffProfile[]>(() =>
    listStaffProfiles(),
  )
  const [selected, setSelected] = useState<StaffProfile | null>(null)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeStaffProfiles(() => {
      const next = listStaffProfiles()
      setProfiles(next)
      setSelected((prev) =>
        prev ? next.find((p) => p.id === prev.id) ?? null : prev,
      )
    })
  }, [])

  const handleSelect = (p: StaffProfile) => {
    setSelected(p)
    setSecret('')
    setError(null)
  }

  const handleBack = () => {
    setSelected(null)
    setSecret('')
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    const s = secret.trim()
    if (!profileSecretMatches(selected, s)) {
      setError('PIN ou mot de passe incorrect')
      return
    }
    const authMethod: StaffAuthMethod =
      selected.password !== undefined && s === selected.password
        ? 'password'
        : 'pin'
    onSuccess(selected, authMethod)
  }

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden overflow-hidden bg-zinc-900 lg:block">
        <div className="absolute inset-0 opacity-[0.06]">
          <div className="absolute -left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute -right-1/4 bottom-1/4 h-[600px] w-[600px] rounded-full bg-violet-400 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12 text-zinc-100">
          <div className="flex items-center gap-3">
            <img
              src={BRAND_LOGO_SRC}
              alt={BRAND_NAME}
              className="h-10 max-h-11 w-auto max-w-[min(85vw,260px)] rounded-lg border border-white/15 bg-white/95 object-contain object-left p-1"
            />
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

      {/* Right form */}
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md">
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
          </div>

          {!selected ? (
            <div className="space-y-2">
              {profiles.map((p) => (
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
                    </span>
                  </span>
                  <IconArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
                </button>
              ))}

              <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-[11px] text-zinc-600">
                <strong className="font-semibold text-zinc-800">Démo :</strong>{' '}
                caissier <code className="ui-kbd">1234</code>{' '}
                <code className="ui-kbd">caisse</code> · gérant{' '}
                <code className="ui-kbd">4321</code> · admin{' '}
                <code className="ui-kbd">5678</code>
              </p>
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
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value)
                    setError(null)
                  }}
                  placeholder="••••"
                  autoFocus
                  className="font-mono-nums text-base tracking-wider"
                  invalid={!!error}
                />
              </Field>

              <Button type="submit" variant="primary" fullWidth size="lg">
                Ouvrir l’espace gestion
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
