import type { ReactNode } from 'react'
import type { NavViewId } from '../navigation'

const cls = 'h-[18px] w-[18px] shrink-0'

function IconCaisse() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16v4H4V6zm0 6h10v8H4v-8zm12 0h4v8h-4v-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChart() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M9 19V9M14 19v-6M19 19V12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4v10l-8 4-8-4V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l8-4M12 12v9M12 12L4 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLockClose() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V8a4 4 0 118 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 19v-1a5 5 0 015-5h0a5 5 0 015 5v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M17 11h2M19 11v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPuzzle() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h4v4H4V8zm6-4h4v4h-4V4zm0 10h4v4h-4v-4zm6-6h4v4h-4V8z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V10l6-3v13M10 20V7l6-3v16M4 10l6 3 6-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrending() {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16l6-6 4 4 6-8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 6h4v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const MAP: Record<NavViewId, ReactNode> = {
  caisse: <IconCaisse />,
  dash: <IconChart />,
  catalogue: <IconGrid />,
  stocks: <IconPackage />,
  journal: <IconLockClose />,
  personnel: <IconUsers />,
  analytique: <IconTrending />,
  integrations: <IconPuzzle />,
  network: <IconBuilding />,
}

export function NavIcon({ id }: { id: NavViewId }) {
  return MAP[id]
}
