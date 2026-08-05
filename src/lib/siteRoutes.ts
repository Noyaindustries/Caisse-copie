/**
 * Helpers de routes + hook useSitePath (contexte).
 * Le Provider Next (usePathname/useRouter) vit dans apps/web/app/SitePathProvider.tsx
 */

export {
  SitePathContext,
  useSitePath,
  type SitePathContextValue,
} from './sitePathContext'

export const ROUTES = {
  home: '/',
  pricing: '/tarifs',
  signup: '/inscription',
  login: '/connexion',
  staff: '/staff',
  subscription: '/abonnement',
  platformAdmin: '/admin',
  storefrontBase: '/boutique',
} as const

export function signupUrl(plan?: string): string {
  if (!plan) return ROUTES.signup
  return `${ROUTES.signup}?plan=${encodeURIComponent(plan)}`
}

export function isSignupPath(pathname: string): boolean {
  const p = pathname.toLowerCase()
  return p.startsWith('/inscription') || p.startsWith(ROUTES.login)
}

export function isOwnerAuthPath(pathname: string): boolean {
  const p = pathname.toLowerCase()
  return p.startsWith('/inscription') || p.startsWith(ROUTES.login)
}

export function isSubscriptionPath(pathname: string): boolean {
  return pathname.toLowerCase().startsWith(ROUTES.subscription)
}

export function isPlatformAdminPath(pathname: string): boolean {
  const p = pathname.toLowerCase()
  return p === ROUTES.platformAdmin || p.startsWith(`${ROUTES.platformAdmin}/`)
}

export function parseStorefrontCode(pathname: string): string | null {
  const prefix = `${ROUTES.storefrontBase}/`
  if (!pathname.toLowerCase().startsWith(prefix.toLowerCase())) return null
  const segment = pathname.slice(prefix.length).split('/')[0]?.trim()
  if (!segment) return null
  return decodeURIComponent(segment)
}

export function storefrontPath(storeCode: string): string {
  return `${ROUTES.storefrontBase}/${encodeURIComponent(storeCode.trim().toUpperCase())}`
}

export function storefrontUrl(storeCode: string, origin?: string): string {
  const base =
    origin ??
    (typeof globalThis.window !== 'undefined' ? globalThis.window.location.origin : '')
  return `${base.replace(/\/$/, '')}${storefrontPath(storeCode)}`
}

export function isStaffPath(pathname?: string): boolean {
  if (typeof window === 'undefined' && !pathname) return false
  const path = (pathname ?? window.location.pathname).toLowerCase()
  const search =
    typeof window !== 'undefined' ? window.location.search.toLowerCase() : ''
  const hash =
    typeof window !== 'undefined' ? window.location.hash.toLowerCase() : ''
  return (
    path.endsWith('/staff') ||
    path.includes('/staff/') ||
    search.includes('staff') ||
    hash.includes('staff')
  )
}
