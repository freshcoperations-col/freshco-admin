'use client'

import { usePathname } from 'next/navigation'
import { AdminGate } from './AdminGate'
import { AdminSidebar } from './AdminSidebar'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <AdminGate>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AdminGate>
  )
}
