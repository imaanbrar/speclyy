import {
  NP_ICON_PATHS,
} from './icons'
import type { CommercialConceptId, StagingOccupancyId, StagingPropertyId, StagingTargetId } from './types'

export type IconPath = string

// ---- Residential rooms ----
export const NP_ROOMS_RES: ReadonlyArray<readonly [string, IconPath]> = [
  ['Foyer',          NP_ICON_PATHS.door],
  ['Kitchen',        NP_ICON_PATHS.utensil],
  ['Primary suite',  NP_ICON_PATHS.bed],
  ['Primary bath',   NP_ICON_PATHS.spray],
  ['Secondary bed',  NP_ICON_PATHS.bed],
  ['Secondary bath', NP_ICON_PATHS.spray],
  ['Living room',    NP_ICON_PATHS.sofa],
  ['Dining',         NP_ICON_PATHS.table],
  ['Office',         NP_ICON_PATHS.layers],
  ['Powder room',    NP_ICON_PATHS.drop],
  ['Laundry',        NP_ICON_PATHS.appliance],
  ['Mudroom',        NP_ICON_PATHS.door],
  ['Guest bed',      NP_ICON_PATHS.bed],
  ['Guest bath',     NP_ICON_PATHS.spray],
  ['Outdoor',        NP_ICON_PATHS.globe],
]

// ---- Commercial zones ----
export const NP_ZONES_COM: ReadonlyArray<readonly [string, IconPath]> = [
  ['Lobby',         NP_ICON_PATHS.building],
  ['Reception',     NP_ICON_PATHS.meeting],
  ['Workspace',     NP_ICON_PATHS.layers],
  ['Meeting rooms', NP_ICON_PATHS.meeting],
  ['Café / pantry', NP_ICON_PATHS.cafe],
  ['Restrooms',     NP_ICON_PATHS.spray],
  ['Corridors',     NP_ICON_PATHS.hall],
  ['Phone rooms',   NP_ICON_PATHS.layers],
]

// Concept → starting set of zones (the wizard pre-selects these but the user
// can adjust). Keys correspond to CommercialConceptId.
export const NP_CONCEPT_DEFAULTS: Record<CommercialConceptId, readonly string[]> = {
  office:      ['Lobby', 'Workspace', 'Meeting rooms', 'Café / pantry', 'Restrooms', 'Phone rooms'],
  hospitality: ['Lobby', 'Reception', 'Café / pantry', 'Corridors', 'Restrooms'],
  retail:      ['Lobby', 'Workspace', 'Restrooms'],
  wellness:    ['Reception', 'Workspace', 'Restrooms', 'Corridors'],
}

// ---- Staging ----
export const NP_STAGING_PROPERTY: ReadonlyArray<{ id: StagingPropertyId; label: string; sub: string }> = [
  { id: 'sfr',       label: 'Single-family',   sub: 'House, townhome' },
  { id: 'condo',     label: 'Condo / apt',     sub: 'Urban listing' },
  { id: 'luxury',    label: 'Luxury estate',   sub: 'High-end, statement' },
  { id: 'new-const', label: 'New construction', sub: 'Builder model home' },
]

export const NP_STAGING_TARGET: ReadonlyArray<{ id: StagingTargetId; label: string; sub: string }> = [
  { id: 'sale', label: 'For sale listing',     sub: 'MLS, open houses' },
  { id: 'ltr',  label: 'Long-term rental',     sub: 'Annual lease, furnished' },
  { id: 'str',  label: 'Short-term rental',    sub: 'Airbnb / Vrbo, photo-ready' },
  { id: 'corp', label: 'Corporate / executive', sub: '30+ day stays' },
]

export const NP_STAGING_OCCUPANCY: ReadonlyArray<{ id: StagingOccupancyId; label: string; sub: string }> = [
  { id: 'vacant',   label: 'Vacant',   sub: 'Full stage' },
  { id: 'occupied', label: 'Occupied', sub: 'Style around their things' },
  { id: 'partial',  label: 'Partial',  sub: 'Key rooms only' },
]

