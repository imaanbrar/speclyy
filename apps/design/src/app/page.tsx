import {
  AppNav, Avatar, Button, ButtonLink, Card, Field, Input, Logo,
  Pill, Select, Textarea, Toast,
} from '@speclyy/design-system'
import {
  ArrowRight, Check, ChevronDown, ChevronRight, Download, FileText,
  Folder, Link as LinkIcon, LogOut, MoreHorizontal, Plus, Search,
  Sparkle, X,
} from '@speclyy/design-system/icons'

const TOC = [
  { group: 'Foundations', items: [
    { id: 'logo',       label: 'Logo' },
    { id: 'color',      label: 'Color' },
    { id: 'typography', label: 'Typography' },
    { id: 'radii',      label: 'Radii' },
    { id: 'shadows',    label: 'Shadows' },
    { id: 'spacing',    label: 'Spacing' },
    { id: 'motion',     label: 'Motion' },
    { id: 'iconography',label: 'Iconography' },
  ]},
  { group: 'Primitives', items: [
    { id: 'buttons',  label: 'Buttons' },
    { id: 'pills',    label: 'Status pills' },
    { id: 'fields',   label: 'Form fields' },
    { id: 'cards',    label: 'Cards' },
    { id: 'avatar',   label: 'Avatar' },
    { id: 'toast',    label: 'Toast' },
    { id: 'appnav',   label: 'App nav' },
  ]},
  { group: 'Patterns', items: [
    { id: 'project-card', label: 'Project card' },
    { id: 'group-card',   label: 'Group card' },
    { id: 'item-row',     label: 'Item row' },
    { id: 'search-result',label: 'Library search' },
    { id: 'modal',        label: 'Modal' },
    { id: 'hero',         label: 'Marketing hero' },
    { id: 'dark-cta',     label: 'Dark CTA' },
    { id: 'pricing',      label: 'Pricing card' },
  ]},
]

