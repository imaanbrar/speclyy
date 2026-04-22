import { AppNav, Avatar, Button } from '@speclyy/design-system'
import { Download, Plus } from '@speclyy/design-system/icons'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-6">
        <AppNav
          crumbs={[{ label: 'Projects', href: '/projects' }]}
          right={
            <>
              <Button variant="ghost" size="sm"><Download size={16} /> Export</Button>
              <Button variant="primary" size="sm"><Plus size={16} /> Add item</Button>
              <Avatar initials="IB" title="Your account" />
            </>
          }
        />
      </div>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10">
        {children}
      </div>
    </div>
  )
}
