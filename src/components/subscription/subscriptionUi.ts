import type { PlanId } from '../../lib/subscription/types'



export function formatFcfa(amount: number): string {

  return new Intl.NumberFormat('fr-CI', {

    style: 'currency',

    currency: 'XOF',

    maximumFractionDigits: 0,

  }).format(amount)

}



export function formatDate(iso: string | null): string {

  if (!iso) return '—'

  return new Intl.DateTimeFormat('fr-CI', {

    dateStyle: 'medium',

    timeStyle: 'short',

  }).format(new Date(iso))

}



export function daysUntil(iso: string | null): number | null {

  if (!iso) return null

  const diff = new Date(iso).getTime() - Date.now()

  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))

}



export function paymentStatusLabel(status: string): string {

  switch (status) {

    case 'accepted':

      return 'Payé'

    case 'pending':

      return 'En attente'

    case 'refused':

      return 'Refusé'

    default:

      return status

  }

}



export function paymentStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {

  switch (status) {

    case 'accepted':

      return 'success'

    case 'pending':

      return 'warning'

    case 'refused':

      return 'danger'

    default:

      return 'neutral'

  }

}



export const PLAN_ACCENT: Record<

  PlanId,

  { ring: string; glow: string; badge: string; gradient: string; icon: string; solid: string }

> = {

  starter: {

    ring: 'ring-slate-300/60',

    glow: 'from-slate-400/10 to-transparent',

    badge: 'bg-slate-100 text-slate-700 border-slate-200',

    gradient: 'from-slate-50 to-white',

    icon: 'text-slate-500',

    solid: 'bg-slate-600',

  },

  pro: {

    ring: 'ring-violet-400/70',

    glow: 'from-violet-500/15 to-indigo-500/5',

    badge: 'bg-violet-100 text-violet-800 border-violet-200',

    gradient: 'from-violet-50/80 via-white to-indigo-50/40',

    icon: 'text-violet-600',

    solid: 'bg-violet-600',

  },

  business: {

    ring: 'ring-amber-400/60',

    glow: 'from-amber-400/15 to-orange-500/5',

    badge: 'bg-amber-50 text-amber-900 border-amber-200',

    gradient: 'from-amber-50/60 via-white to-orange-50/30',

    icon: 'text-amber-600',

    solid: 'bg-amber-600',

  },

}



export const PLAN_ORDER: PlanId[] = ['starter', 'pro', 'business']



export const BILLING_FAQ = [

  {

    q: 'Que se passe-t-il à la fin de l’essai ?',

    a: 'Sans paiement, l’accès aux modules avancés est suspendu. La caisse reste consultable. Un rappel SMS est envoyé à J-3 et J-1 si activé.',

  },

  {

    q: 'Puis-je changer de plan à tout moment ?',

    a: 'Oui. Chaque paiement (mobile money ou carte) active le plan choisi pour 30 jours. Le changement est immédiat après confirmation.',

  },

  {

    q: 'Comment fonctionne le mobile money ?',

    a: 'Sélectionnez un plan, choisissez votre opérateur (Orange Money, Wave, MTN, Moov) et validez sur votre téléphone via CinetPay.',

  },

  {

    q: 'La licence fonctionne-t-elle hors ligne ?',

    a: 'Oui. Votre abonnement reste valable 7 jours en cache local sans connexion internet.',

  },

] as const


