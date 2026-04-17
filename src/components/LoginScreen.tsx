import { useEffect, useState } from 'react'
import { profileSecretMatches } from '../auth/permissions'
import {
  listStaffProfiles,
  roleLabel,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { StaffAuthMethod, StaffProfile } from '../auth/types'

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

  const loginHint = selected?.password
    ? 'Saisissez le PIN ou le mot de passe du profil.'
    : 'Saisissez le PIN du profil sélectionné.'

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <section className="premium-dark-card premium-ring rounded-3xl border border-amber-200/25 bg-linear-to-b from-slate-950 to-slate-900 p-6 text-slate-100 shadow-2xl shadow-black/25">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/branding/greenfever-logo.png"
                alt="Logo Greenfever"
                className="h-12 w-12 rounded-full border border-amber-200/45 object-cover"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                  The Greenfever
                </p>
                <h1 className="text-xl font-semibold text-white">
                  Connexion gestion
                </h1>
              </div>
            </div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
              Session sécurisée
            </span>
          </div>

          {!selected ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Sélectionnez un profil pour ouvrir l’espace interne.
              </p>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/12 bg-slate-950/65 p-3.5 text-left transition hover:border-amber-200/40 hover:bg-slate-900/90"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-slate-800 text-sm font-semibold text-slate-100">
                    {p.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {p.displayName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {roleLabel(p.role)}
                    </span>
                  </span>
                  <span className="text-amber-100/80" aria-hidden>
                    →
                  </span>
                </button>
              ))}
              <p className="pt-2 text-xs text-slate-400">
                Démo : caissier <code className="rounded bg-slate-800 px-1">1234</code>{' '}
                / <code className="rounded bg-slate-800 px-1">caisse</code> · gérant{' '}
                <code className="rounded bg-slate-800 px-1">4321</code> · admin{' '}
                <code className="rounded bg-slate-800 px-1">5678</code>
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/12 bg-slate-950/65 p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Profil sélectionné
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {selected.displayName}
                  </p>
                  <p className="text-xs text-slate-400">{roleLabel(selected.role)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  Autre profil
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  PIN ou mot de passe
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value)
                    setError(null)
                  }}
                  className="premium-input mt-1.5 w-full rounded-xl bg-slate-900/70 px-4 py-3 font-mono text-lg tracking-wide text-slate-100"
                  placeholder="••••"
                  autoFocus
                />
              </label>
              <p className="mt-2 text-xs text-slate-400">{loginHint}</p>
              {error ? (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="premium-btn mt-5 w-full rounded-xl py-3 text-sm font-semibold"
              >
                Ouvrir l’espace gestion
              </button>
            </form>
          )}
        </section>

      </div>
    </div>
  )
}
