import { useEffect, type RefObject } from 'react'

/**
 * Convertit la molette verticale en défilement horizontal sur les barres
 * de navigation (catégories, onglets) tout en laissant remonter le scroll
 * au parent aux extrémités.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled = true,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 1) return

      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft >= maxScroll - 1

      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) {
        return
      }

      event.preventDefault()
      el.scrollLeft += event.deltaY
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, enabled])
}
