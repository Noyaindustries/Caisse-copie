'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type SitePathContextValue = {
  pathname: string
  navigate: (to: string) => void
}

export const SitePathContext = createContext<SitePathContextValue | null>(null)

/** Doit être utilisé sous SitePathProvider (apps/web). */
export function useSitePath(): [string, (to: string) => void] {
  const ctx = useContext(SitePathContext)
  if (!ctx) {
    throw new Error('useSitePath doit être utilisé dans SitePathProvider')
  }
  return [ctx.pathname, ctx.navigate]
}

export type SitePathProviderProps = { children: ReactNode }
