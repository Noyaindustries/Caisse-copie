import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BRAND_LOGO_SRC, BRAND_NAME } from '../brand'
import { apiUrl } from '../lib/apiUrl'

export type SiteBranding = {
  logoUrl: string | null
  brandName: string | null
}

type SiteBrandingContextValue = {
  ready: boolean
  logoSrc: string
  brandName: string
  customLogo: boolean
  branding: SiteBranding
  refresh: () => Promise<void>
}

const SiteBrandingContext = createContext<SiteBrandingContextValue | null>(null)

async function fetchPublicSiteBranding(): Promise<SiteBranding> {
  try {
    const res = await fetch(apiUrl('/site-branding'))
    if (!res.ok) return { logoUrl: null, brandName: null }
    const data = (await res.json()) as {
      logoUrl?: string | null
      brandName?: string | null
    }
    return {
      logoUrl: data.logoUrl?.trim() || null,
      brandName: data.brandName?.trim() || null,
    }
  } catch {
    return { logoUrl: null, brandName: null }
  }
}

export function SiteBrandingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [branding, setBranding] = useState<SiteBranding>({
    logoUrl: null,
    brandName: null,
  })

  const refresh = useCallback(async () => {
    const next = await fetchPublicSiteBranding()
    setBranding(next)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<SiteBrandingContextValue>(() => {
    const logoSrc = branding.logoUrl?.trim() || BRAND_LOGO_SRC
    const brandName = branding.brandName?.trim() || BRAND_NAME
    return {
      ready,
      logoSrc,
      brandName,
      customLogo: Boolean(branding.logoUrl?.trim()),
      branding,
      refresh,
    }
  }, [branding, ready, refresh])

  return (
    <SiteBrandingContext.Provider value={value}>
      {children}
    </SiteBrandingContext.Provider>
  )
}

export function useSiteBranding(): SiteBrandingContextValue {
  const ctx = useContext(SiteBrandingContext)
  if (!ctx) {
    return {
      ready: true,
      logoSrc: BRAND_LOGO_SRC,
      brandName: BRAND_NAME,
      customLogo: false,
      branding: { logoUrl: null, brandName: null },
      refresh: async () => {},
    }
  }
  return ctx
}
