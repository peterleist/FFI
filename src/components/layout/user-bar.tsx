'use client'

import { Bell } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

export function UserBar() {
  const userName = useAppStore((s) => s.userName)
  const now = new Date()

  return (
    <div className="hidden md:flex items-center justify-between bg-card border-b border-border px-6 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {userName ? `Szia, ${userName.split(' ')[0]}!` : 'PEFI'}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(now, 'yyyy. MMMM d., EEEE', { locale: hu })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-secondary transition-colors relative">
          <Bell className="w-4 h-4 text-primary" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
        </button>
        {userName && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-bold">
              {userName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
