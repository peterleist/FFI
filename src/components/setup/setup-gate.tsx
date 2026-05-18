'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { SetupWizard } from './setup-wizard'

export function SetupGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const setupComplete = useAppStore((s) => s.setupComplete)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    // Avoid hydration mismatch — show minimal loading until localStorage is read
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-primary">
          <Flame className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">PEFI betöltése…</span>
        </div>
      </div>
    )
  }

  if (!setupComplete) {
    return <SetupWizard />
  }

  return <>{children}</>
}
