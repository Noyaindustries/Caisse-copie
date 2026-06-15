import { useEffect, useState } from 'react'

export function MarketingScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      const max = scrollHeight - clientHeight
      setProgress(max > 0 ? (scrollTop / max) * 100 : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-transparent"
      aria-hidden
    >
      <div
        className="h-full bg-linear-to-r from-accent via-violet-500 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.45)] transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
