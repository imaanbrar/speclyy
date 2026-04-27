import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ButtonLink, Logo, Pill } from '@speclyy/design-system'
import { ArrowRight, Sparkle } from '@speclyy/design-system/icons'
import { createServerSupabase } from '@speclyy/auth/server'

/**
 * `/welcome` — landing screen between Free completion and the empty
 * dashboard. Reachable only when `onboarding_completed_at IS NOT NULL` AND
 * `has_visited_dashboard = false`. Returning users go straight to /projects;
 * the dashboard flips `has_visited_dashboard` on first render.
 *
 * Layout mirrors `docs/design/onboarding/welcome-free.png`: editorial title,
 * a 3-up grid of preloaded sample projects, a Pro upsell row, and the dual
 * CTAs (browse samples / create your first project).
 *
 * Sample thumbnails are hot-linked from Unsplash's free-tier CDN (allowed in
 * `next.config.mjs#images.remotePatterns`). Each card overlays a giant serif
 * initial in cream so the editorial typographic identity stays consistent
 * regardless of which photo Unsplash serves.
 */
export default async function WelcomePage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, has_visited_dashboard')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed_at) redirect('/onboarding/name')
  if (profile.has_visited_dashboard) redirect('/projects')

  return (
    <div className="min-h-screen flex flex-col bg-app">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Logo href="/projects" />
        <span className="eyebrow">Welcome</span>
      </header>

      <main className="flex-1 px-6 pb-16">
        <div className="max-w-[1080px] mx-auto">
          <div className="text-center pt-4 pb-12">
            <p className="eyebrow mb-4">Free · Active</p>
            <h1 className="h1">
              Start your <span className="italic-serif">first project.</span>
            </h1>
            <p className="body-lg mt-4 max-w-xl mx-auto">
              Build unlimited specs and explore the Library. Open a sample to
              see how a finished project looks, or start fresh.
            </p>
          </div>

          <div className="flex items-baseline justify-between gap-4 mb-5">
            <p className="eyebrow">Sample projects</p>
            <p className="caption">
              Pre-loaded so you can poke around — duplicate any to make it yours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {SAMPLE_PROJECTS.map((p) => (
              <SampleCard key={p.id} project={p} />
            ))}
          </div>

          <ProUpsell />

          <div className="flex items-center justify-center gap-3 mt-10">
            <ButtonLink href="/projects" variant="ghost">
              Browse samples
            </ButtonLink>
            <ButtonLink href="/projects/new" variant="dark">
              Create your first project <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </div>
      </main>

      <footer className="px-6 md:px-10 py-6 flex items-center justify-between caption">
        <span>© Speclyy 2026</span>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="link-quiet">Privacy</a>
          <span aria-hidden>·</span>
          <a href="/terms" className="link-quiet">Terms</a>
        </div>
      </footer>
    </div>
  )
}

// --- Sample-project model & data ---------------------------------------------
// These rows are static so the page renders instantly without a DB hop. When
// real seeded sample projects land, swap this for a server-side query and
// drop SAMPLE_PROJECTS — the SampleCard contract is intentionally narrow.

interface SampleProject {
  id: string
  name: string
  category: string
  initial: string
  // Unsplash CDN URL (free-tier `photo-...` pattern). The `?w=…&q=…&auto=format`
  // params let Unsplash pre-resize/encode before next/image takes over —
  // halves payload over a raw URL.
  imageSrc: string
  imageAlt: string
  groups: number
  items: number
  groupTags: string[]
  status: string
}

