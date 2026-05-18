'use client'

import { Flame } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function UserBar() {
  const userName = useAppStore((s) => s.userName)

  return (
    <div className="hidden md:flex items-center justify-between bg-[#111118] border-b border-[#1e1e2e] px-6 py-2 h-10">
      <div className="flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400 font-medium">PEFI</span>
      </div>
      {userName && (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-400/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-[#64748b]">{userName}</span>
        </div>
      )}
    </div>
  )
}
