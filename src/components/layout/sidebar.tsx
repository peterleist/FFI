'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Upload,
  TrendingUp, Flame, Settings, Menu, X,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { useAccountValues } from '@/lib/account-value'
import { formatCurrency } from '@/lib/utils'

const WORKSPACE = [
  { label: 'Áttekintő', icon: LayoutDashboard, href: '/dashboard', kbd: '1' },
  { label: 'Tranzakciók', icon: ArrowLeftRight, href: '/dashboard/transactions', kbd: '2' },
  { label: 'Költségvetés', icon: PieChart, href: '/dashboard/budget', kbd: '3' },
  { label: 'Import', icon: Upload, href: '/dashboard/import', kbd: '4' },
  { label: 'Befektetések', icon: TrendingUp, href: '/dashboard/investments', kbd: '5' },
  { label: 'FIRE Tervező', icon: Flame, href: '/dashboard/fire', kbd: '6' },
]
const SETTINGS_ITEM = { label: 'Beállítások', icon: Settings, href: '/dashboard/settings', kbd: '7' }

function FlameMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 L12.5 8 L8 14.5 L3.5 8 Z" fill="#fff" fillOpacity=".25" />
      <path d="M8 4.5 L10.6 8 L8 11.5 L5.4 8 Z" fill="#fff" />
    </svg>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
}

function NavInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { userName, accounts, fireGoalAmount, investmentPositions, fireAccountIds } = useAppStore()
  const { values: accountValues, total } = useAccountValues(accounts, investmentPositions)
  // Mirror the FIRE planner: TBSZ valued from positions, only the counted accounts
  const netWorth = fireAccountIds === null
    ? total
    : accounts
        .filter((a) => fireAccountIds.includes(a.id))
        .reduce((s, a) => s + (accountValues[a.id] ?? a.balance), 0)
  const fireProgress = fireGoalAmount > 0 ? Math.min(netWorth / fireGoalAmount, 1) : 0
  const initials = (userName || 'PEFI')
    .split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  const renderItem = (it: typeof SETTINGS_ITEM) => {
    const active = isActive(pathname, it.href)
    const Ico = it.icon
    return (
      <Link key={it.href} href={it.href} onClick={onNavigate}
        className={`sb-item ${active ? 'active' : ''}`}>
        <span className="ico"><Ico size={15} strokeWidth={1.6} /></span>
        <span>{it.label}</span>
        <span className="kbd">⌘{it.kbd}</span>
      </Link>
    )
  }

  return (
    <>
      <div className="sb-brand">
        <span className="sb-flame"><FlameMark /></span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="brand-word">PEFI</span>
          <span className="brand-sub">v 1.0</span>
        </div>
      </div>

      <div className="sb-section">Munkaterület</div>
      <nav className="sb-nav">{WORKSPACE.map(renderItem)}</nav>

      <div className="sb-section">Fiók</div>
      <nav className="sb-nav">{renderItem(SETTINGS_ITEM)}</nav>

      <div className="sb-spacer" />

      <div style={{ padding: '0 6px 6px' }}>
        <div className="pf-card" style={{ padding: 12, background: 'var(--pf-card-2)', borderRadius: 12 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="pf-badge accent"><span className="dot" />FIRE</span>
            <span className="num" style={{ fontSize: 11 }}>{(fireProgress * 100).toFixed(1)}%</span>
          </div>
          <div className="pf-progress thin">
            <div className="bar" style={{ width: `${fireProgress * 100}%` }} />
          </div>
          <div className="num pf-muted" style={{ fontSize: 10.5, marginTop: 6 }}>
            {formatCurrency(netWorth)} / {formatCurrency(fireGoalAmount)}
          </div>
        </div>
      </div>

      <div className="sb-user">
        <div className="pf-avatar">{initials}</div>
        <div className="who">
          <span className="n">{userName || 'PEFI'}</span>
          <span className="e">Személyes pénzügyek</span>
        </div>
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <NavInner />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[232px]">
        <aside
          className="sidebar"
          style={{ display: 'flex', position: 'static', height: '100%' }}
        >
          <NavInner onNavigate={() => setOpen(false)} />
        </aside>
      </SheetContent>
    </Sheet>
  )
}
