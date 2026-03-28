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

export default function App() {
  const online = useOnlineStatus()
  const [staff, setStaff] = useState(() => getStaffSession())
  const [seedReady, setSeedReady] = useState(false)

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
  }, [])

  return (
    <ActiveStoreProvider canSwitchStore={canSwitchStore}>
      {!staff ? (
        <div className="flex min-h-svh flex-col bg-slate-100">
          {!online ? <OfflineBanner /> : null}
          <div className="flex min-h-0 flex-1 flex-col">
            <LoginScreen onSuccess={handleLogin} />
          </div>
        </div>
      ) : !seedReady ? (
        <div className="flex min-h-svh flex-col bg-slate-100">
          {!online ? <OfflineBanner /> : null}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-600">
            <p>Chargement de la caisse…</p>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-500 underline hover:text-slate-700"
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
