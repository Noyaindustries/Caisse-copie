type ProductImageLike = {
  /** Préféré pour une vignette stable même si le nom change. */
  id?: string
  name: string
  category?: string
  imageDataUrl?: string
  imageUrl?: string
}

const svgCache = new Map<string, string>()

function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
  const first = words[0]?.[0] ?? 'P'
  const second = words[1]?.[0] ?? words[0]?.[1] ?? ''
  return `${first}${second}`.toUpperCase()
}

function paletteForCategory(category?: string): {
  from: string
  to: string
  accent: string
} {
  switch (category) {
    case 'Boissons':
      return { from: '#1d4ed8', to: '#0891b2', accent: '#dbeafe' }
    case 'Alimentation':
      return { from: '#92400e', to: '#f59e0b', accent: '#fef3c7' }
    case 'Hygiène':
      return { from: '#065f46', to: '#0ea5e9', accent: '#d1fae5' }
    default:
      return { from: '#334155', to: '#7c3aed', accent: '#e2e8f0' }
  }
}

/**
 * Vignette locale déterministe (SVG + initiales) — sert de **fallback**
 * si la photo distante échoue (hors ligne, CDN indispo, etc.).
 */
export function productImageFallbackSvg(
  name: string,
  category?: string,
  stableKey?: string,
): string {
  const key = stableKey ?? `${name}::${category ?? ''}`
  const existing = svgCache.get(key)
  if (existing) return existing

  const initials = initialsFromName(name)
  const palette = paletteForCategory(category)
  const label = (category ?? 'Produit').toUpperCase().slice(0, 12)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}" />
      <stop offset="100%" stop-color="${palette.to}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="240" height="240" rx="28" fill="url(#bg)" />
  <circle cx="195" cy="45" r="26" fill="${palette.accent}" opacity="0.25" />
  <circle cx="50" cy="190" r="20" fill="${palette.accent}" opacity="0.2" />
  <text x="120" y="128" text-anchor="middle" fill="white" font-size="74" font-family="DM Sans, Arial, sans-serif" font-weight="700">${initials}</text>
  <text x="120" y="176" text-anchor="middle" fill="white" opacity="0.9" font-size="18" font-family="DM Sans, Arial, sans-serif" letter-spacing="1.5">${label}</text>
</svg>`
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  svgCache.set(key, dataUrl)
  return dataUrl
}

/* --------------------------------------------------------------------------
 * Mapping « nom de plat / boisson » → photos Unsplash directes (IDs stables)
 * --------------------------------------------------------------------------
 *
 * On utilise des photos Unsplash publiques via `images.unsplash.com/photo-<id>`
 * (format le plus stable, pas de redirection tierce).
 * Un mot-clé peut matcher plusieurs produits : on prend la première
 * correspondance dans l'ordre. En cas d'échec de chargement, le composant
 * `<ProductImage>` bascule automatiquement sur le fallback SVG.
 */

const UNSPLASH_PARAMS = 'w=480&h=480&q=75&auto=format&fit=crop&crop=entropy'

function u(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?${UNSPLASH_PARAMS}`
}