const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'ravenswood',
    name: 'Ravenswood residence',
    category: 'Full home',
    initial: 'R',
    imageSrc:
      'https://images.unsplash.com/photo-1771287490586-356754be24dc?w=800&q=80&auto=format&fit=crop',
    imageAlt: 'Living room with a gallery wall of framed art above a light sofa.',
    groups: 4,
    items: 62,
    groupTags: ['Living', 'Primary suite', 'Kitchen', 'Powder'],
    status: 'Spec in progress',
  },
  {
    id: 'marlow-suite-12',
    name: 'Marlow Hotel — Suite 12',
    category: 'Hospitality',
    initial: 'M',
    imageSrc:
      'https://images.unsplash.com/photo-1631048730670-ff5cd0d08f15?w=800&q=80&auto=format&fit=crop',
    imageAlt: 'Hotel suite with a king bed in white linens and a dark headboard.',
    groups: 3,
    items: 41,
    groupTags: ['Bedroom', 'Bathroom', 'Lounge'],
    status: 'Ready to share',
  },
  {
    id: 'pine-st-cafe',
    name: 'Pine St. café',
    category: 'Commercial',
    initial: 'P',
    imageSrc:
      'https://images.unsplash.com/photo-1508424757105-b6d5ad9329d0?w=800&q=80&auto=format&fit=crop',
    imageAlt: 'Warm café interior with seating, plants, and exposed wood tones.',
    groups: 2,
    items: 28,
    groupTags: ['Front of house', 'Back bar'],
    status: 'Drafting',
  },
]

function SampleCard({ project }: { project: SampleProject }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="card card-hover block"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Media slot: Unsplash photo with the category badge top-right and
          an oversized serif initial bottom-left in cream. Aspect-locked at
          4:3 so all three cards share a baseline regardless of photo
          dimensions or name length. */}
      <div
        className="relative"
        style={{
          aspectRatio: '4 / 3',
          background: 'var(--paper-100)', // fallback while image loads
        }}
      >
        <Image
          src={project.imageSrc}
          alt={project.imageAlt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          style={{ objectFit: 'cover' }}
          // First card is above-the-fold; eager-load it so the LCP isn't
          // blocked on Unsplash. Cards 2/3 lazy-load by default.
          priority={project.id === 'ravenswood'}
        />
        <span
          className="eyebrow absolute"
          style={{
            top: 12,
            right: 12,
            background: 'var(--bg-surface)',
            color: 'var(--fg-1)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {project.category}
        </span>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 8,
            left: 20,
            fontFamily: 'var(--font-display)',
            fontSize: 104,
            fontWeight: 400,
            color: 'var(--paper-50)',
            lineHeight: 1,
            opacity: 0.92,
            // Subtle drop-shadow keeps the initial readable on bright photos
            // without over-styling on darker ones.
            textShadow: '0 2px 12px rgba(26, 24, 20, 0.22)',
            fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
          }}
        >
          {project.initial}
        </span>
      </div>

      <div style={{ padding: '20px 22px' }}>
        <h4 className="h4">{project.name}</h4>
        <p className="caption mt-1">
          {project.groups} groups · {project.items} items
        </p>

        <div className="flex flex-wrap gap-2 mt-3">
          {project.groupTags.map((tag) => (
            <Pill key={tag} tone="neutral" dot={false}>
              {tag}
            </Pill>
          ))}
        </div>

        <div
          className="flex items-center justify-between mt-5 pt-4"
          style={{ borderTop: '1px solid var(--border-1)' }}
        >
          <span className="caption">{project.status}</span>
          <span
            className="body-sm"
            style={{
              color: 'var(--fg-1)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Open <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  )
}

function ProUpsell() {
  return (
    <div
      className="flex items-center gap-4 mt-8"
      style={{
        background: 'var(--bg-subtle)',
        border: '1px dashed var(--border-2)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 20px',
      }}
    >
      <Sparkle
        size={20}
        aria-hidden
        style={{ color: 'var(--terracotta-500)', flexShrink: 0 }}
      />
      <div className="flex-1">
        <p
          className="body-sm"
          style={{ color: 'var(--fg-1)', fontWeight: 600 }}
        >
          Pro — $29/mo billed annually
        </p>
        <p className="caption mt-0.5">
          Unlocks unlimited PDF spec sheets and client share links. Save 30%
          annual.
        </p>
      </div>
      <ButtonLink href="/billing" variant="ghost" size="sm">
        See Pro
      </ButtonLink>
    </div>
  )
}
