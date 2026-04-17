import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from './cn'

type Density = 'comfortable' | 'compact'

export function Table({
  className,
  children,
  density = 'comfortable',
  minWidth,
}: {
  className?: string
  children: ReactNode
  /** `compact` réduit légèrement le padding (utile pour mobile / vues denses). */
  density?: Density
  /** Force une largeur min en pixels (active scroll horizontal sous ce seuil). */
  minWidth?: number
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-zinc-200 bg-white',
        className,
      )}
      data-density={density}
    >
      <div className="ui-scroll relative overflow-x-auto">
        <table
          className="w-full text-left text-sm"
          style={minWidth ? { minWidth } : undefined}
        >
          {children}
        </table>
      </div>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </thead>
  )
}

export function TBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <tbody className={cn('divide-y divide-zinc-100', className)}>
      {children}
    </tbody>
  )
}

export function Tr({
  className,
  children,
  hover = true,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        hover && 'transition-colors hover:bg-zinc-50/70',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  )
}

type ColResponsive = {
  /** Cache la colonne en dessous de la breakpoint indiquée. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  /** Rend la colonne sticky à gauche (pratique pour la 1ère colonne d'une matrice). */
  sticky?: boolean
}

const HIDE_CLS: Record<NonNullable<ColResponsive['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

export function Th({
  className,
  align = 'left',
  hideBelow,
  sticky,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> &
  ColResponsive & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 font-semibold sm:px-4',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        sticky &&
          'sticky left-0 z-10 bg-zinc-50/95 backdrop-blur-sm',
        hideBelow && HIDE_CLS[hideBelow],
        className,
      )}
      {...rest}
    />
  )
}

export function Td({
  className,
  align = 'left',
  mono = false,
  hideBelow,
  sticky,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> &
  ColResponsive & {
    align?: 'left' | 'right' | 'center'
    mono?: boolean
  }) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 text-[13px] text-zinc-700 sm:px-4 sm:py-3',
        mono && 'font-mono-nums',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        sticky && 'sticky left-0 z-10 bg-white',
        hideBelow && HIDE_CLS[hideBelow],
        className,
      )}
      {...rest}
    />
  )
}
