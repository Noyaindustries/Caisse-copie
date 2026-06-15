import { forwardRef, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { cn } from '../ui/cn'
import { IconPlus, IconScan, IconSearch, IconSparkles } from '../ui/icons'

type Props = {
  sessionId: string
  activeStoreLabel: string
  barcode: string
  onBarcodeChange: (v: string) => void
  onBarcodeSubmit: () => void
  search: string
  onSearchChange: (v: string) => void
  onAddProduct?: () => void
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export const CaisseHeader = forwardRef<HTMLInputElement, Props>(
  function CaisseHeader(
    {
      sessionId,
      activeStoreLabel,
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
      <header className="caisse-header mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(184,146,46,0.22)] bg-[linear-gradient(145deg,#fffefb,#f7f0e3)] text-[#b8922e] shadow-[var(--shadow-caisse-card)]">
              <IconSparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="caisse-session-chip">
                  Session · {sessionId.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-[#5c6678]">
                  {activeStoreLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] capitalize text-[#5c6678]">
                {formatDate(now)}
              </p>
            </div>
            <div className="sm:ml-auto sm:text-right lg:ml-0 lg:mr-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b8922e]">
                Heure caisse
              </p>
              <p className="caisse-clock font-mono-nums">{formatTime(now)}</p>
            </div>
          </div>

          {onAddProduct ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<IconPlus />}
              onClick={onAddProduct}
              className="shrink-0 border-[rgba(184,146,46,0.25)] bg-white/90 hover:border-[rgba(184,146,46,0.4)] hover:bg-[#fffefb]"
            >
              Nouveau produit
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
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
            placeholder="Douchette — scannez ici"
            aria-label="Lecteur code-barres"
            className={cn('font-mono-nums caisse-input-luxe')}
            iconLeft={<IconScan />}
            autoComplete="off"
            spellCheck={false}
          />
          <Input
            type="search"
            data-product-search
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un article…"
            aria-label="Recherche textuelle"
            className="caisse-input-luxe"
            iconLeft={<IconSearch />}
            autoComplete="off"
          />
        </div>
      </header>
    )
  },
)
