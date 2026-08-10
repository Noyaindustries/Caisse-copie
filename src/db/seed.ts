/**
 * Identifiants des anciennes données de démonstration (catalogue, cuisine, etc.).
 * Utilisés uniquement pour la purge — plus aucune injection automatique.
 */

export const DEMO_PRODUCT_IDS: readonly string[] = Array.from(
  { length: 30 },
  (_, i) => `p${i + 1}`,
)

export const DEMO_KITCHEN_INGREDIENT_IDS: readonly string[] = [
  'ing-poulet',
  'ing-poisson',
  'ing-huile',
  'ing-oignon',
  'ing-attieke',
  'ing-riz',
]

export const DEMO_PROMO_CODES: readonly string[] = ['PROMO5', 'PROMO10']

export const DEMO_STORE_ANNEX_ID = 'store-annex'
