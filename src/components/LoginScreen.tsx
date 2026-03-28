import { useState } from 'react'
import { profileSecretMatches } from '../auth/permissions'
import { roleLabel, STAFF_PROFILES } from '../auth/profiles'
import type { StaffAuthMethod, StaffProfile } from '../auth/types'

type Props = {
  onSuccess: (profile: StaffProfile, authMethod: StaffAuthMethod) => void
}

export function LoginScreen({ onSuccess }: Props) {
  const [selected, setSelected] = useState<StaffProfile | null>(null)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-emerald-50/40 px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white"
          style={{
            clipPath:
              'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
          aria-hidden
        >
          C
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">CaisseCI</h1>
          <p className="text-sm text-slate-500">Connexion personnel</p>
        </div>
      </div>

      {!selected ? (
        <div className="w-full max-w-md space-y-3">
          <p className="mb-4 text-center text-sm text-slate-600">
            Choisissez un profil pour ouvrir la session.
          </p>
          {STAFF_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {p.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">
                  {p.displayName}
                </span>
                <span className="text-sm text-slate-500">
                  {roleLabel(p.role)}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                →
              </span>
            </button>
          ))}
          <p className="pt-4 text-center text-xs text-slate-400">
            Démo : PIN ou mot de passe — caissier <code className="rounded bg-slate-100 px-1">1234</code> /{' '}
            <code className="rounded bg-slate-100 px-1">caisse</code> · gérant{' '}
            <code className="rounded bg-slate-100 px-1">4321</code> · admin{' '}
            <code className="rounded bg-slate-100 px-1">5678</code>
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
        >
          <button
            type="button"
            onClick={handleBack}
            className="mb-4 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Autre profil
          </button>
          <p className="text-sm text-slate-500">Connecté en tant que</p>
          <p className="mt-1 font-semibold text-slate-900">
            {selected.displayName}
          </p>
          <p className="text-sm text-slate-600">{roleLabel(selected.role)}</p>

          <label className="mt-6 block">
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
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-lg tracking-wide outline-none ring-emerald-500 focus:ring-2"
              placeholder="••••"
              autoFocus
            />
          </label>
          {error ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Ouvrir la caisse
          </button>
        </form>
      )}
    </div>
  )
}
