import { AppNav, Button } from '@speclyy/design-system'
import { Download, Plus } from '@speclyy/design-system/icons'
import { createServerSupabase } from '@speclyy/auth/server'
import { AccountMenu } from '@/components/account-menu'

function initialsFor(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware has already gated the page, but read the user so the avatar
  // shows real initials instead of a hard-coded stub.
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null
  const initials = initialsFor(name, user?.email)

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-6">
        <AppNav
          crumbs={[{ label: 'Projects', href: '/projects' }]}
          right={
            <>
              <Button variant="ghost" size="sm">
                <Download size={16} /> Export
              </Button>
              <Button variant="primary" size="sm">
                <Plus size={16} /> Add item
              </Button>
              <AccountMenu initials={initials} title={user?.email ?? 'Your account'} />
            </>
          }
        />
      </div>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10">{children}</div>
    </div>
  )
}
