import type { Store } from './types'

export const DEFAULT_STORE_ID = 'store-main'

export const SEED_STORES: Store[] = [
  {
    id: DEFAULT_STORE_ID,
    name: 'Magasin principal',
    shortCode: 'MP',
    sortOrder: 0,
  },
  {
    id: 'store-annex',
    name: 'Annexe centre-ville',
    shortCode: 'CV',
    sortOrder: 1,
  },
]
