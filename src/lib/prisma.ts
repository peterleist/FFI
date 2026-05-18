import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient | null }

function createPrismaClient(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return null
  try {
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    return new PrismaClient({ adapter })
  } catch {
    return null
  }
}

// Returns null when DATABASE_URL is not set (local-only mode)
export const prisma: PrismaClient | null =
  globalForPrisma.prisma !== undefined
    ? globalForPrisma.prisma
    : (globalForPrisma.prisma = createPrismaClient())
