import type { UserRole } from '../auth/types'
import { roleLabel } from '../auth/profiles'
import type { Store } from '../db/types'
import { navSectionsForRole, type NavViewId } from '../navigation'
import { NavIcon } from './NavIcons'

export const CATEGORY_TABS = [
  'Tous',
  'Boissons',
  'Alimentation',
  'Hygiène',
  'Autre',
] as const

export type CategoryTab = (typeof CATEGORY_TABS)[number]

type Props = {
  activeView: NavViewId
  onSelectView: (id: NavViewId) => void
  ruptureCount: number
  lowStockCount: number
  onlineOrdersPending: number
  online: boolean
  syncLabel: string
  syncBusy: boolean
  onSyncNow: () => void
  stores: Store[]
  activeStoreId: string
  onActiveStoreChange: (id: string) => void
  canSwitchStore: boolean
  user: {
    displayName: string
    initials: string
    role: UserRole
  }
  onLogout: () => void
}

export function Sidebar({
  activeView,
  onSelectView,
  ruptureCount,
  lowStockCount,
  onlineOrdersPending,
  online,
  syncLabel,
  syncBusy,
  onSyncNow,
  stores,
  activeStoreId,
  onActiveStoreChange,
  canSwitchStore,
  user,
  onLogout,
}: Props) {
  const sections = navSectionsForRole(user.role)
  const hideInternalMenu = false

  return (
    <aside className="premium-dark-card premium-scrollbar flex w-68 shrink-0 flex-col border-r border-white/10 text-slate-300 shadow-xl shadow-slate-900/20">
      <div className="relative overflow-hidden border-b border-white/10 px-4 py-6">
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]"
            aria-hidden
          >
            C
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">
              CaisseCI
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              Point de vente pro
            </p>
          </div>
        </div>
        <div className="premium-ring relative mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p className="font-semibold uppercase tracking-wide">
            Espace opérationnel
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-100/90">
            Navigation par rôle, actions sécurisées et synchro en continu.
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {!hideInternalMenu
          ? sections.map((section) => (
              <div key={section.title}>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = activeView === item.id
                    const badgeCount =
                      item.badge === 'lowStock' ? lowStockCount : 0
                    const showStockBadges =
                      'stockBadges' in item && item.stockBadges
                    const showOnlineOrdersBadge =
                      item.id === 'onlineOrders' && onlineOrdersPending > 0
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectView(item.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                            isActive
                              ? 'bg-linear-to-r from-emerald-500/20 to-teal-500/10 font-semibold text-white shadow-inner ring-1 ring-emerald-500/30'
                              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                          }`}
                        >
                          <span
                            className={
                              isActive ? 'text-emerald-400' : 'text-slate-500'
                            }
                          >
                            <NavIcon id={item.id} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {showStockBadges ? (
                            <span className="flex shrink-0 gap-1">
                              {ruptureCount > 0 ? (
                                <span
                                  className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                                  title="Rupture"
                                >
                                  {ruptureCount}
                                </span>
                              ) : null}
                              {lowStockCount > 0 ? (
                                <span
                                  className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                                  title="Sous le seuil"
                                >
                                  {lowStockCount}
                                </span>
                              ) : null}
                            </span>
                          ) : showOnlineOrdersBadge ? (
                            <span className="shrink-0 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                              {onlineOrdersPending}
                            </span>
                          ) : badgeCount > 0 ? (
                            <span className="shrink-0 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                              {badgeCount}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          : (
            <p className="mx-1 rounded-xl bg-white/4 px-3 py-3 text-[11px] leading-relaxed text-slate-500 ring-1 ring-white/10">
              Menu de navigation masqué pour ce profil.
            </p>
            )}
        {stores.length > 0 ? (
          <div className="mx-1 mt-3 rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/10">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Point de vente actif
            </p>
            {canSwitchStore && stores.length > 1 ? (
              <select
                value={activeStoreId}
                onChange={(e) => onActiveStoreChange(e.target.value)}
                aria-label="Choisir le magasin"
                className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-2 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-medium text-slate-300">
                {stores.find((s) => s.id === activeStoreId)?.name ?? '—'}
              </p>
            )}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div
          className={`mb-2 flex flex-col gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
            online
              ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'
              : 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/25'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                online ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="min-w-0 leading-snug">{syncLabel}</span>
          </div>
          <button
            type="button"
            disabled={!online || syncBusy}
            onClick={onSyncNow}
            className="premium-btn-dark w-full rounded-lg py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncBusy
              ? 'Synchronisation…'
              : online
                ? 'Pousser vers le cloud'
                : 'Cloud indisponible hors ligne'}
          </button>
        </div>
        <div className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-slate-600 to-slate-800 text-xs font-bold text-white ring-1 ring-white/10">
              {user.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {user.displayName}
              </span>
              <span className="text-xs text-slate-500">
                {roleLabel(user.role)}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="premium-btn-dark mt-2 w-full rounded-lg py-2 text-xs font-medium"
          >
            Changer de profil
          </button>
        </div>
      </div>
    </aside>
  )
}
