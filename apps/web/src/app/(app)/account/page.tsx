import { Avatar, Button, Field, Input } from '@speclyy/design-system'
import { getAccountChrome } from '@/lib/account/chrome'
import { TopBar } from '../_components/top-bar'

export default async function AccountPage() {
  const chrome = await getAccountChrome()

  return (
    <>
      <TopBar
        crumbs={[{ label: 'Account' }]}
        initials={chrome.initials}
        email={chrome.email}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 48px 80px' }}>
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">Settings</p>
            <h1 className="h1 mb-10">Account</h1>

            <div className="card mb-6">
              <div className="flex items-center gap-4 mb-8">
                <Avatar initials={chrome.initials} />
                <div>
                  <div className="h4">{chrome.name ?? chrome.email ?? 'Your account'}</div>
                  <div className="caption">{chrome.email}</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name"><Input defaultValue={chrome.name ?? ''} /></Field>
                <Field label="Studio name"><Input defaultValue="Henley & Co." /></Field>
                <Field label="Market"><Input defaultValue="Los Angeles" /></Field>
                <Field label="Email" helper="Used for login. Contact support to change.">
                  <Input defaultValue={chrome.email ?? ''} disabled />
                </Field>
              </div>

              <div className="flex justify-end mt-8">
                <Button variant="primary">Save changes</Button>
              </div>
            </div>

            <div className="card">
              <div className="h4 mb-2">Sign out</div>
              <p className="body-sm mb-6">You&apos;ll need to sign in again to open this workspace.</p>
              <form action="/auth/sign-out" method="post">
                <Button variant="ghost" type="submit">Sign out</Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
