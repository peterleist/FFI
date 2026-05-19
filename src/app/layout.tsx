import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

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
    <html lang="hu" className={`${GeistSans.variable} ${GeistMono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col antialiased bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
