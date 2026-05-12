import { createServerSupabase } from '@speclyy/auth/server'

export interface AccountChrome {
  initials: string
  email: string | null
  name: string | null
}

function initialsFor(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

export async function getAccountChrome(): Promise<AccountChrome> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null
  return {
    name,
    email: user?.email ?? null,
    initials: initialsFor(name, user?.email),
  }
}
