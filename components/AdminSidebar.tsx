'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { ensureNotifyPermission, notify } from '@/lib/notify'

const LS_KEY = 'admin_orders_last_checked'

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
  const [unread, setUnread] = useState(0)

  function markRead() {
    localStorage.setItem(LS_KEY, new Date().toISOString())
    setUnread(0)
  }

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
    })

    // Contar pedidos nuevos desde la última vez que se revisó
    const lastChecked = localStorage.getItem(LS_KEY) ?? new Date(0).toISOString()
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastChecked)
      .then(({ count }) => setUnread(count ?? 0))

    // Realtime: pedidos nuevos y mensajes de asesor
    let channel: ReturnType<typeof supabase.channel> | null = null
    ensureNotifyPermission().then((ok) => {
      channel = supabase
        .channel('admin-events')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const o = payload.new as { customer_name?: string; total?: number }
          const who = o.customer_name ?? 'Un cliente'
          const total = o.total ? `$${Number(o.total).toLocaleString('es-CO')}` : ''
          if (ok) notify('Pedido nuevo 🛍', `${who} — ${total}`)
          setUnread((n) => n + 1)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const m = payload.new as { intent?: string; direction?: string; content?: string; customer_phone?: string }
          if (ok && m.direction === 'inbound' && m.intent === 'solicita_asesor') {
            notify('Cliente quiere asesor 🆘', `+${m.customer_phone}: ${(m.content ?? '').slice(0, 80)}`)
          }
        })
        .subscribe()
    })

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-4 h-12 flex items-center justify-between border-b border-gray-200">
        <span className="text-sm font-bold">Freshco Admin</span>
        <button
          onClick={() => { markRead(); router.push('/orders') }}
          className="relative p-1 text-gray-500 hover:text-gray-900"
          title="Pedidos nuevos"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>

      <nav className="flex-1 py-2 text-sm">
        {NAV.map((item) => {
          const active = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { if (item.href === '/orders') markRead(); onClose?.() }}
              className={`flex items-center px-4 py-3 hover:bg-gray-50 ${
                active ? 'bg-gray-100 font-semibold' : 'text-gray-700'
              }`}
            >
              {item.label}
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