/** Règles par ordre : la première regex qui matche gagne. */
const KEYWORD_RULES: Array<{ match: RegExp; url: string }> = [
  // Boissons
  { match: /bissap|hibiscus|karkad/i, url: u('1615478503562-ec2d8aa0e24e') },
  { match: /gingembre|ginger/i, url: u('1600271886742-f049cd451bba') },
  { match: /cocktail\s+fruit|cocktail/i, url: u('1514362545857-3bc16c4c7d1b') },
  { match: /smoothie|mangue/i, url: u('1505252585461-04db1eb84625') },
  { match: /eau\s+min[eé]rale|eau\s+plate|bouteille\s+eau/i, url: u('1548839140-29a749e1cf4d') },
  { match: /cola|coca/i, url: u('1622483767028-3f66f32aef97') },
  { match: /soda|boisson\s+gaz/i, url: u('1581636625402-29b2a704ef13') },
  { match: /jus/i, url: u('1600271886742-f049cd451bba') },
  { match: /caf[eé]/i, url: u('1509042239860-f550ce710b93') },
  { match: /th[eé]\b/i, url: u('1576092768241-dec231879fc3') },

  // Plats africains
  { match: /riz\s+gras|jollof|thieb|tchep/i, url: u('1604908176997-125f25cc6f3d') },
  { match: /atti[eé]k[eé]|attieke/i, url: u('1574484284002-952d92456975') },
  { match: /garba|thon\s+fri/i, url: u('1504674900247-0877df9cc836') },
  { match: /placali|foutou|sauce\s+graine|sauce\s+claire/i, url: u('1567189022927-3ac1f7f5e5f2') },
  { match: /alloco|banane\s+plantain/i, url: u('1598103442097-8b74394b95c6') },
  { match: /yassa/i, url: u('1598103442097-8b74394b95c6') },
  { match: /maf[eé]|arachide/i, url: u('1547592180-85f173990554') },
  { match: /poulet\s+brais|poulet\s+grill|poulet\s+DG/i, url: u('1598103442097-8b74394b95c6') },
  { match: /poisson\s+brais|poisson\s+grill/i, url: u('1519708227418-c8fd9a32b7a2') },
  { match: /brochette/i, url: u('1544025162-d76694265947') },

  // Cuisine internationale
  { match: /spaghetti|p[aâ]tes|bolognaise|carbonara/i, url: u('1621996346565-e3dbc646d9a9') },
  { match: /burger/i, url: u('1568901346375-23c9450c58cd') },
  { match: /pizza/i, url: u('1565299624946-b28f40a0ae38') },
  { match: /tacos/i, url: u('1565299585323-38d6b0865b47') },
  { match: /wrap/i, url: u('1626700051175-6818013e1d4f') },
  { match: /club\s+sandwich/i, url: u('1567234669003-dce7a7a88821') },
  { match: /sandwich/i, url: u('1539252554935-80c8cbfc7a5f') },
  { match: /salade/i, url: u('1512621776951-a57141f2eefd') },
  { match: /nugget/i, url: u('1562967914-608f82629710') },
  { match: /frite/i, url: u('1541592106381-b31e9677c0e5') },

  // Desserts / fruits
  { match: /tiramisu/i, url: u('1571877227200-a0d98ea607e4') },
  { match: /cr[eê]pe/i, url: u('1519676867240-f03562e64548') },
  { match: /chocolat/i, url: u('1511381939415-e44015466834') },
  { match: /g[aâ]teau|cake/i, url: u('1578985545062-69928b1d9587') },
  { match: /glace|ice\s*cream/i, url: u('1501443762994-82bd5dace89a') },
  { match: /fruit\s+bowl|salade\s+de\s+fruit|fruit/i, url: u('1490474418585-ba9bad8fd0ea') },

  // Hygiène
  { match: /savon/i, url: u('1600857544200-b2f666a9a2ec') },
  { match: /papier\s+toilette/i, url: u('1583947215259-38e31be8751f') },
  { match: /brosse\s+dent|dentifrice/i, url: u('1607613009820-a29f7bb81c04') },
  { match: /shampoo|shampoing/i, url: u('1526045478516-99145907023c') },

  // Épicerie générique
  { match: /pain|baguette/i, url: u('1509440159596-0249088772ff') },
  { match: /\briz\b/i, url: u('1536304993881-ff6e9eefa2a6') },
  { match: /huile/i, url: u('1598030304671-5aa1d6f13a58') },
  { match: /viande|b[oœ]uf|beef/i, url: u('1544025162-d76694265947') },
  { match: /œuf|oeuf|omelette/i, url: u('1608039829572-78524f79c4c7') },
]

/** Photos génériques par catégorie (dernier recours avant le SVG). */
const CATEGORY_FALLBACK: Record<string, string> = {
  Boissons: u('1544145945-f90425340c7e'),
  Alimentation: u('1504674900247-0877df9cc836'),
  Hygiène: u('1584305574647-0cc949a2bb9f'),
  Autre: u('1542838132-92c53300491e'),
}

/**
 * URL d'une vraie photo pour le produit (Unsplash), ou `null` si aucune
 * correspondance (on utilisera le SVG fallback côté UI).
 */
export function productImageRemoteUrl(
  product: ProductImageLike,
): string | null {
  const haystack = [product.name, product.category ?? ''].join(' ')
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(haystack)) return rule.url
  }
  if (product.category && CATEGORY_FALLBACK[product.category]) {
    return CATEGORY_FALLBACK[product.category]
  }
  return null
}

function canUseRemoteImages(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  return true
}

/**
 * Source **initiale** pour le `<img src>`.
 * - Photo personnelle du produit si `imageDataUrl` défini
 * - Photo distante Unsplash si en ligne et correspondance trouvée
 * - Sinon vignette SVG locale déterministe
 *
 * En cas d'échec réseau, utiliser `<ProductImage>` qui bascule
 * automatiquement sur le SVG via `onError`.
 */
export function productImageSrc(product: ProductImageLike): string {
  if (product.imageUrl) return product.imageUrl
  if (product.imageDataUrl) return product.imageDataUrl
  if (canUseRemoteImages()) {
    const remote = productImageRemoteUrl(product)
    if (remote) return remote
  }
  const stableKey =
    product.id ?? `${product.name}::${product.category ?? ''}`
  return productImageFallbackSvg(product.name, product.category, stableKey)
}
