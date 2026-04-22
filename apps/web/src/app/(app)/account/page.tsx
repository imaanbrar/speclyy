import { Avatar, Button, Field, Input } from '@speclyy/design-system'

export default function AccountPage() {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">Settings</p>
      <h1 className="h1 mb-10">Account</h1>

      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-8">
          <Avatar initials="IB" />
          <div>
            <div className="h4">Imaanvir Brar</div>
            <div className="caption">imaanvirbrar@gmail.com</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name"><Input defaultValue="Imaanvir Brar" /></Field>
          <Field label="Studio name"><Input defaultValue="Henley & Co." /></Field>
          <Field label="Market"><Input defaultValue="Los Angeles" /></Field>
          <Field label="Email" helper="Used for login. Contact support to change."><Input defaultValue="imaanvirbrar@gmail.com" disabled /></Field>
        </div>

        <div className="flex justify-end mt-8">
          <Button variant="primary">Save changes</Button>
        </div>
      </div>

      <div className="card">
        <div className="h4 mb-2">Sign out</div>
        <p className="body-sm mb-6">You'll need to sign in again to open this workspace.</p>
        <Button variant="ghost">Sign out</Button>
      </div>
    </div>
  )
}
