import { Button, Pill } from '@speclyy/design-system'
import { Plus } from '@speclyy/design-system/icons'
import Link from 'next/link'

const projects = [
  { id: 'atherton',      name: 'Atherton Residence', location: 'Atherton, CA',    studio: 'Henley & Co.', groups: 8,  items: 147, tbd: 12, status: 'Active' as const },
  { id: 'laurel-canyon', name: 'Laurel Canyon',      location: 'Los Angeles, CA', studio: 'Private',      groups: 12, items: 284, tbd: 0,  status: 'Final' as const },
]

export default function ProjectsPage() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="eyebrow mb-3">Workspace</p>
          <h1 className="h1">Projects</h1>
        </div>
        <Button variant="primary"><Plus size={16} /> New project</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {projects.map(p => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card card-hover block">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-display text-24 leading-[1.2] text-ink-900">{p.name}</h4>
                <div className="caption mt-1">{p.location} · {p.studio}</div>
              </div>
              <Pill tone={p.status === 'Final' ? 'complete' : 'neutral'} dot={p.status === 'Final'}>
                {p.status}
              </Pill>
            </div>
            <div className="flex gap-6 mt-6 pt-4 border-t border-[color:var(--border-1)]">
              <Stat n={p.groups} label="Groups" />
              <Stat n={p.items} label="Items" />
              <Stat n={p.tbd}   label="TBD" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-28 font-medium leading-none text-ink-900">{n}</span>
      <span className="eyebrow mt-1">{label}</span>
    </div>
  )
}
