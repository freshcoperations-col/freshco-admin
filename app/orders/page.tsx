'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { botFetch } from '@/lib/api'
import { OrderDrawer } from '@/components/OrderDrawer'

interface OrderItem {
  product_id?: string
  product_name?: string
  size?: string
  color?: string
  quantity?: number
  unit_price?: number
}

interface Order {
  id: string
  short_id: string
  customer_phone: string
  customer_name: string | null
  customer_email: string | null
  items: OrderItem[] | null
  total: number
  payment_status: string
  status: string
  paid_at: string | null
  tracking_number: string | null
  shipping_carrier: string | null
  shipped_at: string | null
  created_at: string
  shipping_address: string | null
  source: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: '__pending_ship', label: 'Por despachar' },
  { value: 'pending', label: 'Pago pendiente', kind: 'payment' as const },
  { value: 'cod', label: 'Contraentrega', kind: 'payment' as const },
  { value: 'approved', label: 'Pagados', kind: 'payment' as const },
  { value: 'declined', label: 'Declinados', kind: 'payment' as const },
  { value: 'enviado', label: 'Enviados', kind: 'order' as const },
  { value: 'entregado', label: 'Entregados', kind: 'order' as const },
  { value: 'cancelado', label: 'Cancelados', kind: 'order' as const },
]

function OrdersPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get('filter') === 'por-despachar' ? '__pending_ship' : ''
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(initial)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const query = new URLSearchParams()
    if (filter === '__pending_ship') {
      query.set('payment_status', 'approved')
    } else {
      const opt = STATUS_OPTIONS.find((o) => o.value === filter)
      if (opt && 'kind' in opt) {
        if (opt.kind === 'payment') query.set('payment_status', filter)
        if (opt.kind === 'order') query.set('status', filter)
      }
    }
    if (search.trim()) query.set('search', search.trim())
    query.set('limit', '100')

    const res = await botFetch(`/api/admin/web/orders?${query.toString()}`, { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      let rows: Order[] = body.orders ?? []
      if (filter === '__pending_ship') {
        rows = rows.filter((o) => !o.tracking_number && o.status !== 'cancelado' && o.status !== 'entregado')
      }
      setOrders(rows)
    } else {
      setOrders([])
    }
    setLoading(false)
  }, [filter, search])

  useEffect(() => {
    load()
  }, [load])

  function onFilterChange(v: string) {
    setFilter(v)
    if (v === '__pending_ship') {
      router.replace('/orders?filter=por-despachar')
    } else {
      router.replace('/orders')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Pedidos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Click en una fila para ver el detalle del pedido y del cliente.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded bg-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Buscar por #ID, nombre, email o teléfono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[280px] px-3 py-2 text-sm border border-gray-300 rounded bg-white"
        />
        <button
          onClick={load}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded"
        >
          Refrescar
        </button>
      </div>

      {/* Tabla — visible solo en desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Pedido</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Celular</th>
              <th className="px-4 py-2">Dirección</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Estado pago</th>
              <th className="px-4 py-2">Estado envío</th>
              <th className="px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No hay pedidos.</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} onClick={() => setSelected(o.short_id)} className="border-t border-gray-100 cursor-pointer hover:bg-blue-50">
                  <td className="px-4 py-3 font-mono text-xs">#{o.short_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customer_name ?? '—'}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[160px]">{o.customer_email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">+{o.customer_phone}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                    <span className="truncate block" title={o.shipping_address ?? ''}>{o.shipping_address ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{(o.items ?? []).map((it) => `${it.quantity ?? 1}× ${it.product_name ?? it.product_id}`).join(', ') || '—'}</td>
                  <td className="px-4 py-3 font-medium">${Number(o.total).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-3"><PaymentBadge status={o.payment_status} /></td>
                  <td className="px-4 py-3">
                    {o.tracking_number ? (
                      <div className="text-xs"><div className="font-medium">{o.shipping_carrier}</div><div className="font-mono text-gray-500">{o.tracking_number}</div></div>
                    ) : <span className="text-xs text-gray-400">{o.status ?? '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString('es-CO')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — visible solo en móvil */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center text-gray-400 text-sm">Cargando…</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center text-gray-400 text-sm">No hay pedidos.</div>
        ) : (
          orders.map((o) => (
            <div key={o.id} onClick={() => setSelected(o.short_id)}
              className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-bold">#{o.short_id}</span>
                <PaymentBadge status={o.payment_status} />
              </div>
              <div className="font-medium text-sm">{o.customer_name ?? '—'}</div>
              <div className="text-xs text-gray-500 font-mono mb-0.5">+{o.customer_phone}</div>
              {o.shipping_address && (
                <div className="text-xs text-gray-400 mb-2 truncate">{o.shipping_address}</div>
              )}
              <div className="text-xs text-gray-600 mb-2">
                {(o.items ?? []).map((it) => `${it.quantity ?? 1}× ${it.product_name}`).join(', ') || '—'}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">${Number(o.total).toLocaleString('es-CO')}</span>
                <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('es-CO')}</span>
              </div>
              {o.tracking_number && (
                <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                  📦 {o.shipping_carrier} · {o.tracking_number}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <OrderDrawer
        shortId={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Aprobado', cls: 'bg-green-100 text-green-700' },
    declined: { label: 'Declinado', cls: 'bg-red-100 text-red-700' },
    voided: { label: 'Anulado', cls: 'bg-gray-100 text-gray-700' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
    cod: { label: 'Contraentrega', cls: 'bg-blue-100 text-blue-700' },
  }
  const v = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-1 text-xs rounded ${v.cls}`}>{v.label}</span>
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Cargando…</div>}>
      <OrdersPageInner />
    </Suspense>
  )
}
