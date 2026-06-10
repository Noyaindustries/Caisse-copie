import { useEffect, useMemo, useState } from 'react'
import { OfflineBanner } from '../components/OfflineBanner'
import {
  fetchStorefrontInfo,
  fetchStorefrontMenu,
  submitPublicStorefrontOrder,
} from '../lib/storefront/api'
import type { ProductWithStock } from '../db/types'
import type { PublicStorefrontOrderInput } from '../lib/storefront/types'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { LuxuryStorefrontView } from './LuxuryStorefrontView'

type Props = {
  storeCode: string
  online: boolean
}

export function PublicStorefrontPage({ storeCode, online }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [storeId, setStoreId] = useState('store-main')
  const [usable, setUsable] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const info = await fetchStorefrontInfo(storeCode)
        if (!info.usable) {
          if (!cancelled) {
            setUsable(false)
            setStoreName(info.name)
            setLoading(false)
          }
          return
        }
        const menu = await fetchStorefrontMenu(storeCode)
        if (cancelled) return
        setStoreName(menu.storeName || menu.name)
        setStoreId(menu.storeId)
        setProducts(menu.products)
        setUsable(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Boutique indisponible.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storeCode])

  const publicStorefront = useMemo(
    () => ({
      storeName,
      storeId,
      products,
      submitOrder: async (order: PublicStorefrontOrderInput) => {
        const result = await submitPublicStorefrontOrder(storeCode, order)
        return result
      },
    }),
    [storeCode, storeId, storeName, products],
  )

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-200" />
      </div>
    )
  }

  if (!usable) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950 px-4">
        <Card className="max-w-md">
          <CardContent className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-bold text-ink">{storeName}</h1>
            <p className="text-sm text-ink-muted">
              Cette boutique n’accepte pas de commandes en ligne pour le moment.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || products.length === 0) {
    return (
      <div className="flex min-h-svh flex-col bg-zinc-950">
        {!online ? <OfflineBanner /> : null}
        <div className="flex flex-1 items-center justify-center px-4">
          <Card className="max-w-lg">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-xl font-bold text-ink">Boutique en ligne</h1>
              <p className="text-sm leading-relaxed text-ink-muted">
                {error ??
                  'Le menu n’a pas encore été publié. Le commerçant doit publier son catalogue depuis l’espace Abonnement.'}
              </p>
              <Button type="button" variant="secondary" onClick={() => globalThis.history.back()}>
                Retour
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <LuxuryStorefrontView
      online={online}
      seedReady
      onOpenStaffLogin={() => {}}
      publicStorefront={publicStorefront}
    />
  )
}
