import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type Variant = 'primary' | 'dark' | 'ghost' | 'ghost-inverse' | 'text' | 'danger' | 'icon'
type Size = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: Variant
  size?: Size
  block?: boolean
  className?: string
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

function classes({ variant = 'primary', size = 'md', block, className }: CommonProps) {
  return cn(
    'btn',
    variant === 'primary'        && 'btn-primary',
    variant === 'dark'           && 'btn-dark',
    variant === 'ghost'          && 'btn-ghost',
    variant === 'ghost-inverse'  && 'btn-ghost-inverse',
    variant === 'text'           && 'btn-text',
    variant === 'danger'         && 'btn-danger',
    variant === 'icon'           && 'btn-icon',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    block && 'btn-block',
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant, size, block, className, type = 'button', ...rest }, ref) {
    return <button ref={ref} type={type} className={classes({ variant, size, block, className })} {...rest} />
  }
)

type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>

export const ButtonLink = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function ButtonLink({ variant, size, block, className, ...rest }, ref) {
    return <a ref={ref} className={classes({ variant, size, block, className })} {...rest} />
  }
)
