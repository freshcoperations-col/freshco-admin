'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { AdminGate } from './AdminGate'
import { AdminSidebar } from './AdminSidebar'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isLogin = pathname === '/login'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isLogin) return <>{children}</>

  return (
    <AdminGate>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Overlay móvil */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: siempre visible en desktop, drawer en móvil */}
        <div
          className={`fixed lg:static z-30 h-full transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <main className="flex-1 overflow-y-auto">
          {/* Header móvil con hamburguesa */}
          <div className="lg:hidden h-12 bg-white border-b border-gray-200 px-4 flex items-center gap-3 sticky top-0 z-10">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-bold">Freshco Admin</span>
          </div>

          {children}
        </main>
      </div>
    </AdminGate>
  )
}
