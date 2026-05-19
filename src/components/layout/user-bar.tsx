'use client'

import Link from 'next/link'
import { Bell, Search, Plus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

export function UserBar() {
  const userName = useAppStore((s) => s.userName)
  const firstName = userName ? userName.split(' ')[0] : 'PEFI'
  const initials = (userName || 'PEFI')
    .split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
  const now = new Date()

  return (
    <div className="topbar hidden md:flex">
      <div>
        <div className="hi">Szia, <b>{firstName}!</b></div>
        <div className="date">{format(now, 'yyyy. MMMM d., EEEE', { locale: hu })}</div>
      </div>
      <div className="grow" />
      <div className="pf-search">
        <Search size={14} strokeWidth={1.6} />
        <input placeholder="Keresés tranzakciók, tickerek, számlák közt…" />
        <span className="k">⌘K</span>
      </div>
      <Link href="/dashboard/transactions" className="pf-btn sm">
        <Plus size={13} strokeWidth={1.8} /> Új tranzakció
      </Link>
      <button className="iconbtn" title="Értesítések" type="button">
        <Bell size={14} strokeWidth={1.6} />
        <span className="dot" />
      </button>
      <div className="pf-avatar">{initials}</div>
    </div>
  )
}
