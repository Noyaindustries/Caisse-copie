import { useEffect, useState, type ReactNode } from 'react'
import type { UserRole } from '../auth/types'
import { roleLabel } from '../auth/profiles'
import type { Store } from '../db/types'
import { navSectionsForRole, type NavViewId } from '../navigation'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'
import { Tooltip } from '../ui/Tooltip'
import {
  IconAnalytique,
  IconCaisse,
  IconCatalogue,
  IconChevronDown,
  IconClose,
  IconCollapse,
  IconDash,
  IconExpand,
  IconIntegrations,
  IconJournal,
  IconLogout,
  IconNetwork,
  IconOnlineOrders,
  IconPersonnel,
  IconPointage,
  IconStocks,
  IconStore,
} from '../ui/icons'

/** Onglet filtre caisse : « Tous » ou libellé de catégorie (voir `productCategories` en base). */
export type CategoryTab = string

const ICON_BY_VIEW: Record<NavViewId, ReactNode> = {
  caisse: <IconCaisse />,
  dash: <IconDash />,
  catalogue: <IconCatalogue />,
  stocks: <IconStocks />,
  onlineOrders: <IconOnlineOrders />,
  journal: <IconJournal />,
  personnel: <IconPersonnel />,
  pointage: <IconPointage />,
  analytique: <IconAnalytique />,
  integrations: <IconIntegrations />,
  network: <IconNetwork />,
}

type CommonProps = {
  activeView: NavViewId
  onSelectView: (id: NavViewId) => void
  ruptureCount: number
  lowStockCount: number
  onlineOrdersPending: number
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

type DesktopProps = CommonProps & {
  collapsed: boolean
  onToggleCollapsed: () => void
}

type MobileProps = CommonProps & {
  open: boolean
  onClose: () => void
}

function SidebarBody({
  activeView,
  onSelectView,
  ruptureCount,
  lowStockCount,
  onlineOrdersPending,
  stores,
  activeStoreId,
  onActiveStoreChange,
  canSwitchStore,
  user,
  onLogout,
  collapsed,
  onToggleCollapsed,
  variant,
}: CommonProps & {
  collapsed: boolean
  onToggleCollapsed?: () => void
  variant: 'desktop' | 'mobile'
}) {
  const sections = navSectionsForRole(user.role)
  const activeStore = stores.find((s) => s.id === activeStoreId)
  const [storeMenuOpen, setStoreMenuOpen] = useState(false)
  const isMobile = variant === 'mobile'

  return (
    <>
      {/* Brand */}
      <div
        className={cn(
          'flex h-14 items-center gap-2.5 border-b border-zinc-100 px-3',
          collapsed ? 'justify-center' : 'px-4',
        )}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white"
          aria-hidden
        >
          C
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-zinc-900">
              CaisseCI
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-zinc-400">
              Point de vente
            </p>
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="ui-scroll flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed ? (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {section.title}
              </p>
            ) : (
              <div className="mb-1 px-2">
                <div className="ui-divider" />
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = activeView === item.id
                const showStockBadges =
                  'stockBadges' in item && item.stockBadges
                const showOnlineOrdersBadge =
                  item.id === 'onlineOrders' && onlineOrdersPending > 0
                const badgeCount =
                  item.badge === 'lowStock' ? lowStockCount : 0
                const icon = ICON_BY_VIEW[item.id]

                const button = (
                  <button
                    type="button"
                    onClick={() => onSelectView(item.id)}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-md text-[13px] transition',
                      isMobile ? 'px-2.5 py-2.5' : 'px-2 py-1.5',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-zinc-100 font-semibold text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
                    )}
                  >
                    {isActive ? (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-zinc-900"
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4',
                        isActive ? 'text-zinc-900' : 'text-zinc-400',
                      )}
                    >
                      {icon}
                    </span>
                    {!collapsed ? (
                      <>
                        <span className="min-w-0 flex-1 truncate text-left">
                          {item.label}
                        </span>
                        {showStockBadges ? (
                          <span className="flex shrink-0 gap-1">
                            {ruptureCount > 0 ? (
                              <Badge tone="danger">{ruptureCount}</Badge>
                            ) : null}
                            {lowStockCount > 0 ? (
                              <Badge tone="warning">{lowStockCount}</Badge>
                            ) : null}
                          </span>
                        ) : showOnlineOrdersBadge ? (
                          <Badge tone="success">{onlineOrdersPending}</Badge>
                        ) : badgeCount > 0 ? (
                          <Badge tone="warning">{badgeCount}</Badge>
                        ) : null}
                      </>
                    ) : null}
                  </button>
                )

                return (
                  <li key={item.id}>
                    {collapsed && !isMobile ? (
                      <Tooltip content={item.label} side="right">
                        {button}
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-100 p-2">
        {/* Store selector */}
        {stores.length > 0 && !collapsed ? (
          <div className="relative mb-2">
            <button
              type="button"
              disabled={!canSwitchStore || stores.length <= 1}
              onClick={() => setStoreMenuOpen((v) => !v)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left text-[12px] transition',
                canSwitchStore && stores.length > 1
                  ? 'hover:bg-zinc-100'
                  : 'cursor-default opacity-90',
              )}
            >
              <IconStore className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">
                {activeStore?.name ?? '—'}
              </span>
              {canSwitchStore && stores.length > 1 ? (
                <IconChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
              ) : null}
            </button>
            {storeMenuOpen && canSwitchStore ? (
              <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-[var(--shadow-pop)]">
                {stores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onActiveStoreChange(s.id)
                      setStoreMenuOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-left',
                      s.id === activeStoreId
                        ? 'bg-zinc-100 font-semibold text-zinc-900'
                        : 'text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* User block */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            collapsed ? 'justify-center' : 'bg-zinc-50',
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
            {user.initials}
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-zinc-900">
                {user.displayName}
              </p>
              <p className="truncate text-[10px] text-zinc-500">
                {roleLabel(user.role)}
              </p>
            </div>
          ) : null}
          {!collapsed ? (
            <Tooltip content="Changer de profil" side="top">
              <button
                type="button"
                onClick={onLogout}
                className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Se déconnecter"
              >
                <IconLogout className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </div>

        {/* Collapse toggle (desktop only) */}
        {!isMobile && onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
            aria-label={collapsed ? 'Étendre la barre' : 'Réduire la barre'}
          >
            {collapsed ? (
              <IconExpand className="h-3.5 w-3.5" />
            ) : (
              <>
                <IconCollapse className="h-3.5 w-3.5" />
                <span>Réduire</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </>
  )
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onSelectView,
  ...rest
}: DesktopProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex',
        collapsed ? 'w-[68px]' : 'w-[244px]',
      )}
    >
      <SidebarBody
        {...rest}
        onSelectView={onSelectView}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        variant="desktop"
      />
    </aside>
  )
}

export function MobileNavDrawer({
  open,
  onClose,
  onSelectView,
  ...rest
}: MobileProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 animate-ui-fade-in bg-zinc-950/40 backdrop-blur-[2px]"
      />
      <aside className="relative z-10 flex h-svh w-[280px] max-w-[85vw] animate-ui-slide-up flex-col border-r border-zinc-200 bg-white shadow-[var(--shadow-overlay)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Fermer"
        >
          <IconClose className="h-4 w-4" />
        </button>
        <SidebarBody
          {...rest}
          onSelectView={(id) => {
            onSelectView(id)
            onClose()
          }}
          collapsed={false}
          variant="mobile"
        />
      </aside>
    </div>
  )
}
