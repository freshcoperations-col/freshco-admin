'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Analytics {
  kpis: {
    total_revenue: number
    total_orders: number
    approved_orders: number
    avg_order_value: number
    unique_customers: number
    returning_customers: number
  }
  by_payment_status: Record<string, number>
  by_order_status: Record<string, number>
  by_source: Record<string, number>
  top_products: { id: string; name: string; units: number; revenue: number }[]
  daily_series: { date: string; revenue: number; orders: number }[]
}

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Bar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await botFetch('/api/analytics', { method: 'GET' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-1">Analíticas</h1>
        <p className="text-sm text-gray-400 mt-8">Cargando datos...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-1">Analíticas</h1>
        <p className="text-sm text-red-500 mt-8">No se pudieron cargar los datos.</p>
      </div>
    )
  }

  const { kpis, by_payment_status, by_order_status, top_products, daily_series } = data
  const last14 = daily_series.slice(-14)
  const last30Revenue = daily_series.reduce((s, d) => s + d.revenue, 0)
  const maxRev = Math.max(...last14.map((d) => d.revenue), 1)
  const maxProductRevenue = Math.max(...top_products.map((p) => p.revenue), 1)
  const totalPayments = Object.values(by_payment_status).reduce((a, b) => a + b, 0) || 1
  const totalStatuses = Object.values(by_order_status).reduce((a, b) => a + b, 0) || 1

  const paymentLabels: Record<string, { label: string; color: string }> = {
    approved: { label: 'Pagado',    color: 'bg-green-500' },
    pending:  { label: 'Pendiente', color: 'bg-amber-400' },
    declined: { label: 'Declinado', color: 'bg-red-400' },
    voided:   { label: 'Anulado',   color: 'bg-gray-400' },
    error:    { label: 'Error',     color: 'bg-orange-400' },
  }

  const orderStatusLabels: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Pendiente', color: 'bg-amber-400' },
    enviado:   { label: 'En camino', color: 'bg-blue-500' },
    entregado: { label: 'Entregado', color: 'bg-green-500' },
    cancelled: { label: 'Cancelado', color: 'bg-gray-400' },
  }

  const conversionRate = kpis.total_orders > 0
    ? Math.round((kpis.approved_orders / kpis.total_orders) * 100)
    : 0

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Analíticas</h1>
          <p className="text-sm text-gray-500">Ventas e información relevante del negocio.</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded"
        >
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Ingresos totales"
          value={formatCOP(kpis.total_revenue)}
          sub={`${formatCOP(last30Revenue)} últimos 30 días`}
          accent="text-green-700"
        />
        <StatCard
          label="Pedidos aprobados"
          value={String(kpis.approved_orders)}
          sub={`de ${kpis.total_orders} en total`}
        />
        <StatCard
          label="Ticket promedio"
          value={formatCOP(Math.round(kpis.avg_order_value))}
          sub="en pedidos aprobados"
        />
        <StatCard
          label="Clientes únicos"
          value={String(kpis.unique_customers)}
          sub={`${kpis.returning_customers} con más de 1 pedido`}
        />
        <StatCard
          label="Tasa de conversión"
          value={`${conversionRate}%`}
          sub="pedidos pagados vs total"
          accent={conversionRate >= 50 ? 'text-green-700' : 'text-amber-600'}
        />
        <StatCard
          label="Pendientes de pago"
          value={String(by_payment_status['pending'] ?? 0)}
          sub="esperando confirmación"
          accent={(by_payment_status['pending'] ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Gráfica de ventas — 14 días */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Ingresos — últimos 14 días</h3>
          <div className="flex items-end gap-1.5 h-28">
            {last14.map((d) => {
              const h = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0
              const label = d.date.slice(5).replace('-', '/')
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${label}: ${formatCOP(d.revenue)} (${d.orders} pedidos)`}
                >
                  <div
                    className={`w-full rounded-t-sm ${d.revenue > 0 ? 'bg-blue-500' : 'bg-gray-100'}`}
                    style={{ height: `${Math.max(h, d.revenue > 0 ? 6 : 0)}%` }}
                  />
                  <span className="text-gray-400 font-mono" style={{ fontSize: '9px' }}>{label}</span>
                </div>
              )
            })}
          </div>
          {last14.every((d) => d.revenue === 0) && (
            <p className="text-xs text-gray-400 text-center mt-2">Sin ventas aprobadas en este período.</p>
          )}
        </div>

        {/* Top productos */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Top productos por ingreso</h3>
          {top_products.length === 0 ? (
            <p className="text-xs text-gray-400">Sin ventas registradas aún.</p>
          ) : (
            <div className="space-y-3">
              {top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{p.name}</span>
                  <span className="text-xs font-mono text-gray-600 w-20 text-right">{formatCOP(p.revenue)}</span>
                  <div className="w-24">
                    <Bar pct={(p.revenue / maxProductRevenue) * 100} color="bg-indigo-400" />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{p.units}u</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estado de pagos */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Estado de pagos</h3>
          <div className="space-y-3">
            {Object.entries(by_payment_status)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const info = paymentLabels[status] ?? { label: status, color: 'bg-gray-400' }
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">{info.label}</span>
                    <Bar pct={(count / totalPayments) * 100} color={info.color} />
                    <span className="text-sm font-mono text-gray-700 w-6 text-right">{count}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {Math.round((count / totalPayments) * 100)}%
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Estado de envíos */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Estado de pedidos (envío)</h3>
          <div className="space-y-3">
            {Object.entries(by_order_status)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const info = orderStatusLabels[status] ?? { label: status, color: 'bg-gray-400' }
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">{info.label}</span>
                    <Bar pct={(count / totalStatuses) * 100} color={info.color} />
                    <span className="text-sm font-mono text-gray-700 w-6 text-right">{count}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {Math.round((count / totalStatuses) * 100)}%
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
