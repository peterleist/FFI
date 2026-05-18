import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PEFI — Személyes Pénzügyek & FIRE',
  description:
    'Személyes pénzügyi tervező és FIRE kalkulátor magyar felhasználóknak. Kezeld bevételeid, kiadásaid és befektetéseid egy helyen.',
  keywords: ['pénzügyek', 'FIRE', 'befektetés', 'megtakarítás', 'Magyar'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="hu" className={`${inter.variable} h-full dark`}>
      <body className="min-h-full flex flex-col antialiased bg-[#0a0a0f] text-[#f1f5f9]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
