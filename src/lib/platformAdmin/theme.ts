import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'caisseci-admin-theme'

export type AdminTheme = 'light' | 'dark'

export function getStoredAdminTheme(): AdminTheme {
  if (typeof localStorage === 'undefined') return 'light'
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(() => getStoredAdminTheme())
  const dark = theme === 'dark'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, dark, setTheme, toggle }
}

export const adminThemeClasses = {
  light: {
    shell: 'bg-[#f4f6fb] text-ink',
    sidebar:
      'border-zinc-200/80 bg-white/95 text-ink shadow-[4px_0_24px_-12px_rgba(15,23,42,0.08)]',
    header: 'border-zinc-200/80 bg-white/90',
    card: '',
    input: 'ui-input',
    tableHead: 'border-border/60 bg-surface-muted/80 text-ink-subtle',
    tableRowHover: 'hover:bg-violet-50/50',
    tableRowSelected: 'bg-violet-50 ring-1 ring-inset ring-violet-200',
    detailBox: 'border-border/60 bg-surface-muted/50',
    muted: 'text-ink-muted',
    subtle: 'text-ink-subtle',
    navActive: 'bg-violet-100 text-violet-900',
    navIdle: 'text-ink-muted hover:bg-zinc-100 hover:text-ink',
    kpi: '',
  },
  dark: {
    shell: 'bg-[#0f1117] text-zinc-100',
    sidebar:
      'border-zinc-800 bg-[#141a24]/98 text-zinc-100 shadow-[4px_0_32px_-8px_rgba(0,0,0,0.45)]',
    header: 'border-zinc-800 bg-[#141a24]/90',
    card: 'border-zinc-800 !bg-[#1a2030]/90',
    input:
      'w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25',
    tableHead: 'border-zinc-800 bg-zinc-900/60 text-zinc-500',
    tableRowHover: 'hover:bg-zinc-800/60',
    tableRowSelected: 'bg-violet-950/50 ring-1 ring-inset ring-violet-700/60',
    detailBox: 'border-zinc-700/80 bg-zinc-900/50',
    muted: 'text-zinc-400',
    subtle: 'text-zinc-500',
    navActive: 'bg-violet-500/15 text-violet-200',
    navIdle: 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100',
    kpi: 'border-zinc-800 !bg-[#1a2030]/90 before:from-zinc-800/30 [&_.ui-eyebrow]:text-zinc-500 [&_p]:text-zinc-100',
  },
} as const

export type AdminThemeClasses = (typeof adminThemeClasses)[AdminTheme]
