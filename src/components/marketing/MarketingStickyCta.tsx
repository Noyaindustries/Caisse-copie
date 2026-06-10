import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { IconArrowRight } from '../../ui/icons'

export function MarketingStickyCta({
  onStart,
  visibleAfter = 600,
}: {
  onStart: () => void
  visibleAfter?: number
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > visibleAfter)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [visibleAfter])

  if (!show) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-white/95 p-3 shadow-[0_-8px_32px_-8px_rgba(23,32,51,0.2)] backdrop-blur-xl sm:hidden">
      <Button
        type="button"
        className="w-full"
        variant="primary"
        onClick={onStart}
        iconRight={<IconArrowRight className="h-4 w-4" />}
      >
        Essai gratuit 1 mois
      </Button>
    </div>
  )
}
