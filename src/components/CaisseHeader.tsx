import { forwardRef, useEffect, useState } from 'react'

type Props = {
  sessionId: string
  /** Valeur affichée du champ lecteur (synchronisée avec le scan USB / wedge). */
  barcode: string
  onBarcodeChange: (v: string) => void
  /** Entrée dans le champ lecteur ou fin de scan wedge. */
  onBarcodeSubmit: () => void
  search: string
  onSearchChange: (v: string) => void
  /** Administrateur uniquement */
  onAddProduct?: () => void
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function focusRef(
  ref: React.ForwardedRef<HTMLInputElement>,
): void {
  if (typeof ref === 'function') return
  ref?.current?.focus()
}

export const CaisseHeader = forwardRef<HTMLInputElement, Props>(
  function CaisseHeader(
    {
      sessionId,
      barcode,
      onBarcodeChange,
      onBarcodeSubmit,
      search,
      onSearchChange,
      onAddProduct,
    },
    ref,
  ) {
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
      const t = setInterval(() => setNow(new Date()), 1000)
      return () => clearInterval(t)
    }, [])

    return (
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-200/40 ring-1 ring-slate-100 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600/90">
              Session #{sessionId}
            </p>
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900">
              Caisse en cours
            </h1>
          </div>
          <time
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-nums text-sm font-medium tabular-nums text-slate-800"
            dateTime={now.toISOString()}
          >
            {formatTime(now)}
          </time>
        </div>
        {onAddProduct ? (
          <button
            type="button"
            onClick={onAddProduct}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/60"
          >
            + Nouveau produit
          </button>
        ) : null}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3 lg:max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Panier &amp; prise de commande
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90">
                Lecteur code-barres USB
              </span>
              <div className="flex min-w-0 flex-1 gap-2">
                <input
                  ref={ref}
                  type="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-barcode-input
                  value={barcode}
                  onChange={(e) => onBarcodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onBarcodeSubmit()
                    }
                  }}
                  placeholder="Douchette : scannez ici (Entrée automatique)"
                  aria-label="Lecteur code-barres USB — le scan envoie les chiffres puis Entrée"
                  className="min-w-0 flex-1 rounded-xl border-2 border-emerald-200/80 bg-emerald-50/30 px-4 py-2.5 font-mono-nums text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => focusRef(ref)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:text-sm"
                >
                  <span aria-hidden>▤</span>
                  <span className="hidden sm:inline">Focus lecteur</span>
                  <span className="sm:hidden">Lecteur</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Le lecteur envoie le code comme un clavier ; ce champ doit rester actif
                pour la saisie manuelle. Un scan fonctionne aussi après un clic sur la
                grille (capture globale).
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Recherche clavier (pas le lecteur)
              </span>
              <input
                type="search"
                data-product-search
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Nom ou code partiel…"
                aria-label="Recherche textuelle — ne pas utiliser pour la douchette USB"
                className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/25"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </header>
    )
  },
)
