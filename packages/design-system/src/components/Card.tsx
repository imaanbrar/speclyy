import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  subtle?: boolean
}

export function Card({ hover, subtle, className, ...rest }: CardProps) {
  return <div className={cn('card', hover && 'card-hover', subtle && 'card-subtle', className)} {...rest} />
}
