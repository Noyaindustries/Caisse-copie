import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { IconArrowRight } from '../../ui/icons'
import { cn } from '../../ui/cn'

export function MarketingStickyCta({
  onStart,
  onLogin,
  watchSelector = '#marketing-hero',
}: {
  onStart: () => void
  onLogin: () => void
  watchSelector?: string
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const target = document.querySelector(watchSelector)
    if (!target) {
      const onScroll = () => setShow(window.scrollY > 720)
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShow(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '0px 0px -2% 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [watchSelector])

  if (!show) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className={cn(
          'marketing-sticky-bar pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 rounded-2xl p-2',
          'sm:gap-3 sm:p-2.5',
        )}
      >
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onLogin}>
          Connexion
        </Button>
        <Button
          type="button"
          className="marketing-cta-glow min-w-0 flex-1 sm:flex-none sm:px-6"
          variant="primary"
          size="sm"
          onClick={onStart}
          iconRight={<IconArrowRight className="h-4 w-4" />}
        >
          Essai gratuit
        </Button>
      </div>
    </div>
  )
}
