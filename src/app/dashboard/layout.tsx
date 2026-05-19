import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Flame } from 'lucide-react'
import { SetupGate } from '@/components/setup/setup-gate'
import { UserBar } from '@/components/layout/user-bar'
import { DbSyncProvider } from '@/components/setup/db-sync-provider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DbSyncProvider>
      <SetupGate>
        <div className="pf-app">
          <Sidebar />
          <div className="pf-main">
            <UserBar />

            {/* Mobile header */}
            <header
              className="md:hidden flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: 'var(--pf-border)', background: 'var(--pf-bg-elev)' }}
            >
              <MobileSidebar />
              <span className="sb-flame"><Flame className="w-3 h-3 text-white" /></span>
              <span className="font-semibold text-foreground">PEFI</span>
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-y-auto">
              <div className="content">{children}</div>
            </main>
          </div>
        </div>
      </SetupGate>
    </DbSyncProvider>
  )
}
