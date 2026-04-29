import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function Base({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Plus = (p: IconProps) => <Base {...p}><path d="M5 12h14"/><path d="M12 5v14"/></Base>
export const Check = (p: IconProps) => <Base {...p}><path d="M20 6 9 17l-5-5"/></Base>
export const X = (p: IconProps) => <Base {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Base>
export const ArrowRight = (p: IconProps) => <Base {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Base>
export const ChevronRight = (p: IconProps) => <Base {...p}><path d="m9 18 6-6-6-6"/></Base>
export const ChevronDown = (p: IconProps) => <Base {...p}><path d="m6 9 6 6 6-6"/></Base>
export const Search = (p: IconProps) => <Base {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></Base>
export const MoreHorizontal = (p: IconProps) => <Base {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></Base>
export const Download = (p: IconProps) => <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Base>
export const Sparkle = (p: IconProps) => <Base {...p}><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m5.6 18.4 2.8-2.8"/><path d="m15.6 8.4 2.8-2.8"/></Base>
export const Link = (p: IconProps) => <Base {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Base>
export const FileText = (p: IconProps) => <Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></Base>
export const Folder = (p: IconProps) => <Base {...p}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/></Base>
export const LogOut = (p: IconProps) => <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Base>
export const ArrowLeft = (p: IconProps) => <Base {...p}><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></Base>
export const MapPin = (p: IconProps) => <Base {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></Base>
export const Loader = (p: IconProps) => <Base {...p}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></Base>
