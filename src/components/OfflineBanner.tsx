/**
 * Bandeau explicite : l’app fonctionne en local (IndexedDB) sans réseau.
 */
export function OfflineBanner() {
  return (
    <div
      className="premium-glass flex items-center justify-center gap-2 border-b border-amber-500/25 bg-linear-to-r from-amber-200/40 via-amber-100/45 to-amber-200/40 px-4 py-2 text-center text-xs font-medium text-amber-950"
      role="status"
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
        aria-hidden
      />
      <span>
        <strong className="font-semibold">Hors ligne</strong>
        {' — '}
        Caisse et stocks en local (IndexedDB), images produits en fallback local.
        Espèces uniquement au panier ; ventes et mouvements de stock restent en
        file pour le cloud au retour du réseau.
      </span>
    </div>
  )
}
