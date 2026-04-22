import { Button, Pill } from '@speclyy/design-system'
import { Plus } from '@speclyy/design-system/icons'
import Link from 'next/link'

const groups = [
  { id: 'plumbing',  name: 'Plumbing fixtures',          sub: 'Kitchen + baths',                count: 24, complete: 22, tbd: 2,  missing: 0 },
  { id: 'ensuite',   name: 'Level 2 — Primary ensuite',  sub: 'Tile, lighting, hardware',        count: 18, complete: 12, tbd: 0,  missing: 6 },
  { id: 'paint',     name: 'Paint schedule',             sub: 'Sherwin-Williams + Benjamin Moore', count: 9,  complete: 9,  tbd: 0,  missing: 0 },
]

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params

  return (
    <div>
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="eyebrow mb-3">Project · {projectId}</p>
          <h1 className="h1">Atherton <span className="italic-serif">Residence</span></h1>
          <p className="caption mt-2">Atherton, CA · Henley &amp; Co.</p>
        </div>
        <Button variant="primary"><Plus size={16} /> Add group</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {groups.map(g => (
          <Link key={g.id} href={`/projects/${projectId}/groups/${g.id}`} className="card card-hover block" style={{ padding: 20 }}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h4 className="font-display text-20 leading-[1.25]">{g.name}</h4>
                <div className="caption mt-0.5">{g.sub}</div>
              </div>
              <div className="font-display text-40 leading-none text-ink-900 font-normal">{g.count}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {g.complete > 0 && <Pill tone="complete">{g.complete} complete</Pill>}
              {g.tbd > 0     && <Pill tone="tbd">{g.tbd} TBD</Pill>}
              {g.missing > 0 && <Pill tone="missing">{g.missing} missing</Pill>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
