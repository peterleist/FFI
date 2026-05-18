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
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl text-foreground tracking-tight">PEFI</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isActive ? 'text-white' : 'text-muted-foreground/70'
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {userName && (
        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary transition-colors cursor-pointer">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-bold">
                {userName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground">Fiók</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-60 bg-card border-r border-border h-screen sticky top-0 flex-shrink-0 shadow-sm">
      <NavContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 w-60 bg-card border-r border-border"
      >
        <NavContent onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
