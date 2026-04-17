import { useEffect, useMemo, useState } from 'react'
import {
  createStaffProfile,
  listStaffProfiles,
  roleLabel,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { UserRole } from '../auth/types'

type Props = { currentProfileId: string }

type PermRow = { label: string; caissier: boolean; gerant: boolean; admin: boolean }

const PERMISSIONS: PermRow[] = [
  {
    label: 'Caisse (panier, espèces, carte, mobile money si en ligne)',
    caissier: true,
    gerant: true,
    admin: true,
  },
  {
    label: 'Catalogue — consultation',
    caissier: true,
    gerant: true,
    admin: true,
  },
  {
    label:
      'Catalogue — création, archivage, TVA, image, import CSV',
    caissier: false,
    gerant: true,
    admin: true,
  },
  {
    label: 'Modification des prix (vente & revient)',
    caissier: false,
    gerant: true,
    admin: true,
  },
  {
    label: 'Multi-magasins — vue consolidée',
    caissier: true,
    gerant: true,
    admin: true,
  },
  {
    label: 'Multi-magasins — transferts de stock',
    caissier: false,
    gerant: true,
    admin: true,
  },
  {
    label: 'Multi-magasins — onglet création de magasins',
    caissier: false,
    gerant: false,
    admin: true,
  },
  {
    label: 'Rapport journalier & réimpression des reçus',
    caissier: true,
    gerant: true,
    admin: true,
  },
  {
    label: 'Clôture journalière & fond de caisse (ouverture)',
    caissier: false,
    gerant: true,
    admin: true,
  },
  {
    label: 'Remboursements vente (audit)',
    caissier: false,
    gerant: true,
    admin: true,
  },
  {
    label: 'Annulation transaction en cours (panier) — journal d’audit',
    caissier: true,
    gerant: true,
    admin: true,
  },
  {
    label: 'File cloud — « Pousser vers le cloud »',
    caissier: true,
    gerant: true,
    admin: true,
  },
  { label: 'Stocks & inventaire rapide', caissier: false, gerant: true, admin: true },
  { label: 'Tableau de bord', caissier: false, gerant: true, admin: true },
  { label: 'Analytique', caissier: false, gerant: true, admin: true },
  { label: 'Écran Personnel (matrice)', caissier: false, gerant: false, admin: true },
  {
    label: 'Intégrations (marketplace, API, app mobile)',
    caissier: false,
    gerant: false,
    admin: true,
  },
]

function Cell({ ok }: { ok: boolean }) {
  return (
    <td className="px-3 py-2 text-center">
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          ok ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
        }`}
        aria-label={ok ? 'Autorisé' : 'Non'}
      >
        {ok ? '✓' : '—'}
      </span>
    </td>
  )
}

export function PersonnelView({ currentProfileId }: Props) {
  const [profiles, setProfiles] = useState(() => listStaffProfiles())
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('caissier')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  useEffect(() => {
    return subscribeStaffProfiles(() => {
      setProfiles(listStaffProfiles())
    })
  }, [])

  const totalByRole = useMemo(() => {
    const rows = {
      caissier: 0,
      gerant: 0,
      admin: 0,
    }
    for (const p of profiles) rows[p.role] += 1
    return rows
  }, [profiles])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)
    try {
      const created = createStaffProfile({
        displayName,
        role,
        pin,
        password,
      })
      setCreateSuccess(
        `Utilisateur créé : ${created.displayName} (${roleLabel(created.role)}).`,
      )
      setDisplayName('')
      setRole('caissier')
      setPin('')
      setPassword('')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Création impossible.')
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-900 via-slate-800 to-emerald-950 p-8 text-white shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          Rôles utilisateurs
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold">
          Équipe point de vente
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Connexion par <strong className="text-white">PIN ou mot de passe</strong>{' '}
          (même champ). Les droits ci-dessous viennent des rôles ; chaque profil
          peut surcharger certains plafonds en démo (
          <code className="rounded bg-white/10 px-1">permissionOverrides</code>).
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Créer un utilisateur
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Caissiers : {totalByRole.caissier}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Gérants : {totalByRole.gerant}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Admins : {totalByRole.admin}
            </span>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nom complet
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Mariam Traoré"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
              required
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rôle
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
            >
              <option value="caissier">Caissier</option>
              <option value="gerant">Gérant</option>
              <option value="admin">Administrateur</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              PIN (4-8 chiffres)
            </span>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              placeholder="1234"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
              required
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mot de passe (optionnel)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-500/30 focus:ring-2"
            />
          </label>
          <div className="md:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500"
            >
              Créer l’utilisateur
            </button>
            {createSuccess ? (
              <span className="text-xs font-medium text-emerald-700">{createSuccess}</span>
            ) : null}
            {createError ? (
              <span className="text-xs font-medium text-red-600">{createError}</span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
        <h3 className="border-b border-slate-100 bg-slate-50 px-4 py-3 font-display text-sm font-semibold text-slate-900">
          Matrice des permissions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Fonctionnalité</th>
                <th className="px-3 py-3 text-center">Caissier</th>
                <th className="px-3 py-3 text-center">Gérant</th>
                <th className="px-3 py-3 text-center">Administrateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  Remise panier (codes promo) — plafond par défaut
                </td>
                <td className="px-3 py-2.5 text-center text-xs font-mono-nums text-slate-700">
                  5 %
                </td>
                <td className="px-3 py-2.5 text-center text-xs font-mono-nums text-slate-700">
                  20 %
                </td>
                <td className="px-3 py-2.5 text-center text-xs font-mono-nums text-slate-700">
                  100 %
                </td>
              </tr>
              {PERMISSIONS.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 text-slate-700">{row.label}</td>
                  <Cell ok={row.caissier} />
                  <Cell ok={row.gerant} />
                  <Cell ok={row.admin} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => {
          const active = p.id === currentProfileId
          return (
            <article
              key={p.id}
              className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm transition hover:shadow-md ${
                active
                  ? 'border-emerald-400/60 bg-linear-to-br from-emerald-50 to-white ring-2 ring-emerald-500/20'
                  : 'border-slate-200/80 bg-white ring-1 ring-slate-100'
              }`}
            >
              {active ? (
                <span className="absolute right-4 top-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Session active
                </span>
              ) : null}
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.initials}
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    {p.displayName}
                  </h3>
                  <p className="text-sm font-medium text-emerald-700">
                    {roleLabel(p.role)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {p.role === 'admin'
                  ? 'Pilotage complet : personnel, intégrations, création de magasins, tous les plafonds.'
                  : p.role === 'gerant'
                    ? 'Magasin au quotidien : catalogue, prix, stocks, transferts, clôture et analytique — sans gestion des comptes ni infrastructure.'
                    : 'Vente et consultation : caisse, catalogue en lecture, rapport du jour ; remises limitées.'}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
