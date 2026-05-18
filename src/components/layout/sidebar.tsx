'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Upload,
  TrendingUp,
  Flame,
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'

const navItems = [
  { label: 'Áttekintő', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Tranzakciók', icon: ArrowLeftRight, href: '/dashboard/transactions' },
  { label: 'Költségvetés', icon: PieChart, href: '/dashboard/budget' },
  { label: 'Import', icon: Upload, href: '/dashboard/import' },
  { label: 'Befektetések', icon: TrendingUp, href: '/dashboard/investments' },
  { label: 'FIRE Tervező', icon: Flame, href: '/dashboard/fire' },
  { label: 'Beállítások', icon: Settings, href: '/dashboard/settings' },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const userName = useAppStore((s) => s.userName)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[#1e1e2e]">
        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
          <Flame className="w-5 h-5 text-[#111118]" />
        </div>
        <span className="font-bold text-lg text-[#f1f5f9]">PEFI</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-slate-400/10 text-slate-400 border border-slate-400/20'
                  : 'text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e]'
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isActive ? 'text-slate-400' : 'text-[#64748b]'
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {userName && (
        <div className="px-3 py-4 border-t border-[#1e1e2e]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-slate-600 text-white text-xs font-bold">
                {userName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f1f5f9] truncate">{userName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-[#111118] border-r border-[#1e1e2e] h-screen sticky top-0 flex-shrink-0">
      <NavContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e1e2e] transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 w-56 bg-[#111118] border-r border-[#1e1e2e]"
      >
        <NavContent onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
