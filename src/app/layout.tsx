import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Providers from '@/components/layout/Providers'
import AppShell from '@/components/layout/AppShell'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CTNS ERP',
  description: '배터리팩 제조 ERP 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${geist.className} bg-gray-50 text-gray-900 antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
