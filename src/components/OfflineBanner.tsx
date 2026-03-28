/**
 * Bandeau explicite : l’app fonctionne en local (IndexedDB) sans réseau.
 */
export function OfflineBanner() {
  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-950"
      role="status"
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
        aria-hidden
      />
      <span>
        <strong className="font-semibold">Hors ligne</strong>
        {' — '}
        Caisse et stocks en local (IndexedDB). Espèces uniquement au panier ;
        ventes et mouvements de stock restent en file pour le cloud au retour
        du réseau.
      </span>
    </div>
  )
}
