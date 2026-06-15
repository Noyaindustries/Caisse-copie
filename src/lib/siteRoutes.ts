import { useCallback, useEffect, useState } from 'react'

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

export function useSitePath(): [string, (to: string) => void] {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    const target = to.startsWith('/') ? to : `/${to}`
    if (window.location.pathname + window.location.search !== target) {
      window.history.pushState({}, '', target)
    }
    setPathname(window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return [pathname, navigate]
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

export function isStaffPath(): boolean {
  if (typeof window === 'undefined') return false
  const { pathname, search, hash } = window.location
  const p = pathname.toLowerCase()
  const q = search.toLowerCase()
  const h = hash.toLowerCase()
  return (
    p.endsWith('/staff') ||
    p.includes('/staff/') ||
    q.includes('staff') ||
    h.includes('staff')
  )
}
