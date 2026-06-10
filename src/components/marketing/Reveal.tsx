import type { ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'
import { cn } from '../../ui/cn'

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const { ref, visible } = useInView()

  return (
    <div
      ref={ref}
      className={cn(
        'marketing-reveal',
        visible && 'marketing-reveal-visible',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
