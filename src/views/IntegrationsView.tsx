import { useCallback, useMemo, useState } from 'react'
import {
  getOrCreateDemoApiKey,
  isComptaModuleDemoOn,
  isEcomModuleDemoOn,
  setComptaModuleDemo,
  setEcomModuleDemo,
} from '../lib/integrationsConfig'

type TabId = 'marketplace' | 'api' | 'mobile'

const PARTNERS = [
  {
    name: 'Mobile money agrégateur',
    desc: 'Orchestration Orange Money, MTN MoMo, Wave — statut partenariat à contractualiser.',
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

export function IntegrationsView() {
  const [tab, setTab] = useState<TabId>('marketplace')
  const [apiKey] = useState(() => getOrCreateDemoApiKey())
  const [comptaOn, setComptaOn] = useState(() => isComptaModuleDemoOn())
  const [ecomOn, setEcomOn] = useState(() => isEcomModuleDemoOn())
  const [copied, setCopied] = useState(false)

  const webhookUrl = useMemo(
    () =>
      `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/caisseci`,
    [],
  )

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('Impossible de copier — sélectionnez la clé manuellement.')
    }
  }, [apiKey])

  const tabBtn = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        tab === id
          ? 'bg-slate-900 text-white shadow-lg'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          Écosystème CaisseCI
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">
          Intégrations avancées
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75">
          Marketplace de modules métiers, exposition API pour partenaires, et
          application mobile dédiée aux gérants. Les éléments ci-dessous
          constituent la feuille de route produit ; branchez votre backend via{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono-nums text-xs">
            VITE_CLOUD_SYNC_URL
          </code>{' '}
          et des routes dédiées quand votre infrastructure est prête.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn('marketplace', 'Marketplace modules')}
        {tabBtn('api', 'API partenaires')}
        {tabBtn('mobile', 'App mobile gérant')}
      </div>

      {tab === 'marketplace' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                  Comptabilité
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
                  Module Compta & fiscalité
                </h3>
              </div>
              <span className="text-2xl" aria-hidden>
                📒
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
              Export des ventes (journal, TVA 18 %), rapprochement caisse, formats
              d’échange vers votre expert-comptable ou logiciel agréé (FEC,
              CSV). Connexion serveur à prévoir.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>· Écritures automatiques par session / jour</li>
              <li>· Multi-caisses / multi-magasins (schéma API)</li>
            </ul>
            <label className="mt-6 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <span className="text-sm font-medium text-slate-800">
                Activer le mode démo local (bannière + menu export simulé)
              </span>
              <input
                type="checkbox"
                checked={comptaOn}
                onChange={(e) => {
                  const v = e.target.checked
                  setComptaModuleDemo(v)
                  setComptaOn(v)
                }}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </article>

          <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                  E-commerce
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
                  Module Boutique en ligne
                </h3>
              </div>
              <span className="text-2xl" aria-hidden>
                🛒
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
              Synchronisation bidirectionnelle catalogue / stocks, import de
              commandes web en file de préparation, étiquettes d’expédition.
              Connecteurs type marketplace ou boutique propriétaire.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>· Webhooks « commande payée » → CaisseCI</li>
              <li>· Réserve stock temps réel</li>
            </ul>
            <label className="mt-6 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <span className="text-sm font-medium text-slate-800">
                Marquer « intérêt e-commerce » (démo locale)
              </span>
              <input
                type="checkbox"
                checked={ecomOn}
                onChange={(e) => {
                  const v = e.target.checked
                  setEcomModuleDemo(v)
                  setEcomOn(v)
                }}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </article>

          <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 lg:col-span-2">
            <h3 className="font-display text-sm font-semibold text-slate-800">
              Autres modules prévus sur la marketplace
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Fidélité & cartes cadeaux',
                'Achats fournisseurs',
                'Étiquettes & codes-barres avancés',
                'Multi-devises régionales',
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  {label}
                </span>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {tab === 'api' ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Clé API partenaire (démo)
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              En production : rotation, scopes par intégration, audit des
              appels. Ici : clé générée localement pour prototypes.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono-nums text-xs text-slate-800">
                {apiKey}
              </code>
              <button
                type="button"
                onClick={() => void copyKey()}
                className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Webhooks entrants
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              URL à configurer chez le partenaire pour recevoir événements
              (paiement, livraison). À implémenter côté serveur.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono-nums text-xs text-slate-700 break-all">
              POST {webhookUrl}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Connecteurs & partenaires
            </h3>
            <ul className="mt-4 space-y-4">
              {PARTNERS.map((p) => (
                <li
                  key={p.name}
                  className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-lg"
                    aria-hidden
                  >
                    🔗
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{p.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === 'mobile' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Application mobile — Gérant
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Companion iOS & Android pour le responsable magasin : suivre le
              chiffre du jour, valider remises exceptionnelles, recevoir alertes
              rupture et file de sync cloud.
            </p>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Liens magasins (à publier)
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  App Store — bientôt
                </span>
                <span className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  Google Play — bientôt
                </span>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-emerald-300/60 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold text-emerald-900">
                Schéma d’URL universel (exemple)
              </p>
              <code className="mt-2 block font-mono-nums text-xs text-emerald-800">
                caisseci-manager://boutique/SESSION?token=…
              </code>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Fonctions prévues
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                Tableau de bord temps réel (CA, tickets, paiements)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                Notifications push rupture & seuils stock
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                Validation workflow remises (PIN gérant)
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                État file synchronisation cloud & retry manuel
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                Authentification alignée sur les profils CaisseCI (SSO futur)
              </li>
            </ul>
          </section>
        </div>
      ) : null}

      {comptaOn ? (
        <p
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900"
          role="status"
        >
          <strong>Module compta (démo)</strong> activé : en production, un menu
          « Exports comptables » apparaîtrait ici et dans le rapport journalier.
        </p>
      ) : null}
    </div>
  )
}
