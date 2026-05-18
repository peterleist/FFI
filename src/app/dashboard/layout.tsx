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
        <div className="flex h-screen bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <UserBar />

            {/* Mobile header */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
              <div className="flex items-center gap-3">
                <MobileSidebar />
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-foreground">PEFI</span>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-y-auto">
              <div className="p-4 md:p-6 max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
        </div>
      </SetupGate>
    </DbSyncProvider>
  )
}
