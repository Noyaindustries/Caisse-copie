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
          <div className="flex min-h-svh flex-col">
            {!online ? <OfflineBanner /> : null}
            <div className="mx-auto w-full max-w-5xl px-4 pt-6">
              <button
                type="button"
                onClick={() => setShowStaffLogin(false)}
                className="premium-btn-dark rounded-lg px-3 py-2 text-sm font-medium"
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
        <div className="flex min-h-svh flex-col">
          {!online ? <OfflineBanner /> : null}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-600">
            <div className="relative">
              <span className="absolute inset-0 rounded-full border-2 border-emerald-300/60" />
              <img
                src="/branding/greenfever-logo.png"
                alt="Logo de chargement"
                className="h-16 w-16 rounded-full border-2 border-amber-200/55 object-cover ring-2 ring-emerald-200/35 animate-[spin_3.2s_linear_infinite]"
              />
            </div>
            <p className="premium-title text-lg font-semibold">
              Chargement de la caisse…
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="premium-btn-dark rounded-lg px-3 py-2 text-sm font-medium"
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
