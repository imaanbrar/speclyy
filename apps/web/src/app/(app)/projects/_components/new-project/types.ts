import type { ProjectTypeKey } from '@/lib/projects/types'

export type NPProjectTypeId =
  | 'new-build'
  | 'reno'
  | 'room-remodel'
  | 'decor'
  | 'commercial'
  | 'staging'
  | 'other'

export interface NPProjectType {
  id: NPProjectTypeId
  label: string
  sub: string
  accent: string
  palette: readonly [string, string, string]
  /** Categories the wizard pre-creates as groups for this project type. */
  auto: readonly string[]
  /** Which cover archetype the live preview uses. */
  cover: ProjectTypeKey
  /** Pre-selected rooms on type pick — user can adjust. */
  defaultRooms?: readonly string[]
  /** True if this is the user-named "Other" tile. */
  custom?: boolean
}

export type StagingTargetId = 'sale' | 'ltr' | 'str' | 'corp'
export type StagingPropertyId = 'sfr' | 'condo' | 'luxury' | 'new-const'
export type StagingOccupancyId = 'vacant' | 'occupied' | 'partial'
export type CommercialConceptId = 'office' | 'hospitality' | 'retail' | 'wellness'

export interface NPStyleRef {
  kind: 'pinterest' | 'image' | 'link'
  label: string
  pins?: number
  thumbs?: readonly string[]
  palette?: readonly string[]
}

export interface NPData {
  type?: NPProjectTypeId
  customLabel?: string
  rooms: string[]
  customRooms: string[]
  customZones?: string[]
  renames: Record<string, string>
  customRoomFloors?: Record<string, string>
  floorPlanName?: string | null
  planSkipped?: boolean
  planPhase?: 0 | 1
  /** Commercial */
  concept?: CommercialConceptId
  /** Staging */
  propertyType?: StagingPropertyId
  target?: StagingTargetId
  occupancy?: StagingOccupancyId
  refs: NPStyleRef[]
  name?: string
  client?: string
}

export const NP_TYPES: readonly NPProjectType[] = [
  {
    id: 'new-build',
    label: 'New build — House',
    sub: 'Ground-up, full schedule',
    accent: '#8C7A63',
    palette: ['#C7B8A1', '#8C7A63', '#3F352B'],
    auto: ['Plumbing', 'Lighting', 'Paint', 'Tile', 'Hardware', 'Appliances', 'Doors & windows', 'Cabinetry', 'Trim'],
    cover: 'new-build',
    defaultRooms: ['Foyer', 'Kitchen', 'Primary suite', 'Primary bath', 'Secondary bed', 'Secondary bath', 'Living room', 'Dining', 'Office', 'Powder room', 'Laundry', 'Mudroom', 'Outdoor'],
  },
  {
    id: 'reno',
    label: 'Home renovation',
    sub: 'Multi-room, phased',
    accent: '#C06B3E',
    palette: ['#E8DFCE', '#A89884', '#3F352B'],
    auto: ['Plumbing', 'Lighting', 'Paint', 'Tile', 'Hardware', 'Appliances', 'Doors & windows'],
    cover: 'reno',
    defaultRooms: ['Foyer', 'Kitchen', 'Primary suite', 'Primary bath', 'Secondary bed', 'Secondary bath', 'Living room', 'Dining', 'Office', 'Powder room', 'Laundry', 'Mudroom'],
  },
  {
    id: 'room-remodel',
    label: 'Room(s) remodel',
    sub: 'Kitchen, bath, living, more',
    accent: '#9C7A4F',
    palette: ['#E8DFCE', '#C7B8A1', '#8C7A63'],
    auto: ['Plumbing', 'Tile & stone', 'Lighting', 'Hardware', 'Cabinetry', 'Paint'],
    cover: 'reno',
    defaultRooms: ['Kitchen', 'Primary bath'],
  },
  {
    id: 'decor',
    label: 'Home decor',
    sub: 'Furniture & soft styling',
    accent: '#A89884',
    palette: ['#F0EBE0', '#D4C5AE', '#8C7A63'],
    auto: ['Furniture', 'Rugs', 'Lighting', 'Art & accessories', 'Window treatments'],
    cover: 'staging',
    defaultRooms: ['Living room', 'Primary suite', 'Dining'],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    sub: 'Hospitality, office, retail',
    accent: '#5C4B38',
    palette: ['#1F1A12', '#5C4B38', '#A89884'],
    auto: ['Lighting', 'FFE', 'Finishes', 'Signage', 'Casegoods'],
    cover: 'commercial',
  },
  {
    id: 'staging',
    label: 'Staging',
    sub: 'Quick, sale-driven',
    accent: '#A89884',
    palette: ['#E8DFCE', '#C7B8A1', '#A89884'],
    auto: ['Furniture', 'Art & accessories', 'Bedding', 'Lighting'],
    cover: 'staging',
  },
  {
    id: 'other',
    label: 'Something else',
    sub: 'Name your own type',
    accent: '#6E5A48',
    palette: ['#E8DFCE', '#A89884', '#3F352B'],
    auto: [],
    cover: 'reno',
    custom: true,
  },
]
