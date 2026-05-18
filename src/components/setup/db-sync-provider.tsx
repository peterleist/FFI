'use client'

import { useEffect, useRef } from 'react'
import { useAppStore, extractSnapshot, type AppSnapshot } from '@/lib/store'

const DEBOUNCE_MS = 1500

export function DbSyncProvider({ children }: { children: React.ReactNode }) {
  const loadSnapshot = useAppStore((s) => s.loadSnapshot)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialised = useRef(false)

  // ── On mount: pull from DB (overwrites localStorage if DB has data) ──────────
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    fetch('/api/sync')
      .then((r) => r.json())
      .then(({ mode, data }: { mode: string; data: AppSnapshot | null }) => {
        if (mode === 'db' && data) {
          // DB is authoritative — hydrate the store
          loadSnapshot(data)
        }
        // mode === 'local': no DATABASE_URL, stick with localStorage
      })
      .catch(() => {
        // Network or DB error — silently stay with localStorage
      })
  }, [loadSnapshot])

  // ── Subscribe to store changes and debounce-save to DB ───────────────────────
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const snapshot = extractSnapshot(state)
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        }).catch(() => {
          // Silently ignore — localStorage is still the fallback
        })
      }, DEBOUNCE_MS)
    })

    return () => {
      unsub()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return <>{children}</>
}
