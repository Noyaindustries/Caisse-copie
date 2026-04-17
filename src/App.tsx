import { useCallback, useEffect, useMemo, useState } from 'react'
import { effectivePermissions } from './auth/permissions'
import {
  clearStaffSession,
  getStaffSession,
  setStaffSession,
} from './auth/session'
import type { StaffAuthMethod, StaffProfile } from './auth/types'
import { LoginScreen } from './components/LoginScreen'
import { OfflineBanner } from './components/OfflineBanner'
import { ActiveStoreProvider } from './context/ActiveStoreContext'
import { ensureSeed } from './db/db'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { Shell } from './Shell'
import { LuxuryStorefrontView } from './views/LuxuryStorefrontView'

export default function App() {
  const online = useOnlineStatus()
  const [staff, setStaff] = useState(() => getStaffSession())
  const [seedReady, setSeedReady] = useState(false)
  const [showStaffLogin, setShowStaffLogin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void ensureSeed().then(() => {
      if (!cancelled) setSeedReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = useCallback(
    (profile: StaffProfile, authMethod: StaffAuthMethod) => {
      setStaffSession(profile.id, authMethod)
      setStaff(getStaffSession())
      setShowStaffLogin(false)
    },
    [],
  )

  const canSwitchStore = useMemo(() => {
    if (!staff) return false
    return effectivePermissions(staff.profile).canSwitchStore
  }, [staff])

  const handleLogout = useCallback(() => {
    clearStaffSession()
    setStaff(null)
    setShowStaffLogin(false)
  }, [])

  return (
    <ActiveStoreProvider canSwitchStore={canSwitchStore}>
      {!staff ? (
        showStaffLogin ? (
          <div className="flex min-h-svh flex-col bg-zinc-50">
            {!online ? <OfflineBanner /> : null}
            <div className="mx-auto w-full max-w-5xl px-4 pt-6">
              <button
                type="button"
                onClick={() => setShowStaffLogin(false)}
                className="ui-btn ui-btn-secondary"
              >
                ← Retour boutique en ligne
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <LoginScreen onSuccess={handleLogin} />
            </div>
          </div>
        ) : (
          <LuxuryStorefrontView
            online={online}
            seedReady={seedReady}
            onOpenStaffLogin={() => setShowStaffLogin(true)}
          />
        )
      ) : !seedReady ? (
        <div className="flex min-h-svh flex-col bg-zinc-50">
          {!online ? <OfflineBanner /> : null}
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <p className="text-sm font-semibold text-zinc-700">
              Chargement de la caisse…
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="ui-btn ui-btn-ghost"
            >
              Changer de profil
            </button>
          </div>
        </div>
      ) : (
        <Shell
          staff={staff.profile}
          online={online}
          onLogout={handleLogout}
        />
      )}
    </ActiveStoreProvider>
  )
}
