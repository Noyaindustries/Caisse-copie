import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAppSettings,
  resetAppSettings,
  saveAppSettings,
  type AppSettings,
} from '../lib/appSettings'
import {
  getDeviceConnectivityDemo,
  getDeliveryProviderDemo,
  getKitchenStationDemo,
  isComptaModuleDemoOn,
  isDeliveryModuleDemoOn,
  isEcomModuleDemoOn,
  isKitchenModuleDemoOn,
  setComptaModuleDemo,
  setDeliveryModuleDemo,
  setDeliveryProviderDemo,
  setDeviceConnectivityDemo,
  setEcomModuleDemo,
  setKitchenModuleDemo,
  setKitchenStationDemo,
  type DeviceConnectivityDemo,
} from '../lib/integrationsConfig'
import { printToplinkTestPage } from '../lib/printer/printReceipt'
import {
  connectToplinkPrinter,
  disconnectToplinkPrinter,
  getToplinkPrinterMeta,
  isToplinkPrinterLinked,
  isWebSerialSupported,
  reconnectToplinkPrinter,
  type ToplinkPrinterMeta,
} from '../lib/printer/toplinkSerial'
import {
  getOrCreateTerminalId,
  getTerminalLabel,
  setTerminalLabel,
} from '../lib/session'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Field, Input, Select } from '../ui/Input'
import { PageHeader } from '../ui/PageHeader'
import { Switch } from '../ui/Switch'
import { Tabs } from '../ui/Tabs'
import { useToast } from '../ui/Toast'
import { IconSettings, IconStore } from '../ui/icons'

type TabId = 'general' | 'caisse' | 'service' | 'peripheriques' | 'modules'

type Props = {
  activeStoreId: string
  activeStoreName: string
  canManageIntegrations: boolean
  onOpenIntegrations?: () => void
  onOpenSubscription?: () => void
}

