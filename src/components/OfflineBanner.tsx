import { IconOffline } from '../ui/icons'

/**
 * Bandeau explicite : l’app fonctionne en local (IndexedDB) sans réseau.
 */
export function OfflineBanner() {
  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[12px] font-medium text-amber-900"
      role="status"
    >
      <IconOffline className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">Hors ligne.</strong>{' '}
        Caisse et stocks en local. Espèces uniquement au panier ; ventes en file
        de synchronisation.
      </span>
    </div>
  )
}
