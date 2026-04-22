import { cn } from '../lib/cn'

export interface AvatarProps {
  initials: string
  className?: string
  title?: string
}

export function Avatar({ initials, className, title }: AvatarProps) {
  return (
    <span className={cn('avatar', className)} title={title} aria-label={title ?? initials}>
      {initials.slice(0, 2).toUpperCase()}
    </span>
  )
}