export function ParametresView({
  activeStoreId,
  activeStoreName,
  canManageIntegrations,
  onOpenIntegrations,
  onOpenSubscription,
}: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('general')
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings())
  const [terminalLabel, setTerminalLabelState] = useState(() => getTerminalLabel())
  const [kitchenStation, setKitchenStation] = useState(() => getKitchenStationDemo())
  const [deliveryProvider, setDeliveryProvider] = useState(() => getDeliveryProviderDemo())
  const [deviceConnectivity, setDeviceConnectivity] = useState<DeviceConnectivityDemo>(() =>
    getDeviceConnectivityDemo(),
  )
  const [comptaOn, setComptaOn] = useState(() => isComptaModuleDemoOn())
  const [ecomOn, setEcomOn] = useState(() => isEcomModuleDemoOn())
  const [deliveryOn, setDeliveryOn] = useState(() => isDeliveryModuleDemoOn())
  const [kitchenOn, setKitchenOn] = useState(() => isKitchenModuleDemoOn())
  const [printerMeta, setPrinterMeta] = useState<ToplinkPrinterMeta>(() =>
    getToplinkPrinterMeta(),
  )
  const [printerBusy, setPrinterBusy] = useState(false)
  const webSerialOk = isWebSerialSupported()

  const terminalId = useMemo(() => getOrCreateTerminalId(), [])

  useEffect(() => {
    void reconnectToplinkPrinter().then((ok) => {
      if (ok) setPrinterMeta(getToplinkPrinterMeta())
    })
  }, [])

  const tabs = useMemo(
    () => [
      { id: 'general' as const, label: 'Général' },
      { id: 'caisse' as const, label: 'Caisse' },
      { id: 'service' as const, label: 'Service' },
      { id: 'peripheriques' as const, label: 'Périphériques' },
      { id: 'modules' as const, label: 'Modules' },
    ],
    [],
  )

  useEffect(() => {
    const reload = () => setSettings(getAppSettings())
    window.addEventListener('caisseci-app-settings-changed', reload)
    return () => window.removeEventListener('caisseci-app-settings-changed', reload)
  }, [])

  const patchSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(saveAppSettings(patch))
  }, [])

  const handleSaveAll = useCallback(() => {
    setTerminalLabel(terminalLabel)
    setKitchenStationDemo(kitchenStation)
    setDeliveryProviderDemo(deliveryProvider)
    setDeviceConnectivityDemo(deviceConnectivity)
    saveAppSettings(settings)
    toast.success('Paramètres enregistrés', 'Les changements sont appliqués sur ce poste.')
  }, [
    deliveryProvider,
    deviceConnectivity,
    kitchenStation,
    settings,
    terminalLabel,
    toast,
  ])

  const handleReset = useCallback(() => {
    const next = resetAppSettings()
    setSettings(next)
    setTerminalLabelState(getTerminalLabel())
    toast.info('Paramètres réinitialisés', 'Valeurs par défaut restaurées.')
  }, [toast])

  const copyTerminalId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(terminalId)
      toast.success('ID terminal copié')
    } catch {
      toast.error('Copie impossible')
    }
  }, [terminalId, toast])

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        subtitle="Magasin, caisse, cuisine, tables et périphériques de ce poste"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Réinitialiser
            </Button>
            <Button variant="accent" size="sm" onClick={handleSaveAll}>
              Enregistrer
            </Button>
          </div>
        }
      />

      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === 'general' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <IconStore className="h-4 w-4 text-ink-subtle" />
                <h3 className="text-[14px] font-semibold text-ink">Magasin actif</h3>
              </div>
              <p className="text-[13px] text-ink-muted">
                <span className="font-medium text-ink">{activeStoreName}</span>
                <span className="text-ink-subtle"> · {activeStoreId}</span>
              </p>
              <p className="text-[12px] text-ink-subtle">
                Le magasin actif se change depuis la barre latérale (si votre rôle le permet).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <IconSettings className="h-4 w-4 text-ink-subtle" />
                <h3 className="text-[14px] font-semibold text-ink">Terminal</h3>
              </div>
              <Field label="Nom affiché sur les tickets">
                <Input
                  value={terminalLabel}
                  onChange={(e) => setTerminalLabelState(e.target.value)}
                  placeholder="Caisse 1"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-surface-sunken px-2 py-1 font-mono-nums text-[12px] text-ink-muted">
                  {terminalId}
                </code>
                <Button size="sm" variant="secondary" onClick={() => void copyTerminalId()}>
                  Copier l’ID
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">Fiscalité & reçu</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="TVA par défaut (nouveaux articles)">
                  <Input
                    inputMode="decimal"
                    value={String(settings.defaultVatRatePct)}
                    onChange={(e) =>
                      patchSettings({
                        defaultVatRatePct: Number.parseFloat(
                          e.target.value.replace(',', '.'),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Message pied de ticket">
                  <Input
                    value={settings.receiptFooterLine}
                    onChange={(e) =>
                      patchSettings({ receiptFooterLine: e.target.value })
                    }
                    placeholder="Merci de votre visite !"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'caisse' ? (
        <Card>
          <CardContent className="space-y-4">
            <h3 className="text-[14px] font-semibold text-ink">Comportement caisse</h3>
            <Field label="Densité grille produits">
              <Select
                value={settings.productGridDensity}
                onChange={(e) =>
                  patchSettings({
                    productGridDensity: e.target.value as AppSettings['productGridDensity'],
                  })
                }
              >
                <option value="compact">Compacte (plus d’articles visibles)</option>
                <option value="confort">Confort (cartes plus grandes)</option>
              </Select>
            </Field>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-ink">Bloquer la vente si stock à 0</p>
                <p className="text-[11px] text-ink-subtle">
                  Empêche d’ajouter au panier au-delà du stock disponible.
                </p>
              </div>
              <Switch
                checked={settings.blockSaleWhenOutOfStock}
                onChange={(e) =>
                  patchSettings({ blockSaleWhenOutOfStock: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-ink">Impression auto après vente</p>
                <p className="text-[11px] text-ink-subtle">
                  Ouvre et imprime le ticket dès l’encaissement (si imprimante activée).
                </p>
              </div>
              <Switch
                checked={settings.autoPrintReceiptAfterSale}
                onChange={(e) =>
                  patchSettings({ autoPrintReceiptAfterSale: e.target.checked })
                }
              />
            </label>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'service' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-ink">Cuisine (KDS)</h3>
                <Badge tone={kitchenOn ? 'success' : 'neutral'}>
                  {kitchenOn ? 'Activé' : 'Désactivé'}
                </Badge>
              </div>
              <Field label="Station par défaut">
                <Input
                  value={kitchenStation}
                  onChange={(e) => setKitchenStation(e.target.value)}
                  placeholder="Cuisine principale"
                />
              </Field>
              <Field label="Seuil SLA priorité haute (minutes)">
                <Input
                  inputMode="numeric"
                  value={String(settings.kitchenSlaThresholdMin)}
                  onChange={(e) =>
                    patchSettings({
                      kitchenSlaThresholdMin: Number.parseInt(e.target.value, 10),
                    })
                  }
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">Tables & salle</h3>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-ink">Libération auto des tables</p>
                  <p className="text-[11px] text-ink-subtle">
                    Repasse une table occupée en « libre » après inactivité.
                  </p>
                </div>
                <Switch
                  checked={settings.tableAutoReleaseEnabled}
                  onChange={(e) =>
                    patchSettings({ tableAutoReleaseEnabled: e.target.checked })
                  }
                />
              </label>
              <Field label="Délai avant libération (minutes, min. 15)">
                <Input
                  inputMode="numeric"
                  value={settings.tableAutoReleaseMinutes}
                  onChange={(e) =>
                    patchSettings({ tableAutoReleaseMinutes: e.target.value })
                  }
                  disabled={!settings.tableAutoReleaseEnabled}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">Pointage équipe</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Heure d’arrivée attendue">
                  <Input
                    type="time"
                    value={settings.pointageExpectedStartTime}
                    onChange={(e) =>
                      patchSettings({ pointageExpectedStartTime: e.target.value })
                    }
                  />
                </Field>
                <Field label="Durée journalière cible (heures)">
                  <Input
                    inputMode="numeric"
                    value={String(settings.pointageExpectedDailyHours)}
                    onChange={(e) =>
                      patchSettings({
                        pointageExpectedDailyHours: Number.parseInt(e.target.value, 10),
                      })
                    }
                  />
                </Field>
              </div>
              <p className="text-[11px] text-ink-subtle">
                Sert à signaler les retards et comparer le temps pointé à l’objectif dans la
                synthèse RH.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">Livraison</h3>
              <Field label="Prestataire / coursier par défaut">
                <Input
                  value={deliveryProvider}
                  onChange={(e) => setDeliveryProvider(e.target.value)}
                  placeholder="Coursier interne"
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'peripheriques' ? (
        <div className="space-y-3">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">
                    Toplink TL-R120
                  </h3>
                  <p className="mt-1 text-[12px] text-ink-subtle">
                    Imprimante thermique 80 mm ESC/POS (USB / série). Chrome ou Edge
                    sur <strong>localhost</strong> ou HTTPS. La machine doit apparaître
                    comme port COM (pas seulement « USB Printing Support »).
                  </p>
                </div>
                <Badge
                  tone={
                    isToplinkPrinterLinked() && printerMeta.connectedAt
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {isToplinkPrinterLinked() && printerMeta.connectedAt
                    ? 'Liée'
                    : 'Non liée'}
                </Badge>
              </div>

              {!webSerialOk ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  Web Serial indisponible sur ce navigateur. Installez le pilote Windows
                  de la TL-R120 et choisissez-la dans le dialogue d’impression, ou
                  ouvrez CaisseCI dans Chrome / Edge.
                </p>
              ) : (
                <p className="rounded-lg border border-border/70 bg-surface-sunken/60 px-3 py-2 text-[12px] text-ink-muted">
                  Si l’impression ne part pas : 1) branchez et allumez la TL-R120,
                  2) fermez tout logiciel qui utilise le port COM, 3) cliquez
                  « Connecter USB » puis « Page de test ». Baud détecté :{' '}
                  {printerMeta.baudRate ?? 9600}.
                </p>
              )}

              <dl className="grid gap-1 text-[12px] text-ink-muted sm:grid-cols-2">
                <div>
                  <dt className="text-ink-subtle">Modèle</dt>
                  <dd className="font-medium text-ink">{printerMeta.model}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Libellé</dt>
                  <dd className="font-medium text-ink">{printerMeta.label}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Dernière utilisation</dt>
                  <dd className="font-medium text-ink">
                    {printerMeta.lastUsedAt
                      ? new Date(printerMeta.lastUsedAt).toLocaleString('fr-FR')
                      : '—'}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={printerBusy || !webSerialOk}
                  onClick={() => {
                    setPrinterBusy(true)
                    void connectToplinkPrinter()
                      .then((meta) => {
                        setPrinterMeta(meta)
                        toast.success(
                          'Imprimante liée',
                          'Toplink TL-R120 prête pour les tickets.',
                        )
                      })
                      .catch((err) =>
                        toast.error(
                          'Connexion impossible',
                          err instanceof Error ? err.message : 'Erreur',
                        ),
                      )
                      .finally(() => setPrinterBusy(false))
                  }}
                >
                  Connecter USB
                </Button>
                <Button
                  variant="secondary"
                  disabled={printerBusy || !webSerialOk}
                  onClick={() => {
                    setPrinterBusy(true)
                    void printToplinkTestPage()
                      .then((msg) => {
                        setPrinterMeta(getToplinkPrinterMeta())
                        toast.success('Test OK', msg)
                      })
                      .catch((err) =>
                        toast.error(
                          'Test échoué',
                          err instanceof Error ? err.message : 'Erreur',
                        ),
                      )
                      .finally(() => setPrinterBusy(false))
                  }}
                >
                  Page de test
                </Button>
                <Button
                  variant="ghost"
                  disabled={printerBusy || !printerMeta.connectedAt}
                  onClick={() => {
                    setPrinterBusy(true)
                    void disconnectToplinkPrinter()
                      .then(() => {
                        setPrinterMeta(getToplinkPrinterMeta())
                        toast.success('Imprimante déconnectée')
                      })
                      .finally(() => setPrinterBusy(false))
                  }}
                >
                  Déconnecter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h3 className="text-[14px] font-semibold text-ink">
                Périphériques connectés
              </h3>
              <p className="text-[12px] text-ink-subtle">
                Activez les modules locaux de ce poste (imprimante, tiroir-caisse, TPE,
                écran cuisine).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { key: 'orderTerminals', label: 'Bornes commande' },
                    { key: 'receiptPrinters', label: 'Imprimantes tickets' },
                    { key: 'kitchenScreens', label: 'Écrans cuisine (KDS)' },
                    { key: 'cashDrawer', label: 'Tiroir-caisse (via TL-R120)' },
                    {
                      key: 'paymentTerminals',
                      label: 'Terminaux paiement (TPE)',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5"
                  >
                    <span className="text-[12px] font-medium text-ink">
                      {item.label}
                    </span>
                    <Switch
                      checked={deviceConnectivity[item.key]}
                      onChange={(e) =>
                        setDeviceConnectivity((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'modules' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {(
            [
              {
                label: 'Module cuisine',
                checked: kitchenOn,
                onChange: (v: boolean) => {
                  setKitchenModuleDemo(v)
                  setKitchenOn(v)
                },
              },
              {
                label: 'Boutique en ligne',
                checked: ecomOn,
                onChange: (v: boolean) => {
                  setEcomModuleDemo(v)
                  setEcomOn(v)
                },
              },
              {
                label: 'Livraison',
                checked: deliveryOn,
                onChange: (v: boolean) => {
                  setDeliveryModuleDemo(v)
                  setDeliveryOn(v)
                },
              },
              {
                label: 'Comptabilité avancée',
                checked: comptaOn,
                onChange: (v: boolean) => {
                  setComptaModuleDemo(v)
                  setComptaOn(v)
                },
              },
            ] as const
          ).map((mod) => (
            <label
              key={mod.label}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-4 py-3"
            >
              <span className="text-[13px] font-medium text-ink">{mod.label}</span>
              <Switch
                checked={mod.checked}
                onChange={(e) => mod.onChange(e.target.checked)}
              />
            </label>
          ))}

          {canManageIntegrations && onOpenIntegrations ? (
            <Card className="lg:col-span-2 border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink">API & partenaires</p>
                  <p className="text-[12px] text-ink-subtle">
                    Clés API, webhooks commandes et marketplace avancée.
                  </p>
                </div>
                <Button variant="secondary" onClick={onOpenIntegrations}>
                  Ouvrir Intégrations
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {onOpenSubscription ? (
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Abonnement & SMS</p>
                  <p className="text-[12px] text-ink-subtle">
                    Plan, facturation et rappels SMS avant expiration.
                  </p>
                </div>
                <Button variant="secondary" onClick={onOpenSubscription}>
                  Gérer l’abonnement
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
