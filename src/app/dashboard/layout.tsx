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
        <div className="flex h-screen bg-[#0a0a0f]">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top bar */}
            <UserBar />

            {/* Mobile header */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111118] border-b border-[#1e1e2e]">
              <div className="flex items-center gap-3">
                <MobileSidebar />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-[#111118]" />
                  </div>
                  <span className="font-bold text-[#f1f5f9]">PEFI</span>
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
