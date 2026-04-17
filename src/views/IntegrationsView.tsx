import { useCallback, useMemo, useState } from 'react'
import {
  getOrCreateDemoApiKey,
  isComptaModuleDemoOn,
  isEcomModuleDemoOn,
  setComptaModuleDemo,
  setEcomModuleDemo,
} from '../lib/integrationsConfig'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { PageHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { Tabs } from '../ui/Tabs'
import { useToast } from '../ui/Toast'
import {
  IconCheck,
  IconIntegrations,
  IconKey,
  IconMobile,
  IconSpreadsheet,
  IconTag,
  IconTruck,
} from '../ui/icons'

type TabId = 'marketplace' | 'api' | 'mobile'

const PARTNERS = [
  {
    name: 'Mobile money agrégateur',
    desc: 'Orchestration Orange Money, MTN MoMo, Wave — partenariat à contractualiser.',
  },
  {
    name: 'Transport & livraison',
    desc: 'Webhooks commande → partenaire logistique (API REST).',
  },
  {
    name: 'ERP / compta tiers',
    desc: 'Export FEC, écritures ventes, synchronisation plan comptable.',
  },
] as const

// IconPlug : non exporté par lucide-react sous ce nom dans toutes les versions ; alias secours.
function IconPlug({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M5 8h14" />
      <path d="M7 8v3a5 5 0 0 0 10 0V8" />
      <path d="M12 16v6" />
    </svg>
  )
}

export function IntegrationsView() {
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('marketplace')
  const [apiKey] = useState(() => getOrCreateDemoApiKey())
  const [comptaOn, setComptaOn] = useState(() => isComptaModuleDemoOn())
  const [ecomOn, setEcomOn] = useState(() => isEcomModuleDemoOn())

  const webhookUrl = useMemo(
    () =>
      `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/caisseci`,
    [],
  )

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      toast.success('Clé API copiée')
    } catch {
      toast.error('Copie impossible', 'Sélectionnez la clé manuellement.')
    }
  }, [apiKey, toast])

  const tabs = useMemo(
    () => [
      { id: 'marketplace' as const, label: 'Marketplace' },
      { id: 'api' as const, label: 'API partenaires' },
      { id: 'mobile' as const, label: 'App mobile' },
    ],
    [],
  )

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Écosystème"
        title="Intégrations"
        subtitle="Modules métiers, exposition API et application mobile gérant"
      />

      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === 'marketplace' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card hover>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="violet">Comptabilité</Badge>
                  <h3 className="mt-2 text-[15px] font-semibold text-zinc-900">
                    Module Compta & fiscalité
                  </h3>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <IconSpreadsheet className="h-4 w-4" />
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600">
                Export des ventes (journal, TVA), rapprochement caisse, formats
                d’échange comptable (FEC, CSV).
              </p>
              <ul className="space-y-1 text-[12px] text-zinc-500">
                <li>· Écritures automatiques par session / jour</li>
                <li>· Multi-caisses / multi-magasins (schéma API)</li>
              </ul>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-[12px] font-medium text-zinc-700">
                  Mode démo local
                </span>
                <Switch
                  checked={comptaOn}
                  onChange={(e) => {
                    const v = e.target.checked
                    setComptaModuleDemo(v)
                    setComptaOn(v)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="info">E-commerce</Badge>
                  <h3 className="mt-2 text-[15px] font-semibold text-zinc-900">
                    Boutique en ligne
                  </h3>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <IconTag className="h-4 w-4" />
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600">
                Synchronisation bidirectionnelle catalogue / stocks, import de
                commandes web, étiquettes d’expédition.
              </p>
              <ul className="space-y-1 text-[12px] text-zinc-500">
                <li>· Webhooks « commande payée »</li>
                <li>· Réserve stock temps réel</li>
              </ul>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-[12px] font-medium text-zinc-700">
                  Intérêt e-commerce
                </span>
                <Switch
                  checked={ecomOn}
                  onChange={(e) => {
                    const v = e.target.checked
                    setEcomModuleDemo(v)
                    setEcomOn(v)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-zinc-50/50 lg:col-span-2">
            <CardContent>
              <h3 className="text-[14px] font-semibold text-zinc-800">
                Bientôt disponibles
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  'Fidélité & cartes cadeaux',
                  'Achats fournisseurs',
                  'Étiquettes & codes-barres avancés',
                  'Multi-devises régionales',
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'api' ? (
        <div className="space-y-4">
          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <IconKey className="h-4 w-4 text-zinc-500" />
                <h3 className="text-[14px] font-semibold text-zinc-900">
                  Clé API partenaire (démo)
                </h3>
              </div>
              <p className="mb-3 text-[12px] text-zinc-500">
                En production : rotation, scopes par intégration, audit des
                appels.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="ui-card-flat min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-mono-nums text-[12px] text-zinc-700">
                  {apiKey}
                </code>
                <Button variant="primary" onClick={() => void copyKey()}>
                  Copier
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <IconPlug className="h-4 w-4 text-zinc-500" />
                <h3 className="text-[14px] font-semibold text-zinc-900">
                  Webhook entrant
                </h3>
              </div>
              <p className="mb-3 text-[12px] text-zinc-500">
                URL à configurer chez le partenaire.
              </p>
              <code className="ui-card-flat block break-all rounded-lg px-3 py-2 font-mono-nums text-[12px] text-zinc-700">
                POST {webhookUrl}
              </code>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="mb-3 text-[14px] font-semibold text-zinc-900">
                Connecteurs & partenaires
              </h3>
              <ul className="space-y-2">
                {PARTNERS.map((p) => (
                  <li
                    key={p.name}
                    className="flex gap-3 rounded-lg border border-zinc-100 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <IconTruck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-900">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-600">
                        {p.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'mobile' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <IconMobile className="h-4 w-4 text-zinc-500" />
                <h3 className="text-[14px] font-semibold text-zinc-900">
                  Application mobile — Gérant
                </h3>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600">
                Companion iOS &amp; Android pour le responsable magasin : suivre
                le chiffre du jour, valider remises, recevoir alertes rupture.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="neutral">App Store — bientôt</Badge>
                <Badge tone="neutral">Google Play — bientôt</Badge>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Schéma d’URL universel
                </p>
                <code className="mt-1 block font-mono-nums text-[12px] text-emerald-800">
                  caisseci-manager://boutique/SESSION?token=…
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <IconIntegrations className="h-4 w-4 text-zinc-500" />
                <h3 className="text-[14px] font-semibold text-zinc-900">
                  Fonctions prévues
                </h3>
              </div>
              <ul className="space-y-2 text-[13px] text-zinc-700">
                {[
                  'Tableau de bord temps réel (CA, tickets, paiements)',
                  'Notifications push rupture & seuils',
                  'Validation workflow remises (PIN gérant)',
                  'État file synchronisation cloud & retry manuel',
                  'Authentification alignée sur les profils CaisseCI',
                ].map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {comptaOn ? (
        <Card>
          <CardContent className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-violet-700">
              <IconSpreadsheet className="h-4 w-4" />
            </span>
            <p className="text-[12px] text-zinc-700">
              <strong>Module compta (démo)</strong> activé : en production, un
              menu « Exports comptables » apparaîtrait ici et dans le rapport
              journalier.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
