import type { Metadata } from 'next'
import Script from 'next/script'
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
        <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js" strategy="afterInteractive" />
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
