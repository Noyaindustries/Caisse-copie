import type { MobileMoneyPaymentRecord } from '../../lib/subscription/types'

import { Badge } from '../../ui/Badge'

import { Button } from '../../ui/Button'

import { Card, CardContent } from '../../ui/Card'

import { EmptyState } from '../../ui/EmptyState'

import { Field, Input } from '../../ui/Input'

import { Switch } from '../../ui/Switch'

import { cn } from '../../ui/cn'

import { IconClock, IconMobile, IconShield, IconSync } from '../../ui/icons'

import {

  BILLING_FAQ,

  formatDate,

  formatFcfa,

  paymentStatusLabel,

  paymentStatusTone,

} from './subscriptionUi'



export function SubscriptionBillingSection({

  billingPhone,

  smsRemindersEnabled,

  settingsBusy,

  online,

  payments,

  historyBusy,

  onBillingPhoneChange,

  onSmsToggle,

  onSaveSettings,

  onRefreshHistory,

}: {

  billingPhone: string

  smsRemindersEnabled: boolean

  settingsBusy: boolean

  online: boolean

  payments: MobileMoneyPaymentRecord[]

  historyBusy: boolean

  onBillingPhoneChange: (v: string) => void

  onSmsToggle: (v: boolean) => void

  onSaveSettings: () => void

  onRefreshHistory: () => void

}) {

  return (

    <div id="sub-billing" className="scroll-mt-24 space-y-10">

      <div className="grid gap-6 xl:grid-cols-2">

        <Card className="overflow-hidden border-border/60 shadow-[0_4px_24px_-8px_rgba(23,32,51,0.12)]">

          <div className="border-b border-border/50 bg-linear-to-r from-sky-50/60 to-white px-6 py-5">

            <div className="flex items-center gap-3">

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm">

                <IconMobile className="h-5 w-5" />

              </span>

              <div>

                <h3 className="text-lg font-bold text-ink">Rappels SMS</h3>

                <p className="text-sm text-ink-muted">Alertes automatiques J-3 et J-1</p>

              </div>

            </div>

          </div>

          <CardContent className="space-y-5 p-6">

            <Field label="Numéro mobile pour les rappels">

              <Input

                type="tel"

                inputMode="tel"

                placeholder="07 XX XX XX XX"

                value={billingPhone}

                onChange={(e) => onBillingPhoneChange(e.target.value)}

                iconLeft={<IconMobile className="h-4 w-4" />}

              />

            </Field>

            <Switch

              label="Activer les rappels SMS"

              description="Recevez un SMS avant la fin de l’essai ou de la période en cours."

              checked={smsRemindersEnabled}

              onChange={(e) => onSmsToggle(e.target.checked)}

            />

            <p className="rounded-xl bg-surface-muted/60 px-4 py-3 text-xs leading-relaxed text-ink-subtle">

              Si le numéro est vide, celui du dernier paiement mobile money est utilisé.

              Sans fournisseur SMS configuré, les messages sont journalisés côté serveur.

            </p>

            <Button

              type="button"

              variant="primary"

              disabled={settingsBusy || !online}

              onClick={onSaveSettings}

              loading={settingsBusy}

            >

              Enregistrer les paramètres

            </Button>

          </CardContent>

        </Card>



        <Card className="overflow-hidden border-border/60 shadow-[0_4px_24px_-8px_rgba(23,32,51,0.12)]">

          <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-linear-to-r from-violet-50/50 to-white px-6 py-5">

            <div className="flex items-center gap-3">

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm">

                <IconClock className="h-5 w-5" />

              </span>

              <div>

                <h3 className="text-lg font-bold text-ink">Historique des paiements</h3>

                <p className="text-sm text-ink-muted">Transactions mobile money récentes</p>

              </div>

            </div>

            <Button

              type="button"

              variant="ghost"

              size="sm"

              disabled={historyBusy || !online}

              onClick={onRefreshHistory}

              iconLeft={<IconSync className="h-3.5 w-3.5" />}

            >

              {historyBusy ? '…' : 'Rafraîchir'}

            </Button>

          </div>

          <CardContent className="p-0">

            {payments.length === 0 ? (

              <div className="p-8">

                <EmptyState

                  icon={<IconClock />}

                  title="Aucun paiement"

                  description="Vos transactions apparaîtront ici après un premier règlement mobile money."

                />

              </div>

            ) : (

              <ul className="relative divide-y divide-border/50">

                {payments.map((p, i) => (

                  <li

                    key={p.id}

                    className="relative flex flex-col gap-3 px-6 py-4 transition hover:bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between"

                  >

                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border/60 sm:left-8" aria-hidden />

                    <span

                      className={cn(

                        'absolute left-1.5 top-6 z-10 h-3 w-3 rounded-full border-2 border-white sm:left-7',

                        p.status === 'accepted' ? 'bg-emerald-500' : p.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400',

                      )}

                      aria-hidden

                    />

                    <div className="min-w-0 pl-6 sm:pl-8">

                      <div className="flex flex-wrap items-center gap-2">

                        <p className="font-semibold text-ink">{p.planName}</p>

                        <Badge tone={paymentStatusTone(p.status)}>

                          {paymentStatusLabel(p.status)}

                        </Badge>

                        {i === 0 ? (

                          <Badge tone="accent" className="text-[10px]">

                            Dernier

                          </Badge>

                        ) : null}

                      </div>

                      <p className="mt-1 text-sm text-ink-muted">

                        {p.channelLabel} · {formatDate(p.paidAt ?? p.createdAt)}

                      </p>

                      <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">{p.transactionId}</p>

                    </div>

                    <p className="shrink-0 pl-6 font-mono text-lg font-bold text-ink sm:pl-0">

                      {formatFcfa(p.amountFcfa)}

                    </p>

                  </li>

                ))}

              </ul>

            )}

          </CardContent>

        </Card>

      </div>



      <section className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm sm:p-8">

        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">FAQ facturation</p>

        <h3 className="mt-2 text-xl font-bold text-ink">Questions fréquentes</h3>

        <dl className="mt-6 space-y-5">

          {BILLING_FAQ.map((item) => (

            <div key={item.q} className="rounded-xl border border-border/50 bg-surface-muted/30 px-5 py-4">

              <dt className="font-semibold text-ink">{item.q}</dt>

              <dd className="mt-2 text-sm leading-relaxed text-ink-muted">{item.a}</dd>

            </div>

          ))}

        </dl>

      </section>



      <footer className="rounded-2xl border border-border/60 bg-linear-to-br from-[#0c1222] via-[#141b2e] to-[#1a1040] p-6 text-white sm:p-8">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-start gap-4">

            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sky-300">

              <IconShield className="h-6 w-6" />

            </span>

            <div>

              <p className="text-lg font-bold">Paiements sécurisés & offline-first</p>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">

                Transactions chiffrées via CinetPay et Stripe · Licence valable 7 jours sans connexion ·

                Support des opérateurs mobile money ivoiriens.

              </p>

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <Badge className="border-white/15 bg-white/10 text-white">CinetPay</Badge>

            <Badge className="border-white/15 bg-white/10 text-white">Stripe</Badge>

            <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">Offline 7j</Badge>

          </div>

        </div>

      </footer>

    </div>

  )

}


