import Link from 'next/link'
import { Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Flame className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-bold text-foreground">PEFI</span>
        </div>
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Az oldal nem található</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          A keresett oldal nem létezik, vagy áthelyezték.
        </p>
        <Link href="/dashboard">
          <Button className="bg-primary hover:bg-primary/90 text-white mt-4">
            Vissza a főoldalra
          </Button>
        </Link>
      </div>
    </div>
  )
}
