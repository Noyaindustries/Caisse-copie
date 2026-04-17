import { useEffect, useMemo, useState } from 'react'
import {
  createStaffProfile,
  listStaffProfiles,
  roleLabel,
  subscribeStaffProfiles,
} from '../auth/profiles'
import type { UserRole } from '../auth/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader, SectionHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'
import { IconCheck, IconClose, IconShield } from '../ui/icons'

type Props = { currentProfileId: string }

type PermRow = {
  label: string
  caissier: boolean
  gerant: boolean
  admin: boolean
}

const PERMISSIONS: PermRow[] = [
  { label: 'Caisse (panier, espèces, carte, mobile money)', caissier: true, gerant: true, admin: true },
  { label: 'Catalogue — consultation', caissier: true, gerant: true, admin: true },
  { label: 'Catalogue — création, archivage, TVA, image, import CSV', caissier: false, gerant: true, admin: true },
  { label: 'Modification des prix (vente & revient)', caissier: false, gerant: true, admin: true },
  { label: 'Multi-magasins — vue consolidée', caissier: true, gerant: true, admin: true },
  { label: 'Multi-magasins — transferts de stock', caissier: false, gerant: true, admin: true },
  { label: 'Multi-magasins — création de magasins', caissier: false, gerant: false, admin: true },
  { label: 'Rapport journalier & réimpression des reçus', caissier: true, gerant: true, admin: true },
  { label: 'Clôture journalière & fond de caisse', caissier: false, gerant: true, admin: true },
  { label: 'Remboursements vente (audit)', caissier: false, gerant: true, admin: true },
  { label: 'Annulation transaction (audit)', caissier: true, gerant: true, admin: true },
  { label: 'File cloud — pousser', caissier: true, gerant: true, admin: true },
  { label: 'Stocks & inventaire rapide', caissier: false, gerant: true, admin: true },
  { label: 'Tableau de bord', caissier: false, gerant: true, admin: true },
  { label: 'Analytique', caissier: false, gerant: true, admin: true },
  { label: 'Personnel (matrice)', caissier: false, gerant: false, admin: true },
  { label: 'Intégrations', caissier: false, gerant: false, admin: true },
]

function PermCell({ ok }: { ok: boolean }) {
  return (
    <Td align="center">
      {ok ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <IconCheck className="h-3 w-3" />
        </span>
      ) : (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <IconClose className="h-3 w-3" />
        </span>
      )}
    </Td>
  )
}

export function PersonnelView({ currentProfileId }: Props) {
  const toast = useToast()
  const [profiles, setProfiles] = useState(() => listStaffProfiles())
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('caissier')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    return subscribeStaffProfiles(() => {
      setProfiles(listStaffProfiles())
    })
  }, [])

  const totalByRole = useMemo(() => {
    const rows = { caissier: 0, gerant: 0, admin: 0 }
    for (const p of profiles) rows[p.role] += 1
    return rows
  }, [profiles])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = createStaffProfile({
        displayName,
        role,
        pin,
        password,
      })
      toast.success(
        'Utilisateur créé',
        `${created.displayName} · ${roleLabel(created.role)}`,
      )
      setDisplayName('')
      setRole('caissier')
      setPin('')
      setPassword('')
    } catch (error) {
      toast.error(
        'Création impossible',
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Équipe"
        title="Personnel & permissions"
        subtitle="Profils, rôles et matrice des droits"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Caissiers" value={String(totalByRole.caissier)} tone="neutral" />
        <Kpi label="Gérants" value={String(totalByRole.gerant)} tone="violet" />
        <Kpi label="Administrateurs" value={String(totalByRole.admin)} tone="accent" />
      </div>

      <Card>
        <CardContent>
          <h2 className="text-[14px] font-semibold text-zinc-900">
            Créer un utilisateur
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Connexion par PIN ou mot de passe (même champ).
          </p>
          <form
            onSubmit={handleCreate}
            className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5"
          >
            <Field label="Nom complet" required className="lg:col-span-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Mariam Traoré"
                required
              />
            </Field>
            <Field label="Rôle" required>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="caissier">Caissier</option>
                <option value="gerant">Gérant</option>
                <option value="admin">Administrateur</option>
              </Select>
            </Field>
            <Field label="PIN (4-8 chiffres)" required>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                placeholder="1234"
                required
                className="font-mono-nums"
              />
            </Field>
            <Field label="Mot de passe (optionnel)">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
              />
            </Field>
            <div className="md:col-span-2 lg:col-span-5">
              <Button type="submit" variant="accent">
                Créer l’utilisateur
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SectionHeader
        title="Matrice des permissions"
        subtitle="Droits par rôle (les profils peuvent surcharger en démo)"
      />
      <Table minWidth={520}>
        <THead>
          <Tr hover={false}>
            <Th sticky>Fonctionnalité</Th>
            <Th align="center">Caissier</Th>
            <Th align="center">Gérant</Th>
            <Th align="center">Admin</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr className="bg-zinc-50/50" hover={false}>
            <Td sticky className="font-medium text-zinc-900">
              Plafond de remise par défaut
            </Td>
            <Td align="center" mono>
              5 %
            </Td>
            <Td align="center" mono>
              20 %
            </Td>
            <Td align="center" mono>
              100 %
            </Td>
          </Tr>
          {PERMISSIONS.map((row) => (
            <Tr key={row.label}>
              <Td sticky>{row.label}</Td>
              <PermCell ok={row.caissier} />
              <PermCell ok={row.gerant} />
              <PermCell ok={row.admin} />
            </Tr>
          ))}
        </TBody>
      </Table>

      <SectionHeader title="Profils enregistrés" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => {
          const active = p.id === currentProfileId
          return (
            <Card key={p.id} hover className={active ? 'ring-2 ring-emerald-500/20' : ''}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        active
                          ? 'flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-bold text-white'
                          : 'flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-bold text-zinc-700'
                      }
                    >
                      {p.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-zinc-900">
                        {p.displayName}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {roleLabel(p.role)}
                      </p>
                    </div>
                  </div>
                  {active ? (
                    <Badge tone="success">
                      <IconShield className="h-3 w-3" />
                      Session
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-600">
                  {p.role === 'admin'
                    ? 'Pilotage complet : personnel, intégrations, création de magasins, tous plafonds.'
                    : p.role === 'gerant'
                      ? 'Magasin au quotidien : catalogue, prix, stocks, transferts, clôture, analytique.'
                      : 'Vente et consultation : caisse, catalogue lecture, rapport du jour ; remises limitées.'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
