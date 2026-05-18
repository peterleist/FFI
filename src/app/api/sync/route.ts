import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/sync — load snapshot from DB
export async function GET() {
  if (!prisma) {
    return NextResponse.json({ mode: 'local', data: null })
  }

  try {
    const snapshot = await prisma.appSnapshot.findUnique({ where: { id: 'singleton' } })
    return NextResponse.json({ mode: 'db', data: snapshot?.data ?? null })
  } catch (err) {
    console.error('[sync] GET error:', err)
    return NextResponse.json({ mode: 'local', data: null })
  }
}

// POST /api/sync — save snapshot to DB
export async function POST(req: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ mode: 'local', saved: false })
  }

  try {
    const body = await req.json()
    await prisma.appSnapshot.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', data: body },
      update: { data: body },
    })
    return NextResponse.json({ mode: 'db', saved: true })
  } catch (err) {
    console.error('[sync] POST error:', err)
    return NextResponse.json({ mode: 'local', saved: false }, { status: 500 })
  }
}