export const NP_STAGING_ROOMS_BASE: ReadonlyArray<readonly [string, IconPath]> = [
  ['Living room',   NP_ICON_PATHS.sofa],
  ['Primary bed',   NP_ICON_PATHS.bed],
  ['Dining',        NP_ICON_PATHS.table],
  ['Kitchen',       NP_ICON_PATHS.utensil],
  ['Office / nook', NP_ICON_PATHS.layers],
  ['Guest bed',     NP_ICON_PATHS.bed],
  ['Outdoor',       NP_ICON_PATHS.globe],
  ['Entry',         NP_ICON_PATHS.door],
]

export function targetSuggestedRooms(target: StagingTargetId): readonly string[] {
  switch (target) {
    case 'sale': return ['Living room', 'Primary bed', 'Dining', 'Kitchen']
    case 'str':  return ['Living room', 'Primary bed', 'Dining', 'Kitchen', 'Guest bed', 'Outdoor', 'Entry']
    case 'corp': return ['Living room', 'Primary bed', 'Dining', 'Kitchen', 'Office / nook']
    case 'ltr':  return ['Living room', 'Primary bed', 'Dining']
  }
}

// ---- Floor grouping (residential) ----
export const NP_ROOM_FLOORS: Record<string, string> = {
  // Main floor
  'Foyer':          'Main floor',
  'Entry':          'Main floor',
  'Kitchen':        'Main floor',
  'Living room':    'Main floor',
  'Great room':     'Main floor',
  'Dining':         'Main floor',
  'Dining room':    'Main floor',
  'Powder room':    'Main floor',
  'Mudroom':        'Main floor',
  'Office':         'Main floor',
  'Study':          'Main floor',
  'Laundry':        'Main floor',
  'Family room':    'Main floor',
  'Sunroom':        'Main floor',
  'Outdoor':        'Main floor',
  'Patio':          'Main floor',
  'Deck':           'Main floor',
  // Second floor
  'Primary suite':  'Second floor',
  'Primary bath':   'Second floor',
  'Secondary bed':  'Second floor',
  'Secondary bath': 'Second floor',
  'Bedroom':        'Second floor',
  'Bathroom':       'Second floor',
  'Master bedroom': 'Second floor',
  'Master bath':    'Second floor',
  'Kids room':      'Second floor',
  'Nursery':        'Second floor',
  // Basement
  'Wine cellar':    'Basement',
  'Wet bar':        'Basement',
  'Lounge':         'Basement',
  'Media':          'Basement',
  'Media room':     'Basement',
  'Gym':            'Basement',
  'Cellar':         'Basement',
  'Storage':        'Basement',
}

export const NP_FLOOR_ORDER = ['Main floor', 'Second floor', 'Basement'] as const

// ---- Mock floor-plan parse results ----
// The hardcoded "AI" answer used by the parsing animation. Once a real
// detector lands these become the API response shape.
export const PARSED_STANDARD: readonly string[] = [
  'Foyer', 'Kitchen', 'Primary suite', 'Primary bath', 'Secondary bed', 'Secondary bath',
  'Living room', 'Dining', 'Powder room', 'Laundry', 'Office', 'Mudroom',
]
export const PARSED_CUSTOM: readonly string[] = ['Wet bar', 'Wine cellar', 'Lounge']
export const PARSED_RENAMES: Record<string, string> = {
  'Primary suite': 'Master bedroom',
  'Primary bath':  'Master bath',
}

