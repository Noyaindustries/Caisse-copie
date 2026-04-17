import { forwardRef, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { IconPlus, IconScan, IconSearch } from '../ui/icons'

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
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div>
              <p className="ui-eyebrow">Session #{sessionId}</p>
              <p className="text-[13px] font-semibold text-zinc-900">
                Caisse en cours ·{' '}
                <span className="font-mono-nums text-zinc-500">
                  {formatTime(now)}
                </span>
              </p>
            </div>
          </div>
          {onAddProduct ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<IconPlus />}
              onClick={onAddProduct}
            >
              Nouveau produit
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
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
            placeholder="Douchette : scannez ici (Entrée auto)"
            aria-label="Lecteur code-barres"
            className="font-mono-nums"
            iconLeft={<IconScan />}
            autoComplete="off"
            spellCheck={false}
          />
          <Input
            type="search"
            data-product-search
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Recherche par nom ou code…"
            aria-label="Recherche textuelle"
            iconLeft={<IconSearch />}
            autoComplete="off"
          />
        </div>
      </div>
    )
  },
)
