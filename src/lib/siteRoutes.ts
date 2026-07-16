import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

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

const PATH_CHANGE_EVENT = 'caisseci:pathchange'

function readPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

function notifyPathChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PATH_CHANGE_EVENT))
}

export function signupUrl(plan?: string): string {
  if (!plan) return ROUTES.signup
  return `${ROUTES.signup}?plan=${encodeURIComponent(plan)}`
}

type SitePathContextValue = {
  pathname: string
  navigate: (to: string) => void
}

const SitePathContext = createContext<SitePathContextValue | null>(null)

export function SitePathProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(readPathname)

  useEffect(() => {
    const sync = () => setPathname(readPathname())
    window.addEventListener('popstate', sync)
    window.addEventListener(PATH_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(PATH_CHANGE_EVENT, sync)
    }
  }, [])

  const navigate = useCallback((to: string) => {
    const target = to.startsWith('/') ? to : `/${to}`
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (current !== target) {
      window.history.pushState({}, '', target)
    }
    notifyPathChange()
    setPathname(window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate])

  return createElement(SitePathContext.Provider, { value }, children)
}

/** Doit être utilisé sous SitePathProvider. */
export function useSitePath(): [string, (to: string) => void] {
  const ctx = useContext(SitePathContext)
  if (!ctx) {
    throw new Error('useSitePath doit être utilisé dans SitePathProvider')
  }
  return [ctx.pathname, ctx.navigate]
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