// ---- Pinterest mock — 12 pins on warm interior palette ----
export const PINTEREST_PINS: ReadonlyArray<{ c: string; h: number; img: string }> = [
  { c: '#C7B8A1', h: 88, img: unsplash('photo-1616594039964-ae9021a400a0') },
  { c: '#3F352B', h: 64, img: unsplash('photo-1600210492486-724fe5c67fb0') },
  { c: '#E8DFCE', h: 96, img: unsplash('photo-1618220179428-22790b461013') },
  { c: '#A89884', h: 72, img: unsplash('photo-1631679706909-1844bbd07221') },
  { c: '#C06B3E', h: 80, img: unsplash('photo-1493663284031-b7e3aefcae8e') },
  { c: '#5C4B38', h: 90, img: unsplash('photo-1600585154340-be6161a56a0c') },
  { c: '#F0EBE0', h: 60, img: unsplash('photo-1586023492125-27b2c045efd7') },
  { c: '#8C7A63', h: 84, img: unsplash('photo-1600121848594-d8644e57abab') },
  { c: '#1F1A12', h: 70, img: unsplash('photo-1615873968403-89e068629265') },
  { c: '#D4C5AE', h: 92, img: unsplash('photo-1556909114-f6e7ad7d3136') },
  { c: '#9C7A4F', h: 68, img: unsplash('photo-1567016432779-094069958ea5') },
  { c: '#E8DFCE', h: 78, img: unsplash('photo-1505691938895-1758d7feb511') },
]

export const PINTEREST_PALETTE: readonly string[] = ['#1F1A12', '#5C4B38', '#A89884', '#D4C5AE', '#F0EBE0']

