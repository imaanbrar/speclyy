import { Button, Pill } from '@speclyy/design-system'
import { MoreHorizontal, Plus } from '@speclyy/design-system/icons'

const items = [
  { name: 'Billet wall-mount widespread', brand: 'Kohler', collection: 'Billet',  sku: 'K-T14094-CZ', finish: 'Champagne Bronze',  status: 'complete' as const },
  { name: 'Ashlyn two-handle lavatory',   brand: 'Delta',  collection: 'Ashlyn',  sku: 'T14094-I',    finish: 'Polished Nickel',   status: 'tbd' as const },
  { name: 'Litze shower trim',            brand: 'Brizo',  collection: 'Litze',   sku: '—',           finish: 'Missing finish',     status: 'missing' as const },
]

export default async function GroupPage({ params }: { params: Promise<{ projectId: string; groupId: string }> }) {
  const { groupId } = await params

  return (
    <div>
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="eyebrow mb-3">Group · {groupId}</p>
          <h1 className="h1">Primary <span className="italic-serif">ensuite</span></h1>
        </div>
        <Button variant="primary"><Plus size={16} /> Add item</Button>
      </div>

      <div className="bg-surface border border-[color:var(--border-1)] rounded-lg overflow-hidden">
        {items.map((it, i) => (
          <div
            key={i}
            className="grid gap-5 items-center px-5 py-4 border-b border-[color:var(--border-1)] last:border-0 hover:bg-paper-50 transition-colors"
            style={{ gridTemplateColumns: '72px 1fr 140px 160px 100px 40px' }}
          >
            <div className="w-[72px] h-[72px] rounded-sm bg-subtle" />
            <div>
              <p className="text-14 font-semibold text-ink-900">{it.name}</p>
              <div className="caption mt-0.5">{it.brand} · {it.collection} collection</div>
            </div>
            <span className="mono">{it.sku}</span>
            <span className={`caption ${it.status === 'missing' ? 'text-[color:var(--status-missing)]' : ''}`}>{it.finish}</span>
            <Pill tone={it.status}>
              {it.status === 'complete' ? 'Complete' : it.status === 'tbd' ? 'TBD' : 'Missing'}
            </Pill>
            <button aria-label="More" className="text-ink-500 hover:text-ink-900 transition-colors flex items-center justify-center">
              <MoreHorizontal size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
