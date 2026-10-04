'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { botFetch } from '@/lib/api'
import { useEffect, useRef, useState } from 'react'
import { ensureNotifyPermission, notify } from '@/lib/notify'
import { usePermissions } from '@/contexts/PermissionsContext'
import type { PermissionId } from '@/lib/permissions'

const LS_KEY = 'admin_orders_last_checked'
const POLL_MS = 20_000

interface Activity {
  now: string
  new_orders: number
  orders: RecentOrder[]
  asesor_requests: Array<{ id: string; customer_phone: string; content: string | null }>
}

// Pedidos y pedidos de asesor desde `since`, vía el API del bot (que valida
// que seas admin). Las tablas ya no se leen directo desde el navegador.
async function fetchActivity(since: string): Promise<Activity | null> {
  try {
    const res = await botFetch(`/api/admin/web/activity?since=${encodeURIComponent(since)}`, { method: 'GET' })
    return res.ok ? ((await res.json()) as Activity) : null
  } catch {
    return null
  }
}

interface RecentOrder {
  id: string
  customer_name: string | null
  total: number
  created_at: string
}

interface NavItem {
  href: string
  label: string
  match: (p: string) => boolean
  permission?: PermissionId
  ownerOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/', label: 'Inicio', match: (p) => p === '/' },
  { href: '/analytics', label: 'Analíticas', match: (p) => p === '/analytics', permission: 'analytics_view' },
  { href: '/analytics/web', label: 'Tráfico web', match: (p) => p.startsWith('/analytics/web'), permission: 'analytics_view' },
  { href: '/orders', label: 'Pedidos', match: (p) => p.startsWith('/orders'), permission: 'orders_view' },
  { href: '/conversations', label: 'Conversaciones', match: (p) => p.startsWith('/conversations'), permission: 'conversations_view' },
  { href: '/products', label: 'Productos', match: (p) => p.startsWith('/products'), permission: 'products_view' },
  { href: '/coupons', label: 'Cupones', match: (p) => p.startsWith('/coupons'), permission: 'coupons_edit' },
  { href: '/collections', label: 'Colecciones', match: (p) => p.startsWith('/collections'), permission: 'collections_edit' },
  { href: '/banners', label: 'Banners', match: (p) => p.startsWith('/banners'), permission: 'banners_edit' },
  { href: '/sizes', label: 'Guía de tallas', match: (p) => p.startsWith('/sizes'), permission: 'sizes_edit' },
  { href: '/inventory', label: 'Stock global', match: (p) => p.startsWith('/inventory'), permission: 'inventory_view' },
  { href: '/colors', label: 'Colores', match: (p) => p.startsWith('/colors'), permission: 'colors_edit' },
  { href: '/presets', label: 'Presets', match: (p) => p.startsWith('/presets'), permission: 'presets_edit' },
  { href: '/roles', label: 'Roles', match: (p) => p.startsWith('/roles'), ownerOnly: true },
  { href: '/users', label: 'Usuarios', match: (p) => p.startsWith('/users'), ownerOnly: true },
]

export function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { can, isOwner, loading: permLoading } = usePermissions()
  const [email, setEmail] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [showDrop, setShowDrop] = useState(false)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const bellRef = useRef<HTMLDivElement>(null)

  function markRead() {
    localStorage.setItem(LS_KEY, new Date().toISOString())
    setUnread(0)
  }

  async function handleBell() {
    const lastChecked = localStorage.getItem(LS_KEY) ?? new Date(0).toISOString()
    const activity = await fetchActivity(lastChecked)
    setRecentOrders(activity?.orders ?? [])
    setShowDrop((v) => !v)
  }

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
    })

    let cancelled = false
    let canNotify = false
    // Desde cuándo avisar con notificación del navegador: solo lo que llegue
    // después de abrir el admin, no lo viejo.
    let cursor = new Date().toISOString()

    async function poll() {
      // Contador de la campana: pedidos nuevos desde la última vez que se revisó.
      const lastChecked = localStorage.getItem(LS_KEY) ?? new Date(0).toISOString()
      const [badge, fresh] = await Promise.all([fetchActivity(lastChecked), fetchActivity(cursor)])
      if (cancelled) return
      if (badge) setUnread(badge.new_orders)
      if (fresh) {
        cursor = fresh.now
        if (canNotify) {
          for (const o of fresh.orders) {
            const total = o.total ? `$${Number(o.total).toLocaleString('es-CO')}` : ''
            notify('Pedido nuevo 🛍', `${o.customer_name ?? 'Un cliente'} — ${total}`)
          }
          for (const m of fresh.asesor_requests) {
            notify('Cliente quiere asesor 🆘', `+${m.customer_phone}: ${(m.content ?? '').slice(0, 80)}`)
          }
        }
      }
    }

    ensureNotifyPermission().then((ok) => { canNotify = ok })
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
        <div ref={bellRef} className="relative">
          <button
            onClick={handleBell}
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

          {showDrop && (
            <div className="absolute left-0 top-8 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Pedidos nuevos</span>
                <button
                  onClick={() => { markRead(); setShowDrop(false); router.push('/orders') }}
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  Ver todos
                </button>
              </div>
              {recentOrders.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">Sin pedidos nuevos</p>
              ) : (
                <ul>
                  {recentOrders.map((o) => (
                    <li key={o.id}>
                      <button
                        onClick={() => { markRead(); setShowDrop(false); router.push('/orders') }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-xs font-medium text-gray-800 truncate">
                          #{o.id.slice(0, 8).toUpperCase()} — {o.customer_name ?? 'Cliente'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          ${Number(o.total).toLocaleString('es-CO')} · {new Date(o.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-2 text-sm overflow-y-auto">
        {permLoading ? (
          // Skeleton mientras carga permisos
          [1,2,3,4,5].map((i) => (
            <div key={i} className="mx-3 my-1.5 h-8 rounded bg-gray-100 animate-pulse" />
          ))
        ) : (
          NAV.filter((item) => {
            if (item.ownerOnly) return isOwner
            if (item.permission) return can(item.permission)
            return true
          }).map((item) => {
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
          })
        )}
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
