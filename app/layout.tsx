import type { Metadata } from 'next'
import './globals.css'
import { AdminShell } from '@/components/AdminShell'

export const metadata: Metadata = {
  title: 'Freshco Admin',
  description: 'Panel de operación interna de Freshco',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
