'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { botFetch } from '@/lib/api'
import { ensureNotifyPermission, notify } from '@/lib/notify'

interface Kpis {
  orders_today: number
  pending: number
  approved_pending_shipment: number
  in_transit: number
}

const NAV = [
  { href: '/', label: 'Inicio', match: (p: string) => p === '/' },
  { href: '/analytics', label: 'Analíticas', match: (p: string) => p.startsWith('/analytics') },
  { href: '/orders', label: 'Pedidos', match: (p: string) => p.startsWith('/orders') },
  { href: '/conversations', label: 'Conversaciones', match: (p: string) => p.startsWith('/conversations') },
  { href: '/products', label: 'Productos', match: (p: string) => p.startsWith('/products') },
  { href: '/coupons', label: 'Cupones', match: (p: string) => p.startsWith('/coupons') },
  { href: '/collections', label: 'Colecciones', match: (p: string) => p.startsWith('/collections') },
  { href: '/sizes', label: 'Guía de tallas', match: (p: string) => p.startsWith('/sizes') },
]

export function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [kpis, setKpis] = useState<Kpis | null>(null)

  async function refreshKpis() {
    const res = await botFetch('/api/admin/web/kpis', { method: 'GET' })
    if (res.ok) setKpis(await res.json())
  }

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
    })

    refreshKpis()
    const interval = setInterval(refreshKpis, 30_000)

    // Notificaciones realtime de pedidos nuevos y mensajes que piden asesor.
    let channel: ReturnType<typeof supabase.channel> | null = null
    ensureNotifyPermission().then((ok) => {
      if (!ok) return
      channel = supabase
        .channel('admin-events')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const o = payload.new as { customer_name?: string; total?: number; payment_status?: string }
          const who = o.customer_name ?? 'Un cliente'
          const total = o.total ? `$${Number(o.total).toLocaleString('es-CO')}` : ''
          notify('Pedido nuevo 🛍', `${who} — ${total}`)
          refreshKpis()
        })
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          () => refreshKpis(),
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const m = payload.new as { intent?: string; direction?: string; content?: string; customer_phone?: string }
            if (m.direction === 'inbound' && m.intent === 'solicita_asesor') {
              notify('Cliente quiere asesor 🆘', `+${m.customer_phone}: ${(m.content ?? '').slice(0, 80)}`)
            }
          },
        )
        .subscribe()
    })

    return () => {
      clearInterval(interval)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const pendingShip = kpis?.approved_pending_shipment ?? 0

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-4 h-12 flex items-center border-b border-gray-200">
        <span className="text-sm font-bold">Freshco Admin</span>
      </div>

      <nav className="flex-1 py-2 text-sm">
        {NAV.map((item) => {
          const active = item.match(pathname)
          const showBadge = item.href === '/orders' && pendingShip > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                active ? 'bg-gray-100 font-semibold' : 'text-gray-700'
              }`}
            >
              <span>{item.label}</span>
              {showBadge && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  {pendingShip}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 text-xs text-gray-500">
        {email && <div className="truncate mb-2">{email}</div>}
        <button onClick={handleLogout} className="text-gray-700 hover:text-gray-900 underline">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
