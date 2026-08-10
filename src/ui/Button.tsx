import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconSpinner } from './icons'
import { cn } from './cn'

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'ghost'
  | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 min-h-8 px-2.5 text-[12px] tracking-tight',
  md: 'h-9 min-h-9 px-3.5 text-[13px] tracking-tight',
  lg: 'h-11 min-h-11 px-5 text-sm tracking-tight',
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'ui-btn-primary',
  accent: 'ui-btn-accent',
  secondary: 'ui-btn-secondary',
  ghost: 'ui-btn-ghost',
  danger: 'ui-btn-danger',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'ui-btn',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <IconSpinner className="h-3.5 w-3.5 animate-spin" />
      ) : iconLeft ? (
        <span className="flex shrink-0 items-center [&_svg]:h-3.5 [&_svg]:w-3.5">
          {iconLeft}
        </span>
      ) : null}
      {children ? (
        <span className={cn(fullWidth ? 'min-w-0 text-center leading-snug' : 'truncate')}>
          {children}
        </span>
      ) : null}
      {iconRight && !loading ? (
        <span className="flex shrink-0 items-center [&_svg]:h-3.5 [&_svg]:w-3.5">
          {iconRight}
        </span>
      ) : null}
    </button>
  )
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...rest
}: Omit<Props, 'iconLeft' | 'iconRight' | 'loading' | 'fullWidth'>) {
  const dim =
    size === 'sm'
      ? 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4'
      : size === 'lg'
        ? 'h-11 w-11 [&_svg]:h-5 [&_svg]:w-5'
        : 'h-9 w-9 [&_svg]:h-[18px] [&_svg]:w-[18px]'
  return (
    <button
      type="button"
      className={cn(
        'ui-btn ui-icon-btn shrink-0 px-0',
        VARIANT[variant],
        dim,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
