import { useLiveQuery } from 'dexie-react-hooks'
/* eslint-disable react-refresh/only-export-components -- Provider et hooks sont volontairement co-localisés. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db } from '../db/db'
import type { ProductWithStock, Store } from '../db/types'
import { DEFAULT_STORE_ID } from '../db/seedStores'
import { productIsActive } from '../lib/productFilters'

const STORAGE_KEY = 'caisseci-active-store-id'

function readStoredStoreId(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

function writeStoredStoreId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

type Ctx = {
  stores: Store[]
  activeStoreId: string
  setActiveStoreId: (id: string) => void
  canSwitchStore: boolean
  /** Produits actifs avec stock du magasin sélectionné. */
  displayProducts: ProductWithStock[]
  activeStore: Store | undefined
}

const ActiveStoreContext = createContext<Ctx | null>(null)

type ProviderProps = {
  children: ReactNode
  /** Droit de changer de magasin actif (liste déroulante). */
  canSwitchStore: boolean
}

export function ActiveStoreProvider({
  children,
  canSwitchStore,
}: ProviderProps) {
  const stores =
    useLiveQuery(() => db.stores.orderBy('sortOrder').toArray(), [], []) ?? []
  const products =
    useLiveQuery(() => db.products.toArray(), [], []) ?? []

  const [requestedStoreId, setActiveStoreIdState] = useState(() => {
    const s = readStoredStoreId()
    return s ?? DEFAULT_STORE_ID
  })
  const activeStoreId =
    stores.length > 0 && !stores.some((store) => store.id === requestedStoreId)
      ? (stores[0]?.id ?? DEFAULT_STORE_ID)
      : requestedStoreId

  const stockRows =
    useLiveQuery(
      () => db.storeStocks.where('storeId').equals(activeStoreId).toArray(),
      [activeStoreId],
      [],
    ) ?? []

  const stockByProduct = useMemo(
    () => new Map(stockRows.map((r) => [r.productId, r.stock])),
    [stockRows],
  )

  const displayProducts = useMemo((): ProductWithStock[] => {
    return products
      .filter(productIsActive)
      .map((p) => ({
        ...p,
        stock: stockByProduct.get(p.id) ?? 0,
      }))
  }, [products, stockByProduct])

  const setActiveStoreId = useCallback((id: string) => {
    setActiveStoreIdState(id)
    writeStoredStoreId(id)
  }, [])

  useEffect(() => {
    if (activeStoreId !== requestedStoreId) {
      writeStoredStoreId(activeStoreId)
    }
  }, [activeStoreId, requestedStoreId])

  const activeStore = stores.find((s) => s.id === activeStoreId)

  const value = useMemo(
    (): Ctx => ({
      stores,
      activeStoreId,
      setActiveStoreId,
      canSwitchStore,
      displayProducts,
      activeStore,
    }),
    [
      stores,
      activeStoreId,
      setActiveStoreId,
      canSwitchStore,
      displayProducts,
      activeStore,
    ],
  )

  return (
    <ActiveStoreContext.Provider value={value}>
      {children}
    </ActiveStoreContext.Provider>
  )
}

export function useActiveStore(): Ctx {
  const c = useContext(ActiveStoreContext)
  if (!c) {
    throw new Error('useActiveStore hors ActiveStoreProvider')
  }
  return c
}

/** Pour écrans lecture seule sans jeter si provider manque (tests). */
export function useActiveStoreOptional(): Ctx | null {
  return useContext(ActiveStoreContext)
}