export default function Page() {
  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: 'minmax(220px, 260px) 1fr' }}>
      <aside
        className="border-r border-[color:var(--border-1)] bg-subtle px-6 py-10 sticky top-0 h-screen overflow-y-auto"
      >
        <Logo href="#" />
        <p className="caption mt-2">Design system v0.1</p>

        <nav className="mt-10 flex flex-col gap-8">
          {TOC.map(section => (
            <div key={section.group}>
              <p className="eyebrow mb-3">{section.group}</p>
              <ul className="flex flex-col gap-1.5">
                {section.items.map(item => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="link-quiet body-sm block py-0.5">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <p className="caption mt-12">
          Tokens live in <span className="mono">@speclyy/design-system</span>. Components follow
          the editorial, warm-stone direction — one accent at a time.
        </p>
      </aside>

      <main className="px-12 py-16 max-w-[1100px]">
        <header className="pb-10 mb-14 border-b border-[color:var(--border-2)]">
          <p className="eyebrow mb-4">Design system</p>
          <h1 className="display-2">
            Speclyy <span className="italic-serif text-accent">components.</span>
          </h1>
          <p className="body-lg mt-6 max-w-2xl">
            Every token, primitive, and pattern used across the marketing site and the workspace. Reference semantic tokens (<span className="mono">--bg-app</span>, <span className="mono">--fg-1</span>, <span className="mono">--accent</span>) — not raw palette hexes.
          </p>
        </header>

        <FoundationsLogo />
        <FoundationsColor />
        <FoundationsTypography />
        <FoundationsRadii />
        <FoundationsShadows />
        <FoundationsSpacing />
        <FoundationsMotion />
        <FoundationsIconography />

        <Divider label="Primitives" />

        <PrimitiveButtons />
        <PrimitivePills />
        <PrimitiveFields />
        <PrimitiveCards />
        <PrimitiveAvatar />
        <PrimitiveToast />
        <PrimitiveAppNav />

        <Divider label="Patterns" />

        <PatternProjectCard />
        <PatternGroupCard />
        <PatternItemRow />
        <PatternSearchResult />
        <PatternModal />
        <PatternHero />
        <PatternDarkCTA />
        <PatternPricing />

        <footer className="mt-24 pt-8 border-t border-[color:var(--border-1)] caption">
          © Speclyy ✦ — patterns designed for high-end residential work.
        </footer>
      </main>
    </div>
  )
}

/* ============================================================ shared */

function Section({
  id, title, note, lede, children,
}: {
  id: string
  title: React.ReactNode
  note?: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-10">
      <div className="sec-head">
        <h2 className="h3">{title}</h2>
        {note && <span className="note">{note}</span>}
      </div>
      {lede && <p className="body-lg max-w-2xl mb-8" style={{ color: 'var(--fg-2)' }}>{lede}</p>}
      {children}
    </section>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-16">
      <p className="eyebrow">{label}</p>
      <div className="flex-1 h-px bg-[color:var(--border-2)]" />
    </div>
  )
}

function Swatch({ name, hex, varName, fg }: { name: string; hex: string; varName: string; fg?: string }) {
  return (
    <div className="swatch">
      <div className="chip" style={{ background: hex, color: fg ?? 'transparent' }} />
      <div className="meta">
        <span className="name">{name}</span>
        <span className="hex">{hex}</span>
      </div>
      <span className="mono" style={{ fontSize: 10 }}>{varName}</span>
    </div>
  )
}

/* ============================================================ foundations */

function FoundationsLogo() {
  return (
    <Section id="logo" title="Logo" note="Wordmark — Fraunces, italic spec, upright lyy, sparkle">
      <div className="spec-grid cols-2">
        <div className="stage flex items-center justify-center" style={{ minHeight: 180 }}>
          <span style={{ fontSize: 32 }}><Logo /></span>
        </div>
        <div className="stage dark flex items-center justify-center" style={{ minHeight: 180 }}>
          <span style={{ fontSize: 32 }}><Logo tone="dark" /></span>
        </div>
      </div>
      <div className="mt-6 grid gap-2 body-sm">
        <div><span className="eyebrow mr-2">Clear space</span> at least one cap-height of the wordmark on every side.</div>
        <div><span className="eyebrow mr-2">Min size</span> 14px for the wordmark · 12px if you drop the sparkle.</div>
        <div><span className="eyebrow mr-2">Don't</span> recolor the sparkle outside terracotta, skew, drop-shadow, or pair with other logos inline.</div>
      </div>
    </Section>
  )
}

function FoundationsColor() {
  const paper = [
    { name: 'paper-00',  hex: '#FFFFFF', varName: '--paper-00' },
    { name: 'paper-50',  hex: '#FAF7F2', varName: '--paper-50 · bone' },
    { name: 'paper-100', hex: '#F3EEE6', varName: '--paper-100 · linen' },
    { name: 'paper-200', hex: '#E8E1D5', varName: '--paper-200 · oat' },
    { name: 'paper-300', hex: '#D6CDBD', varName: '--paper-300 · flax' },
  ]
  const ink = [
    { name: 'ink-900', hex: '#1A1814', varName: '--ink-900 · bark' },
    { name: 'ink-800', hex: '#2A2620', varName: '--ink-800' },
    { name: 'ink-700', hex: '#45403A', varName: '--ink-700 · basalt' },
    { name: 'ink-600', hex: '#6B6558', varName: '--ink-600' },
    { name: 'ink-500', hex: '#928B7C', varName: '--ink-500 · stone' },
    { name: 'ink-400', hex: '#B3AC9E', varName: '--ink-400 · dune' },
    { name: 'ink-300', hex: '#CFC8BB', varName: '--ink-300' },
  ]
  const terra = [
    { name: 'terracotta-50',  hex: '#FBF1EB', varName: '--terracotta-50' },
    { name: 'terracotta-100', hex: '#F5DDCC', varName: '--terracotta-100' },
    { name: 'terracotta-300', hex: '#E5A684', varName: '--terracotta-300' },
    { name: 'terracotta-500', hex: '#C06B3E', varName: '--terracotta-500 · accent' },
    { name: 'terracotta-600', hex: '#A3552B', varName: '--terracotta-600 · hover' },
    { name: 'terracotta-700', hex: '#7E4020', varName: '--terracotta-700 · pressed' },
  ]
  const sage = [
    { name: 'sage-50',  hex: '#EFF2EC', varName: '--sage-50' },
    { name: 'sage-300', hex: '#B4C1A4', varName: '--sage-300' },
    { name: 'sage-500', hex: '#6E8A5C', varName: '--sage-500 · complete' },
    { name: 'sage-700', hex: '#4A6340', varName: '--sage-700' },
  ]
  const status = [
    { name: 'complete', hex: '#6E8A5C', varName: '--status-complete' },
    { name: 'TBD',      hex: '#C69650', varName: '--status-tbd' },
    { name: 'missing',  hex: '#B85C4E', varName: '--status-missing' },
  ]

  return (
    <Section id="color" title="Color" note="Warm stone — no blues, no cool grays, one accent">
      <p className="eyebrow mb-3">Paper · surfaces</p>
      <div className="spec-grid cols-6 mb-10">{paper.map(s => <Swatch key={s.name} {...s} />)}</div>

      <p className="eyebrow mb-3">Ink · foreground</p>
      <div className="spec-grid cols-6 mb-10">{ink.map(s => <Swatch key={s.name} {...s} />)}</div>

      <p className="eyebrow mb-3">Terracotta · accent</p>
      <div className="spec-grid cols-6 mb-10">{terra.map(s => <Swatch key={s.name} {...s} />)}</div>

      <p className="eyebrow mb-3">Sage · complete only</p>
      <div className="spec-grid cols-4 mb-10">{sage.map(s => <Swatch key={s.name} {...s} />)}</div>

      <p className="eyebrow mb-3">Status</p>
      <div className="spec-grid cols-3">{status.map(s => <Swatch key={s.name} {...s} />)}</div>
    </Section>
  )
}

function FoundationsTypography() {
  // Sample copy + specs mirror the canonical typography.html in the design bundle —
  // "Typography that earns its whitespace." Every line is a sentence we'd actually
  // ship in product (SKUs, room names, builder-facing micro-copy).
  const examples: { cls: string; label: string; node: React.ReactNode }[] = [
    { cls: 'display-1',    label: 'Fraunces · 96 / 1.05 / -0.03em',
      node: 'Champagne Bronze.' },
    { cls: 'display-2',    label: 'Fraunces · 80 / 1.05',
      node: <>Spec <span className="italic-serif">everything</span>.</> },
    { cls: 'h1',           label: 'Fraunces · 48 / 1.2',
      node: 'Primary ensuite, level 2' },
    { cls: 'h2',           label: 'Fraunces · 32 / 1.2',
      node: 'Plumbing fixtures' },
    { cls: 'h3',           label: 'Fraunces · 24 / 1.2',
      node: 'Kohler Billet wall-mount widespread' },
    { cls: 'h4',           label: 'Inter Tight 600 · 18 / 1.2',
      node: 'Add to project' },
    { cls: 'body-lg',      label: 'Inter Tight · 18 / 1.6',
      node: 'Paste a product URL. Speclyy fetches brand, finish, SKU and dimensions, then drops them into a structured field set you can edit.' },
    { cls: 'body',         label: 'Inter Tight · 15 / 1.45',
      node: 'Designers spend too much time on product hunting and formatting. Speclyy keeps the data structured — brand, collection, product, finish, SKU — so the spec sheet builds itself.' },
    { cls: 'body-sm',      label: 'Inter Tight · 14 / 1.45',
      node: 'Leave a field blank to flag it as TBD — exports still work; it’ll print as an em-dash.' },
    { cls: 'caption',      label: 'Inter Tight · 13 / 1.45',
      node: 'Updated 2 hours ago · 14 items · 3 TBD' },
    { cls: 'eyebrow',      label: 'Inter Tight 600 · 12 / 0.12em',
      node: 'How it works' },
    { cls: 'mono',         label: 'JetBrains Mono · 13',
      node: 'SKU · T14094-CZ · 8″ widespread · 2.2 gpm' },
    { cls: 'italic-serif', label: 'Fraunces italic · WONK',
      node: <span className="display-2"><span className="italic-serif">the way you actually work.</span></span> },
  ]
  return (
    <Section
      id="typography"
      title={<>Typography <span className="italic-serif text-accent">that earns its whitespace.</span></>}
      note="Fraunces (display) · Inter Tight (body) · JetBrains Mono (codes)"
      lede="Fraunces for display — serif, optical-sized, a little wonky. Inter Tight for body and UI. JetBrains Mono for SKUs, dimensions, and anything the builder will type back."
    >
      <div className="flex flex-col">
        {examples.map(e => (
          <div
            key={e.cls}
            className="grid gap-12 items-baseline py-7 border-b border-[color:var(--border-1)] last:border-0"
            style={{ gridTemplateColumns: '220px 1fr' }}
          >
            <div className="flex flex-col gap-1">
              <span className="mono uppercase tracking-wider" style={{ fontSize: 12, color: 'var(--fg-1)' }}>.{e.cls}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{e.label}</span>
            </div>
            <span className={e.cls}>{e.node}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FoundationsRadii() {
  const radii = [
    { name: 'xs · 4px',   v: 'var(--radius-xs)' },
    { name: 'sm · 6px',   v: 'var(--radius-sm)' },
    { name: 'md · 10px',  v: 'var(--radius-md)' },
    { name: 'lg · 16px',  v: 'var(--radius-lg)' },
    { name: 'xl · 24px',  v: 'var(--radius-xl)' },
    { name: 'pill · 999', v: 'var(--radius-pill)' },
  ]
  return (
    <Section id="radii" title="Radii" note="Generous, never aggressive. Pills for buttons only.">
      <div className="spec-grid cols-6">
        {radii.map(r => (
          <div key={r.name} className="flex flex-col items-center gap-3">
            <div style={{ width: 88, height: 88, background: 'var(--terracotta-100)', borderRadius: r.v, border: '1px solid var(--border-2)' }} />
            <span className="caption">{r.name}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FoundationsShadows() {
  const shadows = ['xs', 'sm', 'md', 'lg', 'xl'] as const
  return (
    <Section id="shadows" title="Shadows" note="Warm ink tint, not pure black">
      <div className="spec-grid cols-3">
        {shadows.map(s => (
          <div key={s} className="stage flex flex-col items-center gap-4" style={{ background: 'var(--bg-app)' }}>
            <div style={{ width: 120, height: 80, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', boxShadow: `var(--shadow-${s})` }} />
            <span className="caption">shadow-{s}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FoundationsSpacing() {
  const steps = [
    { n: 1, px: 4 }, { n: 2, px: 8 }, { n: 3, px: 12 }, { n: 4, px: 16 },
    { n: 5, px: 20 }, { n: 6, px: 24 }, { n: 8, px: 32 }, { n: 10, px: 40 },
    { n: 12, px: 48 }, { n: 16, px: 64 }, { n: 20, px: 80 }, { n: 24, px: 96 },
  ]
  return (
    <Section id="spacing" title="Spacing" note="4px baseline">
      <div className="flex flex-col gap-2">
        {steps.map(s => (
          <div key={s.n} className="flex items-center gap-4">
            <span className="mono" style={{ width: 80 }}>--space-{s.n}</span>
            <div style={{ width: s.px, height: 20, background: 'var(--terracotta-500)', borderRadius: 2 }} />
            <span className="caption">{s.px}px</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FoundationsMotion() {
  return (
    <Section id="motion" title="Motion" note="Default ease-out. Reserve ease-in-out for transforms.">
      <div className="spec-grid cols-3">
        {[
          { token: '--dur-fast', val: '120ms', use: 'hover states, focus rings' },
          { token: '--dur-base', val: '200ms', use: 'card hover, drawer enter/exit' },
          { token: '--dur-slow', val: '360ms', use: 'page transitions, hero reveals' },
        ].map(d => (
          <div key={d.token} className="card">
            <span className="mono text-ink-500">{d.token}</span>
            <div className="font-display text-32 mt-2">{d.val}</div>
            <p className="body-sm mt-2">{d.use}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FoundationsIconography() {
  const icons = [
    { name: 'Plus',      Icon: Plus },
    { name: 'Check',     Icon: Check },
    { name: 'X',         Icon: X },
    { name: 'ArrowRight',Icon: ArrowRight },
    { name: 'ChevronRight', Icon: ChevronRight },
    { name: 'ChevronDown',  Icon: ChevronDown },
    { name: 'Search',    Icon: Search },
    { name: 'MoreH',     Icon: MoreHorizontal },
    { name: 'Download',  Icon: Download },
    { name: 'Sparkle',   Icon: Sparkle },
    { name: 'Link',      Icon: LinkIcon },
    { name: 'FileText',  Icon: FileText },
    { name: 'Folder',    Icon: Folder },
    { name: 'LogOut',    Icon: LogOut },
  ]
  return (
    <Section id="iconography" title="Iconography" note="Lucide · stroke-width 1.5 · currentColor">
      <div className="stage">
        <div className="spec-grid cols-6">
          {icons.map(({ name, Icon }) => (
            <div key={name} className="flex flex-col items-center gap-2 py-4 bg-surface rounded-md border border-[color:var(--border-1)]">
              <Icon size={22} />
              <span className="caption">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="caption mt-4">Sizes: 16 (inline with text), 20 (workhorse — nav, rows), 24 (empty states). Never filled, gradient, or color-coded by category.</p>
    </Section>
  )
}

/* ============================================================ primitives */

function PrimitiveButtons() {
  return (
    <Section id="buttons" title="Buttons" note="Pill radius · sentence case · icon leads">
      <div className="stage">
        <p className="eyebrow mb-3">Variants</p>
        <div className="stage-row mb-6">
          <Button variant="primary"><Plus size={16} /> Add item</Button>
          <Button variant="dark">Save to project</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="text">View details <ArrowRight size={16} /></Button>
          <Button variant="danger">Remove</Button>
          <Button variant="icon" aria-label="More"><MoreHorizontal size={18} /></Button>
        </div>
        <p className="eyebrow mb-3">Sizes</p>
        <div className="stage-row mb-6">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
        <p className="eyebrow mb-3">States</p>
        <div className="stage-row">
          <Button variant="primary">Default</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="ghost" disabled>Disabled ghost</Button>
        </div>
      </div>

      <div className="stage dark mt-6">
        <p className="eyebrow mb-3" style={{ color: 'var(--terracotta-300)' }}>On dark surface</p>
        <div className="stage-row">
          <Button variant="primary">Start free trial</Button>
          <Button variant="ghost-inverse">See a sample PDF</Button>
        </div>
      </div>
    </Section>
  )
}

function PrimitivePills() {
  return (
    <Section id="pills" title="Status pills" note="Three states for every item, plus neutral + accent">
      <div className="stage stage-row">
        <Pill tone="complete">Complete</Pill>
        <Pill tone="tbd">TBD</Pill>
        <Pill tone="missing">Missing SKU</Pill>
        <Pill tone="neutral">Draft</Pill>
        <Pill tone="neutral">Plumbing</Pill>
        <Pill tone="accent">Featured</Pill>
      </div>
    </Section>
  )
}

function PrimitiveFields() {
  return (
    <Section id="fields" title="Form fields" note="The item form is the heart of the app">
      <div className="stage">
        <div className="spec-grid cols-2">
          <Field label="Product name">
            <Input defaultValue="Billet wall-mount widespread" />
          </Field>
          <Field label="Brand">
            <Input defaultValue="Kohler" />
          </Field>
          <Field label="Finish / Variant">
            <Select defaultValue="Champagne Bronze">
              <option>Champagne Bronze</option>
              <option>Vibrant Brushed Nickel</option>
              <option>Matte Black</option>
            </Select>
          </Field>
          <Field label="SKU / Model #" helper="Leave blank to flag as TBD.">
            <Input defaultValue="K-T14094-CZ" />
          </Field>
          <Field label="Product URL">
            <Input placeholder="https://…" />
          </Field>
          <Field label="Dimensions">
            <Input placeholder="W × H × D (in)" defaultValue="8 × 2.25 × 6.5" />
          </Field>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Notes">
              <Textarea defaultValue="Confirm with showroom that handle orientation matches rendering. Lead time 6–8 weeks." />
            </Field>
          </div>
          <Field label="Disabled" helper="Read-only until SKU is confirmed.">
            <Input defaultValue="Awaiting confirmation" disabled />
          </Field>
          <Field label="With error" error="SKU format unrecognized for this brand.">
            <Input defaultValue="K-T-?" />
          </Field>
        </div>
      </div>
    </Section>
  )
}

function PrimitiveCards() {
  return (
    <Section id="cards" title="Cards" note="Surfaces — default, hover, subtle">
      <div className="spec-grid cols-3">
        <Card>
          <p className="eyebrow mb-3">Default</p>
          <h4 className="h4 mb-1">Atherton Residence</h4>
          <p className="caption">Atherton, CA · Henley &amp; Co.</p>
        </Card>
        <Card hover>
          <p className="eyebrow mb-3">Hover</p>
          <h4 className="h4 mb-1">Laurel Canyon</h4>
          <p className="caption">Hover me — shadow + border deepen.</p>
        </Card>
        <Card subtle>
          <p className="eyebrow mb-3">Subtle</p>
          <h4 className="h4 mb-1">Linen surface</h4>
          <p className="caption">For nested sections on a white page.</p>
        </Card>
      </div>
    </Section>
  )
}

function PrimitiveAvatar() {
  return (
    <Section id="avatar" title="Avatar" note="Initials on terracotta — used in app nav">
      <div className="stage stage-row">
        <Avatar initials="IB" />
        <Avatar initials="RC" />
        <Avatar initials="HC" />
        <Avatar initials="JM" />
      </div>
    </Section>
  )
}

function PrimitiveToast() {
  return (
    <Section id="toast" title="Toast" note="Inverse surface for system feedback">
      <div className="stage flex justify-center">
        <Toast
          title="Item added to Primary ensuite"
          sub={<>Kohler Billet · flagged TBD · <span style={{ textDecoration: 'underline' }}>edit finish →</span></>}
        />
      </div>
    </Section>
  )
}

function PrimitiveAppNav() {
  return (
    <Section id="appnav" title="App nav" note="Single bar, breadcrumb-driven">
      <div className="stage">
        <AppNav
          crumbs={[
            { label: 'Atherton Residence', href: '#' },
            { label: 'Primary ensuite' },
          ]}
          right={
            <>
              <Button variant="ghost" size="sm"><Download size={16} /> Export</Button>
              <Button variant="primary" size="sm"><Plus size={16} /> Add item</Button>
              <Avatar initials="IB" />
            </>
          }
        />
      </div>
    </Section>
  )
}

/* ============================================================ patterns */

function PatternProjectCard() {
  return (
    <Section id="project-card" title="Project card" note="Dashboard · [3.1] Projects list">
      <div className="stage">
        <div className="spec-grid cols-2">
          <div className="card card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-display text-24 leading-[1.2]">Atherton Residence</h4>
                <div className="caption mt-1">Atherton, CA · Henley &amp; Co.</div>
              </div>
              <Pill tone="neutral">Active</Pill>
            </div>
            <div className="flex gap-6 mt-6 pt-4 border-t border-[color:var(--border-1)]">
              <Stat n={8} label="Groups" />
              <Stat n={147} label="Items" />
              <Stat n={12} label="TBD" />
            </div>
          </div>
          <div className="card card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-display text-24 leading-[1.2]">Laurel Canyon</h4>
                <div className="caption mt-1">Los Angeles, CA · Private</div>
              </div>
              <Pill tone="complete">Final</Pill>
            </div>
            <div className="flex gap-6 mt-6 pt-4 border-t border-[color:var(--border-1)]">
              <Stat n={12} label="Groups" />
              <Stat n={284} label="Items" />
              <Stat n={0} label="TBD" />
            </div>
          </div>
        </div>
      </div>
    </Section>
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

function PatternGroupCard() {
  return (
    <Section id="group-card" title="Group card" note="Project overview · [4.1]">
      <div className="stage">
        <div className="spec-grid cols-3">
          <GroupCard name="Plumbing fixtures" sub="Kitchen + baths" count={24} pills={[['complete', '22 complete'], ['tbd', '2 TBD']]} />
          <GroupCard name="Level 2 — Primary ensuite" sub="Tile, lighting, hardware" count={18} pills={[['complete', '12 complete'], ['missing', '6 missing']]} />
          <GroupCard name="Paint schedule" sub="Sherwin-Williams + Benjamin Moore" count={9} pills={[['complete', '9 complete']]} />
        </div>
      </div>
    </Section>
  )
}

function GroupCard({ name, sub, count, pills }: { name: string; sub: string; count: number; pills: [('complete' | 'tbd' | 'missing'), string][] }) {
  return (
    <div className="card card-hover" style={{ padding: 20 }}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h4 className="font-display text-20 leading-[1.25]">{name}</h4>
          <div className="caption mt-0.5">{sub}</div>
        </div>
        <div className="font-display text-40 leading-none text-ink-900 font-normal">{count}</div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {pills.map(([tone, text]) => <Pill key={text} tone={tone}>{text}</Pill>)}
      </div>
    </div>
  )
}

function PatternItemRow() {
  const items = [
    { name: 'Billet wall-mount widespread', brand: 'Kohler', collection: 'Billet', sku: 'K-T14094-CZ', finish: 'Champagne Bronze', status: 'complete' as const },
    { name: 'Ashlyn two-handle lavatory',   brand: 'Delta',  collection: 'Ashlyn', sku: 'T14094-I',    finish: 'Polished Nickel',  status: 'tbd' as const },
    { name: 'Litze shower trim',            brand: 'Brizo',  collection: 'Litze',  sku: '—',           finish: 'Missing finish',    status: 'missing' as const },
  ]
  return (
    <Section id="item-row" title="Item row" note="Group view · [4.2]">
      <div className="stage">
        <div className="bg-surface border border-[color:var(--border-1)] rounded-lg overflow-hidden">
          {items.map((it, i) => (
            <div
              key={i}
              className="grid gap-5 items-center px-5 py-4 border-b border-[color:var(--border-1)] last:border-0"
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
              <button aria-label="More" className="text-ink-500 flex items-center justify-center">
                <MoreHorizontal size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function PatternSearchResult() {
  return (
    <Section id="search-result" title="Library search result" note="Add item · [4.3]">
      <div className="stage">
        <div className="flex flex-col gap-2.5">
          {[
            { brand: 'Kohler', name: 'Billet wall-mount widespread lavatory faucet', meta: 'Billet collection · 5 finishes available', variant: 'dark' as const, swatches: ['#B88550', '#1A1814', '#C8C6C4', '#E8CCA0', '#8E7A5F'] },
            { brand: 'Delta',  name: 'Ashlyn two-handle widespread lavatory faucet', meta: 'Ashlyn collection · 4 finishes available', variant: 'ghost' as const, swatches: ['#C9B487', '#1A1814', '#D0D0CE', '#8A6A3F'] },
          ].map((r, i) => (
            <div
              key={i}
              className="grid items-center gap-4 p-3.5 bg-surface border border-[color:var(--border-1)] rounded-md"
              style={{ gridTemplateColumns: '80px 1fr auto' }}
            >
              <div className="w-[80px] h-[80px] rounded-sm bg-subtle" />
              <div>
                <div className="eyebrow">{r.brand}</div>
                <h4 className="font-display text-18 font-medium mt-1">{r.name}</h4>
                <div className="caption mt-0.5">{r.meta}</div>
                <div className="flex gap-1.5 mt-2">
                  {r.swatches.map((s, j) => (
                    <span key={j} className="inline-block w-[18px] h-[18px] rounded-full border border-[color:var(--border-2)]" style={{ background: s }} />
                  ))}
                </div>
              </div>
              <Button variant={r.variant} size="sm">Add to group</Button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function PatternModal() {
  return (
    <Section id="modal" title="Modal" note="New project · [3.2]">
      <div className="stage flex justify-center">
        <div className="modal">
          <div className="m-head">
            <h3 className="h3">New project</h3>
            <p>Give it a name. You can add a client and address later.</p>
          </div>
          <div className="m-body">
            <Field label="Project name">
              <Input placeholder="e.g. Atherton Residence" />
            </Field>
            <Field label="Client" optional>
              <Input placeholder="Client or studio name" />
            </Field>
          </div>
          <div className="m-foot">
            <Button variant="ghost" size="sm">Cancel</Button>
            <Button variant="primary" size="sm">Create project</Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

function PatternHero() {
  return (
    <Section id="hero" title="Marketing hero" note="Editorial serif · terracotta italic accent">
      <div className="stage">
        <div className="bg-app rounded-xl border border-[color:var(--border-1)] p-12">
          <p className="eyebrow mb-6">Now in early access</p>
          <h1 className="font-display font-normal text-48 md:text-64 leading-[1.02] tracking-tighter text-ink-900 max-w-2xl">
            Spec a project <span className="italic-serif text-accent">the way</span> you actually work.
          </h1>
          <p className="body-lg mt-6 max-w-lg">
            A fast, structured workspace for interior designers. Capture products, organize by room, and export builder-ready spec sheets — without the spreadsheet.
          </p>
          <div className="mt-8 flex gap-3 items-center flex-wrap">
            <ButtonLink href="#" variant="primary" size="lg">Start 7-day free trial</ButtonLink>
            <span className="caption">No credit card · cancel anytime</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

function PatternDarkCTA() {
  return (
    <Section id="dark-cta" title="Dark CTA section" note="Bark ink · terracotta italic · hero-scale type">
      <div className="rounded-xl bg-ink-900 text-paper-50 px-10 py-16">
        <p className="eyebrow text-terracotta-300 mb-4">The deliverable</p>
        <h2 className="font-display font-normal text-32 md:text-48 leading-[1.05] tracking-tight text-paper-50 max-w-3xl">
          Export a spec sheet your builder will <span className="italic-serif text-terracotta-300">actually read.</span>
        </h2>
        <p className="body-lg mt-6 max-w-xl" style={{ color: 'rgba(250,247,242,0.7)' }}>
          Speclyy generates a branded PDF organized by your group names, with real product images, finishes, SKUs, dimensions, and source links.
        </p>
        <div className="mt-8 flex gap-3 flex-wrap">
          <Button variant="primary">Start free trial</Button>
          <Button variant="ghost-inverse">See a sample PDF</Button>
        </div>
      </div>
    </Section>
  )
}

function PatternPricing() {
  return (
    <Section id="pricing" title="Pricing card" note="One tier at launch · 7-day trial">
      <div className="stage">
        <div className="spec-grid cols-2">
          <div className="p-9 rounded-lg bg-surface border border-[color:var(--border-2)]">
            <p className="eyebrow mb-2">Trial</p>
            <div className="flex items-baseline gap-2 my-3">
              <span className="font-display text-64 font-normal leading-none tracking-tighter">
                <span className="align-super text-32 mr-0.5">$</span>0
              </span>
              <span className="caption">for 7 days</span>
            </div>
            <p className="body-sm text-ink-500">Full access. No credit card required.</p>
            <ul className="mt-6 mb-8 flex flex-col gap-2.5">
              {['Unlimited projects', 'URL paste + manual entry', 'Full Library access', 'PDF export'].map(f => (
                <li key={f} className="flex gap-2.5 items-start body-sm">
                  <Check size={16} className="text-accent mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="ghost" block>Start trial</Button>
          </div>

          <div className="p-9 rounded-lg bg-subtle border-[1.5px] border-ink-900">
            <p className="eyebrow mb-2">Studio</p>
            <div className="flex items-baseline gap-2 my-3">
              <span className="font-display text-64 font-normal leading-none tracking-tighter">
                <span className="align-super text-32 mr-0.5">$</span>39
              </span>
              <span className="caption">/ designer / month</span>
            </div>
            <p className="body-sm text-ink-500">Flat rate. Cancel anytime.</p>
            <ul className="mt-6 mb-8 flex flex-col gap-2.5">
              {['Everything in Trial', 'My Library (save & reuse)', 'Studio branding on exports', 'CSV export for trades'].map(f => (
                <li key={f} className="flex gap-2.5 items-start body-sm">
                  <Check size={16} className="text-accent mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="primary" block>Start free trial</Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
