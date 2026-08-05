'use client'

import { useSitePath, ROUTES } from '../lib/siteRoutes'
import { PlatformAdminPage } from '../views/PlatformAdminPage'

export function AdminScreen() {
  const [, navigate] = useSitePath()
  return <PlatformAdminPage onExit={() => navigate(ROUTES.home)} />
}
