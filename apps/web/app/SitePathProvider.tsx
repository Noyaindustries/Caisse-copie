'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { SitePathContext } from '../src/lib/sitePathContext'

export function SitePathProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  const navigate = useCallback(
    (to: string) => {
      const target = to.startsWith('/') ? to : `/${to}`
      router.push(target)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
    },
    [router],
  )

  const value = useMemo(
    () => ({ pathname, navigate }),
    [pathname, navigate],
  )

  return (
    <SitePathContext.Provider value={value}>{children}</SitePathContext.Provider>
  )
}
