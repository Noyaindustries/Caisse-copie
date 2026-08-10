import type { Store } from './types'

export const DEFAULT_STORE_ID = 'store-main'

/** Magasin structurel unique — pas de magasin « annexe » démo. */
export const SEED_STORES: Store[] = [
  {
    id: DEFAULT_STORE_ID,
    name: 'Magasin principal',
    shortCode: 'MP',
    sortOrder: 0,
  },
]
