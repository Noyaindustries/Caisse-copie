/** Ouvre le paiement Wave (app mobile ou page QR pay.wave.com). */
export function openWaveCheckout(paymentUrl: string): void {
  window.location.assign(paymentUrl)
}
