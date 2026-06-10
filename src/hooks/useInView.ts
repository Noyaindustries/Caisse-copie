import { useEffect, useRef, useState } from 'react'

function isInViewport(el: Element, threshold: number) {
  const rect = el.getBoundingClientRect()
  const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
  const ratio = visibleHeight / Math.max(rect.height, 1)
  return ratio >= threshold || (rect.top < window.innerHeight && rect.bottom > 0 && rect.top < window.innerHeight * 0.85)
}

export function useInView(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reveal = () => setVisible(true)

    if (isInViewport(el, threshold)) {
      reveal()
      return
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal()
          obs.disconnect()
        }
      },
      { threshold: Math.min(threshold, 0.12), rootMargin: '0px 0px 48px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}
