import { ButtonLink } from '@speclyy/design-system'
import { Plus } from '@speclyy/design-system/icons'
import { createServerSupabase } from '@speclyy/auth/server'
import { getAccountChrome } from '@/lib/account/chrome'
import { DEMO_PROJECTS } from '@/lib/projects/demo'
import { TopBar } from '../_components/top-bar'
import { ProjectsHub } from './_components/projects-hub'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>
}) {
  // First-render side effect: flip `has_visited_dashboard` on so the
  // /welcome screen is shown exactly once. Idempotent thanks to the WHERE
  // clause; subsequent visits are no-ops.
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .update({ has_visited_dashboard: true })
      .eq('id', user.id)
      .eq('has_visited_dashboard', false)
  }

  const sp = await searchParams
  const populated = sp.demo === 'populated'
  const yourProjects = populated ? [...DEMO_PROJECTS].slice(0, 3) : []

  const chrome = await getAccountChrome()
  const newProjectHref = populated ? '/projects?demo=populated&new=1' : '/projects?new=1'

  return (
    <>
      <TopBar
        crumbs={[{ label: 'Projects' }]}
        actions={
          <ButtonLink variant="primary" size="sm" href={newProjectHref}>
            <Plus size={16} /> New project
          </ButtonLink>
        }
        initials={chrome.initials}
        email={chrome.email}
      />
      <ProjectsHub yourProjects={yourProjects} newProjectHref={newProjectHref} />
    </>
  )
}