export function unsplash(id: string, w = 240): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`
}

// ---- Map a room name → glyph key in NP_GLYPHS (used by creating screen) ----
export function npRoomGlyph(name: string): keyof typeof NP_GLYPHS {
  const n = (name || '').toLowerCase()
  if (n.includes('kitchen')) return 'kitchen'
  if (n.includes('bath') && !n.includes('powder')) return 'bath'
  if (n.includes('powder')) return 'powder'
  if (n.includes('bed') || n.includes('suite')) return 'bedroom'
  if (n.includes('living') || n.includes('lounge') || n.includes('great')) return 'living'
  if (n.includes('dining')) return 'dining'
  if (n.includes('office') || n.includes('study')) return 'office'
  if (n.includes('laundry')) return 'laundry'
  if (n.includes('foyer') || n.includes('entry')) return 'foyer'
  if (n.includes('mud')) return 'mudroom'
  if (n.includes('outdoor') || n.includes('patio') || n.includes('deck')) return 'outdoor'
  return 'generic'
}

// ---- Line-art glyph paths (multi-path per glyph) used by creating screen ----
export const NP_GLYPHS = {
  // Rooms
  kitchen:  ['M3 20h18M5 20V9h14v11M5 9V5h14v4', 'M9 13h2M13 13h2', 'M8 16h8'],
  bath:     ['M4 12h16v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4z', 'M6 12V7a2 2 0 0 1 4 0', 'M9 7h2', 'M5 19l-1 2M19 19l1 2'],
  bedroom:  ['M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6', 'M3 18v3M21 18v3', 'M3 14h18', 'M7 10V7a1 1 0 0 1 1-1h3v4'],
  living:   ['M4 16v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3', 'M3 16h18v3H3z', 'M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4'],
  dining:   ['M5 18l-1-9h16l-1 9z', 'M5 12h14', 'M8 18v3M16 18v3'],
  office:   ['M3 17h18', 'M5 17V8h14v9', 'M9 11h6', 'M9 14h4'],
  laundry:  ['M5 4h14v16H5z', 'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M8 7h.01M11 7h.01'],
  powder:   ['M12 4v16M6 8h12M8 12h8M9 16h6'],
  foyer:    ['M5 20V8l7-4 7 4v12', 'M9 20v-6h6v6'],
  mudroom:  ['M4 18h16', 'M6 18V8h12v10', 'M9 8V5h6v3', 'M10 14h4'],
  outdoor:  ['M12 3v18', 'M5 21l7-7 7 7', 'M5 12c0-4 3-7 7-7s7 3 7 7'],
  generic:  ['M4 20V8l8-5 8 5v12z', 'M9 20v-6h6v6'],
  // Categories
  faucet:   ['M8 4h2v6h6V8h2v3a3 3 0 0 1-3 3h-2v3', 'M11 17h4', 'M11 17v3M15 17v3'],
  sink:     ['M3 12h18', 'M5 12v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4', 'M12 4v8', 'M10 6h4'],
  toilet:   ['M6 14h12l-1 5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z', 'M5 4h14v8H5z', 'M9 12v2'],
  shower:   ['M12 3v6', 'M6 9h12l-2 4H8z', 'M9 16l-1 4M12 16v4M15 16l1 4'],
  pendant:  ['M12 3v4', 'M7 7h10l-2 6H9z', 'M12 13v6', 'M10 19h4'],
  sconce:   ['M4 6h6v3l-3 7-3-7z', 'M10 9h6', 'M16 6v6'],
  chandelier:['M12 3v3', 'M6 6h12', 'M8 6l-2 6M16 6l2 6M12 6v8', 'M5 12h3M10 12h4M16 12h3', 'M6 16v2M12 16v2M18 16v2'],
  bulb:     ['M9 18h6', 'M10 21h4', 'M8 13a4 4 0 1 1 8 0c0 2-1 3-1 5H9c0-2-1-3-1-5z'],
  tile:     ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  trowel:   ['M14 3l7 7-9 4-2-2z', 'M11 14l-7 7'],
  knob:     ['M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 14v6', 'M9 20h6'],
  hinge:    ['M5 4v16', 'M19 4v16', 'M5 8h14M5 14h14', 'M9 11h6'],
  fridge:   ['M6 3h12v18H6z', 'M6 11h12', 'M9 6v3M9 14v4'],
  range:    ['M4 8h16v12H4z', 'M8 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M16 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M4 8V5h16v3'],
  paintCan: ['M6 7h12v13H6z', 'M6 7c0-2 3-3 6-3s6 1 6 3', 'M14 4l3-2'],
  brush:    ['M14 3l7 7-7 4-4-4z', 'M10 14l-6 6', 'M4 20l3 1'],
  door:     ['M6 21V4h12v17', 'M14 12h.5'],
  window:   ['M4 4h16v16H4z', 'M12 4v16M4 12h16'],
  trim:     ['M3 6h18M3 18h18M5 6v12M19 6v12', 'M9 8h6M9 16h6'],
  sofa:     ['M3 16v-3a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3', 'M2 16h20v3H2z', 'M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4'],
  rug:      ['M4 7h16l-2 13H6z', 'M7 11h10M7 14h10M7 17h10'],
  art:      ['M4 4h16v16H4z', 'M8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M4 20l5-6 4 4 3-3 4 5'],
  curtain:  ['M3 4h18', 'M5 4v16M9 4c0 5-1 11 0 16M15 4c1 5 0 11 0 16M19 4v16'],
  bed:      ['M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6', 'M3 18v3M21 18v3', 'M3 14h18', 'M7 10V7a1 1 0 0 1 1-1h3v4'],
  signage:  ['M4 5h16v6H4z', 'M12 11v8', 'M9 19h6', 'M7 8h10'],
  desk:     ['M3 17h18', 'M5 17V9h14v8', 'M9 13h6', 'M5 17l-1 4M19 17l1 4'],
  swatch:   ['M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z'],
} as const

// Category → which 4 product image specs fly into the bucket (4 slots in a
// 2×2 grid). Each spec is `{ id, hex }` matching an ItemImage variant. The
// hex tunes the dominant finish so multiple slots can reuse the same SVG.
export interface ProductSpec { id: string; hex: string }
export const NP_CAT_PRODUCTS: Record<string, ReadonlyArray<ProductSpec>> = {
  'Plumbing':         [{ id: 'plumb-1', hex: '#B88550' }, { id: 'plumb-3', hex: '#A8A29A' }, { id: 'plumb-6', hex: '#1A1814' }, { id: 'plumb-2', hex: '#C8C6C4' }],
  'Lighting':         [{ id: 'light-3', hex: '#C9A464' }, { id: 'light-1', hex: '#1A1814' }, { id: 'light-2', hex: '#B88550' }, { id: 'light-4', hex: '#3F352B' }],
  'Tile':             [{ id: 'tile-1', hex: '#E8DFCE' }, { id: 'tile-2', hex: '#A89884' }, { id: 'tile-3', hex: '#3F352B' }, { id: 'tile-4', hex: '#E8E4DC' }],
  'Tile & stone':     [{ id: 'tile-4', hex: '#E8E4DC' }, { id: 'tile-1', hex: '#C7B8A1' }, { id: 'tile-2', hex: '#8C7A63' }, { id: 'tile-3', hex: '#3F352B' }],
  'Hardware':         [{ id: 'hw-1', hex: '#1A1814' }, { id: 'hw-2', hex: '#B88550' }, { id: 'hw-4', hex: '#C9A464' }, { id: 'hw-3', hex: '#A8A29A' }],
  'Appliances':       [{ id: 'app-2', hex: '#C8C6C4' }, { id: 'app-1', hex: '#1A1814' }, { id: 'app-4', hex: '#C9A464' }, { id: 'app-3', hex: '#A8A29A' }],
  'Cabinetry':        [{ id: 'cab-1', hex: '#8C7A63' }, { id: 'cab-1', hex: '#3F352B' }, { id: 'hw-2', hex: '#B88550' }, { id: 'cab-1', hex: '#A89884' }],
  'Paint':            [{ id: 'paint-1', hex: '#3F352B' }, { id: 'paint-2', hex: '#A89884' }, { id: 'paint-3', hex: '#C06B3E' }, { id: 'paint-4', hex: '#E8DFCE' }],
  'Doors & windows':  [{ id: 'cab-1', hex: '#3F352B' }, { id: 'cab-1', hex: '#8C7A63' }, { id: 'cab-1', hex: '#1A1814' }, { id: 'cab-1', hex: '#A89884' }],
  'Trim':             [{ id: 'paint-1', hex: '#E8DFCE' }, { id: 'paint-2', hex: '#C7B8A1' }, { id: 'paint-1', hex: '#3F352B' }, { id: 'paint-4', hex: '#A89884' }],
  'Furniture':        [{ id: 'sofa-1', hex: '#A89884' }, { id: 'sofa-1', hex: '#3F352B' }, { id: 'cab-1', hex: '#8C7A63' }, { id: 'lamp-1', hex: '#C9A464' }],
  'Rugs':             [{ id: 'rug-1', hex: '#C06B3E' }, { id: 'rug-1', hex: '#8C7A63' }, { id: 'rug-1', hex: '#3F352B' }, { id: 'rug-1', hex: '#A89884' }],
  'Art & accessories':[{ id: 'art-1', hex: '#1A1814' }, { id: 'art-1', hex: '#C9A464' }, { id: 'art-1', hex: '#A89884' }, { id: 'art-1', hex: '#3F352B' }],
  'Window treatments':[{ id: 'paint-2', hex: '#E8DFCE' }, { id: 'paint-4', hex: '#C7B8A1' }, { id: 'paint-2', hex: '#A89884' }, { id: 'paint-4', hex: '#3F352B' }],
  'Bedding':          [{ id: 'paint-2', hex: '#E8DFCE' }, { id: 'paint-4', hex: '#A89884' }, { id: 'paint-2', hex: '#C7B8A1' }, { id: 'paint-4', hex: '#8C7A63' }],
  'FFE':              [{ id: 'sofa-1', hex: '#A89884' }, { id: 'cab-1', hex: '#8C7A63' }, { id: 'art-1', hex: '#1A1814' }, { id: 'lamp-1', hex: '#C9A464' }],
  'Finishes':         [{ id: 'tile-1', hex: '#E8DFCE' }, { id: 'paint-1', hex: '#3F352B' }, { id: 'tile-4', hex: '#A89884' }, { id: 'paint-3', hex: '#C06B3E' }],
  'Signage':          [{ id: 'paint-1', hex: '#1A1814' }, { id: 'paint-1', hex: '#C06B3E' }, { id: 'paint-1', hex: '#3F352B' }, { id: 'paint-1', hex: '#A89884' }],
  'Casegoods':        [{ id: 'cab-1', hex: '#8C7A63' }, { id: 'cab-1', hex: '#3F352B' }, { id: 'cab-1', hex: '#A89884' }, { id: 'hw-2', hex: '#B88550' }],
}

// Category → which 4 glyphs to fly into the bucket (4 slots in a 2×2 grid).
export const NP_CAT_GLYPHS: Record<string, ReadonlyArray<keyof typeof NP_GLYPHS>> = {
  'Plumbing':         ['faucet', 'sink', 'shower', 'toilet'],
  'Lighting':         ['pendant', 'sconce', 'chandelier', 'bulb'],
  'Tile':             ['tile', 'trowel', 'tile', 'tile'],
  'Tile & stone':     ['tile', 'trowel', 'tile', 'tile'],
  'Hardware':         ['knob', 'hinge', 'knob', 'hinge'],
  'Appliances':       ['fridge', 'range', 'fridge', 'range'],
  'Cabinetry':        ['door', 'knob', 'hinge', 'door'],
  'Paint':            ['paintCan', 'brush', 'swatch', 'paintCan'],
  'Doors & windows':  ['door', 'window', 'door', 'window'],
  'Trim':             ['trim', 'brush', 'trim', 'trim'],
  'Furniture':        ['sofa', 'bed', 'desk', 'sofa'],
  'Rugs':             ['rug', 'rug', 'rug', 'rug'],
  'Art & accessories':['art', 'art', 'swatch', 'art'],
  'Window treatments':['curtain', 'curtain', 'window', 'curtain'],
  'Bedding':          ['bed', 'bed', 'bed', 'bed'],
  'FFE':              ['sofa', 'desk', 'art', 'bed'],
  'Finishes':         ['tile', 'swatch', 'paintCan', 'brush'],
  'Signage':          ['signage', 'signage', 'signage', 'signage'],
  'Casegoods':        ['desk', 'door', 'door', 'desk'],
}

// Unsplash thumbs used by the staging/commercial scenes (not the residential
// scene — that uses line-art glyphs only).
export const NP_SAMPLES: Record<string, readonly string[]> = {
  'Plumbing':         ['photo-1584622650111-993a426fbf0a', 'photo-1620626011761-996317b8d101', 'photo-1565538810643-b5bdb714032a', 'photo-1556909114-f6e7ad7d3136'],
  'Lighting':         ['photo-1513506003901-1e6a229e2d15', 'photo-1524634126442-357e0eac3c14', 'photo-1517991104123-1d56a6e81ed9', 'photo-1565814329452-e1efa11c5b89'],
  'Tile':             ['photo-1556228720-195a672e8a03', 'photo-1615875605825-5eb9bb5d52ac', 'photo-1600607687939-ce8a6c25118c', 'photo-1595428774223-ef52624120d2'],
  'Tile & stone':     ['photo-1556228720-195a672e8a03', 'photo-1615875605825-5eb9bb5d52ac', 'photo-1600607687939-ce8a6c25118c', 'photo-1595428774223-ef52624120d2'],
  'Hardware':         ['photo-1581858726788-75bc0f6a952d', 'photo-1600566753190-17f0baa2a6c3', 'photo-1581782700893-3e9b0ff42e7e', 'photo-1556910103-1c02745aae4d'],
  'Appliances':       ['photo-1556909114-f6e7ad7d3136', 'photo-1556910103-1c02745aae4d', 'photo-1556228852-80b6e5eeff06', 'photo-1574269909862-7e1d70bb8078'],
  'Cabinetry':        ['photo-1556909114-f6e7ad7d3136', 'photo-1600566753190-17f0baa2a6c3', 'photo-1556228720-195a672e8a03', 'photo-1600585154340-be6161a56a0c'],
  'Paint':            ['photo-1562259929-b4e1fd3aef09', 'photo-1620626011761-996317b8d101', 'photo-1615874959474-d609969a20ed', 'photo-1595514535215-9a5e0e8e5f5d'],
  'Doors & windows':  ['photo-1600607687644-aac76f0e23ec', 'photo-1600585154526-990dced4db0d', 'photo-1600585152915-d208bec867a1', 'photo-1583847268964-b28dc8f51f92'],
  'Trim':             ['photo-1600585154340-be6161a56a0c', 'photo-1600210492486-724fe5c67fb0', 'photo-1600566753190-17f0baa2a6c3', 'photo-1556228720-195a672e8a03'],
  'Furniture':        ['photo-1555041469-a586c61ea9bc', 'photo-1567538096630-e0c55bd6374c', 'photo-1493663284031-b7e3aefcae8e', 'photo-1540574163026-643ea20ade25'],
  'Rugs':             ['photo-1600166898405-da9535204843', 'photo-1531501410720-c8d437636169', 'photo-1493663284031-b7e3aefcae8e', 'photo-1567538096630-e0c55bd6374c'],
  'Art & accessories':['photo-1513519245088-0e12902e5a38', 'photo-1545558014-8692077e9b5c', 'photo-1554995207-c18c203602cb', 'photo-1604014237800-1c9102c219da'],
  'Window treatments':['photo-1600210492486-724fe5c67fb0', 'photo-1600585154340-be6161a56a0c', 'photo-1582719478250-c89cae4dc85b', 'photo-1616486338812-3dadae4b4ace'],
  'Bedding':          ['photo-1631679706909-1844bbd07221', 'photo-1505693416388-ac5ce068fe85', 'photo-1540518614846-7eded433c457', 'photo-1522771739844-6a9f6d5f14af'],
  'FFE':              ['photo-1555041469-a586c61ea9bc', 'photo-1567538096630-e0c55bd6374c', 'photo-1493663284031-b7e3aefcae8e', 'photo-1540574163026-643ea20ade25'],
  'Finishes':         ['photo-1556228720-195a672e8a03', 'photo-1615875605825-5eb9bb5d52ac', 'photo-1562259929-b4e1fd3aef09', 'photo-1600607687939-ce8a6c25118c'],
  'Signage':          ['photo-1545194445-dddb8f4487c6', 'photo-1542744095-291d1f67b221', 'photo-1551434678-e076c223a692', 'photo-1560472354-b33ff0c44a43'],
  'Casegoods':        ['photo-1555041469-a586c61ea9bc', 'photo-1567538096630-e0c55bd6374c', 'photo-1493663284031-b7e3aefcae8e', 'photo-1540574163026-643ea20ade25'],
}

export const NP_FALLBACK_THUMBS: readonly string[] = [
  'photo-1556228720-195a672e8a03',
  'photo-1555041469-a586c61ea9bc',
  'photo-1513519245088-0e12902e5a38',
  'photo-1531501410720-c8d437636169',
]

export function npSamplesFor(group: string): readonly string[] {
  return NP_SAMPLES[group] ?? NP_FALLBACK_THUMBS
}

// Real Unsplash interior shots — saved board collage (warm, on-palette).
export const PINTEREST_BOARD_THUMBS: readonly string[] = [
  unsplash('photo-1616594039964-ae9021a400a0'),
  unsplash('photo-1600210492486-724fe5c67fb0'),
  unsplash('photo-1618220179428-22790b461013'),
  unsplash('photo-1631679706909-1844bbd07221'),
  unsplash('photo-1493663284031-b7e3aefcae8e'),
  unsplash('photo-1600585154340-be6161a56a0c'),
  unsplash('photo-1586023492125-27b2c045efd7'),
  unsplash('photo-1600121848594-d8644e57abab'),
  unsplash('photo-1615873968403-89e068629265'),
  unsplash('photo-1556909114-f6e7ad7d3136'),
  unsplash('photo-1567016432779-094069958ea5'),
  unsplash('photo-1505691938895-1758d7feb511'),
]
