export type ProjectTypeKey = 'new-build' | 'reno' | 'commercial' | 'staging'
export type ProjectStatusKind = 'neutral' | 'complete'

export interface DemoProject {
  id: string
  name: string
  type: string
  typeKey: ProjectTypeKey
  location: string
  client: string
  market: string
  phase: string
  status: string
  statusKind: ProjectStatusKind
  progress: number
  groups: number
  items: number
  updated: string
  palette: readonly [string, string, string, string]
  accent: string
}
