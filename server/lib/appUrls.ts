/** URLs de retour après paiement d'abonnement (Stripe, Wave, CinetPay). */
export function subscriptionSuccessUrl(baseUrl: string, tx?: string): string {
  const params = new URLSearchParams({ subscription: 'success' })
  if (tx) params.set('tx', tx)
  return `${baseUrl}/abonnement?${params}`
}

export function subscriptionCancelUrl(baseUrl: string): string {
  return `${baseUrl}/abonnement?subscription=cancel`
}
