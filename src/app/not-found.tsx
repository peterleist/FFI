import Link from 'next/link'
import { Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-400/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-2xl font-bold text-[#f1f5f9]">PEFI</span>
        </div>
        <h1 className="text-6xl font-bold text-[#f1f5f9]">404</h1>
        <p className="text-xl text-[#64748b]">Az oldal nem található</p>
        <p className="text-sm text-[#64748b] max-w-sm mx-auto">
          A keresett oldal nem létezik, vagy áthelyezték.
        </p>
        <Link href="/dashboard">
          <Button className="bg-slate-600 hover:bg-slate-500 text-white mt-4">
            Vissza a főoldalra
          </Button>
        </Link>
      </div>
    </div>
  )
}
