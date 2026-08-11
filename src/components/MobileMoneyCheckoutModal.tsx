import { useEffect, useState } from 'react'
import { openWaveCheckout } from '../lib/wavePayment'
import {
  fetchMobileMoneyChannels,
  startMobileMoneyCheckout,
} from '../lib/subscription/api'
import type { MobileMoneyChannel, MobileMoneyChannelId, PlanId } from '../lib/subscription/types'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { IconMobile } from '../ui/icons'

type Props = {
  open: boolean
  onClose: () => void
  licenseKey: string
  planId: PlanId
  planName: string
  amountFcfa: number
  storeCode?: string | null
}

function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function MobileMoneyCheckoutModal({
  open,
  onClose,
  licenseKey,
  planId,
  planName,
  amountFcfa,
  storeCode,
}: Props) {
  const toast = useToast()
  const [channels, setChannels] = useState<MobileMoneyChannel[]>([])
  const [demo, setDemo] = useState(false)
  const [waveDirect, setWaveDirect] = useState(false)
  const [wavePaymentLink, setWavePaymentLink] = useState(false)
  const [wavePaymentLinks, setWavePaymentLinks] = useState<
    Partial<Record<PlanId, boolean>>
  >({})
  const [channelId, setChannelId] = useState<MobileMoneyChannelId>('wave')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchMobileMoneyChannels()
      .then((data) => {
        setChannels(data.channels)
        setDemo(data.demo)
        setWaveDirect(data.waveDirect)
        setWavePaymentLink(data.wavePaymentLink === true)
        setWavePaymentLinks(data.wavePaymentLinks ?? {})
        const preferred =
          data.channels.find((c) => c.id === 'wave' && c.provider === 'wave') ??
          data.channels.find((c) => c.provider) ??
          data.channels[0]
        if (preferred) setChannelId(preferred.id)
      })
      .catch(() => {
        toast.error('Mobile money', 'Impossible de charger les opérateurs.')
      })
  }, [open, toast])

  const selected = channels.find((c) => c.id === channelId)
  const planHasWaveLink =
    wavePaymentLinks[planId] === true ||
    (wavePaymentLinks[planId] !== false && wavePaymentLink)
  const usesWaveLink =
    channelId === 'wave' && planHasWaveLink && !waveDirect
  const usesWaveApi =
    !usesWaveLink &&
    (selected?.provider === 'wave' || (channelId === 'wave' && waveDirect))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const result = await startMobileMoneyCheckout(licenseKey, {
        planId,
        channelId,
        phone,
      })
      if (result.demo) {
        toast.info(
          'Mode démo',
          usesWaveApi
            ? 'Simulation Wave — en production, l’app Wave ou le QR s’ouvrent automatiquement.'
            : 'Simulation du paiement mobile money.',
        )
      }
      if (result.provider === 'wave_link' || usesWaveLink || usesWaveApi) {
        openWaveCheckout(result.paymentUrl)
        return
      }
      window.location.href = result.paymentUrl
    } catch (err) {
      toast.error(
        'Paiement',
        err instanceof Error ? err.message : 'Impossible de démarrer le paiement.',
      )
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payer par mobile money"
      subtitle={`Abonnement ${planName} — ${formatFcfa(amountFcfa)} / mois`}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {demo ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Mode démo actif : aucun débit réel. Vous pourrez confirmer ou refuser le
            paiement sur la page suivante.
          </p>
        ) : usesWaveLink ? (
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
            <img
              src="/branding/wave-logo.png"
              alt="Wave"
              className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-sm"
            />
            <p className="text-sm text-sky-950">
              L’application <strong>Wave</strong> va s’ouvrir pour payer{' '}
              <strong>{formatFcfa(amountFcfa)}</strong>
              {storeCode ? (
                <>
                  {' '}
                  (indiquez <strong>{storeCode}</strong> dans le message)
                </>
              ) : null}
              . Sur ordinateur, scannez le QR avec l’app.
            </p>
          </div>
        ) : usesWaveApi ? (
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
            <img
              src="/branding/wave-logo.png"
              alt="Wave"
              className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-sm"
            />
            <p className="text-sm text-sky-950">
              Vous serez redirigé vers l’application <strong>Wave</strong> pour valider le
              paiement en F CFA sur votre numéro ivoirien.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Vous serez redirigé vers CinetPay pour valider le paiement sur votre
            téléphone ({selected?.label ?? 'opérateur'}).
          </p>
        )}

        <Field label="Opérateur">
          <Select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value as MobileMoneyChannelId)}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.provider === 'wave' ? ' (Wave direct)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        {selected ? (
          <p className="text-xs text-zinc-500">{selected.description}</p>
        ) : null}

        <Field label="Numéro mobile money">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07 XX XX XX XX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            iconLeft={<IconMobile className="h-4 w-4" />}
            required
          />
        </Field>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
          <Button type="submit" className="sm:flex-1" disabled={busy}>
            {busy
              ? 'Redirection…'
              : usesWaveApi || usesWaveLink
                ? 'Payer avec Wave'
                : 'Continuer vers le paiement'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
        </div>
      </form>
    </Modal>
  )
}
