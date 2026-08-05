import { useCallback, useEffect, useState } from 'react'
import {
  fetchPaymentProviders,
  savePaymentProviders,
  type PaymentProvidersStatus,
} from '../../lib/platformAdmin/api'
import type { AdminThemeClasses } from '../../lib/platformAdmin/theme'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, CardContent, CardHeader } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { Switch } from '../../ui/Switch'
import { cn } from '../../ui/cn'

type Props = {
  theme: AdminThemeClasses
  inputClass: string
}

function sourceLabel(source: PaymentProvidersStatus['wave']['source']): string {
  switch (source) {
    case 'db':
      return 'Admin'
    case 'env':
      return '.env'
    case 'mixed':
      return 'Admin + .env'
    case 'none':
      return 'Non configuré'
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

export function PaymentProvidersAdminPanel({ theme, inputClass }: Props) {
  const [status, setStatus] = useState<PaymentProvidersStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [waveApiKey, setWaveApiKey] = useState('')
  const [waveWebhookSecret, setWaveWebhookSecret] = useState('')
  const [waveSigningSecret, setWaveSigningSecret] = useState('')
  const [waveDemoMode, setWaveDemoMode] = useState(false)
  const [clearWaveApiKey, setClearWaveApiKey] = useState(false)
  const [clearWaveWebhook, setClearWaveWebhook] = useState(false)
  const [clearWaveSigning, setClearWaveSigning] = useState(false)

  const [cinetpayApiKey, setCinetpayApiKey] = useState('')
  const [cinetpaySiteId, setCinetpaySiteId] = useState('')
  const [cinetpayDemoMode, setCinetpayDemoMode] = useState(false)
  const [clearCinetpayApiKey, setClearCinetpayApiKey] = useState(false)
  const [clearCinetpaySiteId, setClearCinetpaySiteId] = useState(false)

  const applyStatus = useCallback((next: PaymentProvidersStatus) => {
    setStatus(next)
    setWaveDemoMode(next.wave.demoMode)
    setCinetpayDemoMode(next.orangeMoney.demoMode)
  }, [])

  const reload = useCallback(async () => {
    setLoadError(null)
    try {
      const next = await fetchPaymentProviders()
      applyStatus(next)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Impossible de charger la config.',
      )
    }
  }, [applyStatus])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = async () => {
    setBusy(true)
    setSaveMessage(null)
    try {
      const body: Parameters<typeof savePaymentProviders>[0] = {
        waveDemoMode,
        cinetpayDemoMode,
      }
      if (clearWaveApiKey) body.waveApiKey = null
      else if (waveApiKey.trim()) body.waveApiKey = waveApiKey.trim()
      if (clearWaveWebhook) body.waveWebhookSecret = null
      else if (waveWebhookSecret.trim()) body.waveWebhookSecret = waveWebhookSecret.trim()
      if (clearWaveSigning) body.waveSigningSecret = null
      else if (waveSigningSecret.trim()) body.waveSigningSecret = waveSigningSecret.trim()
      if (clearCinetpayApiKey) body.cinetpayApiKey = null
      else if (cinetpayApiKey.trim()) body.cinetpayApiKey = cinetpayApiKey.trim()
      if (clearCinetpaySiteId) body.cinetpaySiteId = null
      else if (cinetpaySiteId.trim()) body.cinetpaySiteId = cinetpaySiteId.trim()

      const next = await savePaymentProviders(body)
      applyStatus(next)
      setWaveApiKey('')
      setWaveWebhookSecret('')
      setWaveSigningSecret('')
      setCinetpayApiKey('')
      setCinetpaySiteId('')
      setClearWaveApiKey(false)
      setClearWaveWebhook(false)
      setClearWaveSigning(false)
      setClearCinetpayApiKey(false)
      setClearCinetpaySiteId(false)
      setSaveMessage('Configuration paiement enregistrée.')
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Enregistrement impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-bold sm:text-base">
          Paiements plateforme (SaaS)
        </h1>
        <p className={cn('mt-1 text-xs sm:text-sm', theme.muted)}>
          Clés utilisées quand les commerçants paient leur abonnement CaisseCI.
          Les clés Wave / Orange de chaque boutique se configurent dans
          Intégrations (par abonnement).
        </p>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {loadError}
        </p>
      ) : null}
      {saveMessage ? (
        <p
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            saveMessage.includes('enregistrée')
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
          )}
        >
          {saveMessage}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={theme.card}>
          <CardHeader
            title="Wave"
            subtitle="API Business Wave CI — abonnements & boutique"
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status?.wave.enabled ? 'success' : 'neutral'}>
                {status?.wave.enabled ? 'Actif' : 'Inactif'}
              </Badge>
              <Badge tone="info">{sourceLabel(status?.wave.source ?? 'none')}</Badge>
              {status?.wave.apiKeyHint ? (
                <span className={cn('font-mono text-[11px]', theme.muted)}>
                  Clé {status.wave.apiKeyHint}
                </span>
              ) : null}
            </div>

            <Field label="Clé API Wave (WAVE_API_KEY)">
              <Input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={waveApiKey}
                onChange={(e) => {
                  setWaveApiKey(e.target.value)
                  setClearWaveApiKey(false)
                }}
                placeholder={
                  status?.wave.apiKeyHint
                    ? `Conservée (${status.wave.apiKeyHint}) — laisser vide`
                    : 'wave_ci_prod_…'
                }
                disabled={clearWaveApiKey || busy}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={clearWaveApiKey}
                onChange={(e) => setClearWaveApiKey(e.target.checked)}
                disabled={busy}
              />
              Effacer la clé API (repli .env si présent)
            </label>

            <Field label="Secret webhook (WAVE_WEBHOOK_SECRET)">
              <Input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={waveWebhookSecret}
                onChange={(e) => {
                  setWaveWebhookSecret(e.target.value)
                  setClearWaveWebhook(false)
                }}
                placeholder={
                  status?.wave.webhookSecretSet
                    ? 'Conservé — laisser vide'
                    : 'wave_sn_WHS_…'
                }
                disabled={clearWaveWebhook || busy}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={clearWaveWebhook}
                onChange={(e) => setClearWaveWebhook(e.target.checked)}
                disabled={busy}
              />
              Effacer le secret webhook
            </label>

            <Field label="Secret de signature (optionnel)">
              <Input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={waveSigningSecret}
                onChange={(e) => {
                  setWaveSigningSecret(e.target.value)
                  setClearWaveSigning(false)
                }}
                placeholder={
                  status?.wave.signingSecretSet
                    ? 'Conservé — laisser vide'
                    : 'wave_sn_AKS_…'
                }
                disabled={clearWaveSigning || busy}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={clearWaveSigning}
                onChange={(e) => setClearWaveSigning(e.target.checked)}
                disabled={busy}
              />
              Effacer le secret de signature
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-[12px] font-medium">
                Mode démo Wave (hors production)
              </span>
              <Switch
                checked={waveDemoMode}
                onChange={(e) => setWaveDemoMode(e.target.checked)}
                disabled={busy}
              />
            </label>

            {status?.webhookUrls.wave ? (
              <p className={cn('break-all font-mono text-[11px]', theme.muted)}>
                Webhook à enregistrer : {status.webhookUrls.wave}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className={theme.card}>
          <CardHeader
            title="Orange Money"
            subtitle="Via CinetPay (canal ORANGE_MONEY) — MTN / Moov inclus"
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status?.orangeMoney.enabled ? 'success' : 'neutral'}>
                {status?.orangeMoney.enabled ? 'Actif' : 'Inactif'}
              </Badge>
              <Badge tone="info">
                {sourceLabel(status?.orangeMoney.source ?? 'none')}
              </Badge>
              {status?.orangeMoney.apiKeyHint ? (
                <span className={cn('font-mono text-[11px]', theme.muted)}>
                  Clé {status.orangeMoney.apiKeyHint}
                </span>
              ) : null}
            </div>

            <Field label="Clé API CinetPay (CINETPAY_API_KEY)">
              <Input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={cinetpayApiKey}
                onChange={(e) => {
                  setCinetpayApiKey(e.target.value)
                  setClearCinetpayApiKey(false)
                }}
                placeholder={
                  status?.orangeMoney.apiKeyHint
                    ? `Conservée (${status.orangeMoney.apiKeyHint}) — laisser vide`
                    : 'Clé API CinetPay'
                }
                disabled={clearCinetpayApiKey || busy}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={clearCinetpayApiKey}
                onChange={(e) => setClearCinetpayApiKey(e.target.checked)}
                disabled={busy}
              />
              Effacer la clé API
            </label>

            <Field label="Site ID CinetPay (CINETPAY_SITE_ID)">
              <Input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={cinetpaySiteId}
                onChange={(e) => {
                  setCinetpaySiteId(e.target.value)
                  setClearCinetpaySiteId(false)
                }}
                placeholder={
                  status?.orangeMoney.siteIdHint
                    ? `Conservé (${status.orangeMoney.siteIdHint}) — laisser vide`
                    : 'Site ID'
                }
                disabled={clearCinetpaySiteId || busy}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={clearCinetpaySiteId}
                onChange={(e) => setClearCinetpaySiteId(e.target.checked)}
                disabled={busy}
              />
              Effacer le Site ID
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-[12px] font-medium">
                Mode démo CinetPay (hors production)
              </span>
              <Switch
                checked={cinetpayDemoMode}
                onChange={(e) => setCinetpayDemoMode(e.target.checked)}
                disabled={busy}
              />
            </label>

            {status?.webhookUrls.cinetpay ? (
              <p className={cn('break-all font-mono text-[11px]', theme.muted)}>
                Notify URL : {status.webhookUrls.cinetpay}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void handleSave()}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void reload()}>
          Actualiser
        </Button>
      </div>
    </div>
  )
}
