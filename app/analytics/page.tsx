'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Analytics {
  kpis: {
    total_revenue: number
    total_orders: number
    approved_orders: number
    unique_customers: number
    returning_customers: number
    customers_with_email: number
  }
  by_payment_status: Record<string, number>
  by_order_status: Record<string, number>
  by_source: Record<string, number>
  top_products: { id: string; name: string; units: number; revenue: number }[]
  daily_series: { date: string; revenue: number; orders: number }[]
}

type DateRange = 7 | 30 | 90

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

// Versión corta para el eje Y: $70k, $1.2M, etc.
function formatAxisY(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
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
  const [range, setRange] = useState<DateRange>(30)

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

  // Filtrar serie según el rango seleccionado
  const filteredSeries = daily_series.slice(-range)
  const maxRev = Math.max(...filteredSeries.map((d) => d.revenue), 1)
  const rangeRevenue = filteredSeries.reduce((s, d) => s + d.revenue, 0)
  const rangeOrders = filteredSeries.reduce((s, d) => s + d.orders, 0)

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
    pending:      { label: 'Pendiente',    color: 'bg-amber-400' },
    confirmado:   { label: 'Confirmado',   color: 'bg-amber-400' },
    enviado:      { label: 'En camino',    color: 'bg-blue-500' },
    entregado:    { label: 'Entregado',    color: 'bg-green-500' },
    cancelled:    { label: 'Cancelado',    color: 'bg-gray-400' },
    cancelado:    { label: 'Cancelado',    color: 'bg-gray-400' },
    pago_fallido: { label: 'Pago fallido', color: 'bg-red-400' },
  }

  const conversionRate = kpis.total_orders > 0
    ? Math.round((kpis.approved_orders / kpis.total_orders) * 100)
    : 0

  const rangeLabel = range === 7 ? 'últimos 7 días' : range === 30 ? 'últimos 30 días' : 'últimos 90 días'

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

      {/* KPI Cards — 5 cards, sin ticket promedio */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Ingresos totales"
          value={formatCOP(kpis.total_revenue)}
          sub="Suma de todos los pedidos pagados"
          accent="text-green-700"
        />
        <StatCard
          label="Pedidos pagados"
          value={String(kpis.approved_orders)}
          sub={`${kpis.total_orders} pedidos iniciados en total`}
        />
        <StatCard
          label="Tasa de pago"
          value={`${conversionRate}%`}
          sub={`${kpis.approved_orders} de ${kpis.total_orders} pedidos iniciados terminaron en pago`}
          accent={conversionRate >= 50 ? 'text-green-700' : 'text-amber-600'}
        />
        <StatCard
          label="Número de clientes"
          value={String(kpis.unique_customers)}
          sub={`Identificados por correo · ${kpis.returning_customers} han comprado más de una vez`}
        />
        <StatCard
          label="Pendientes de pago"
          value={String(by_payment_status['pending'] ?? 0)}
          sub="Pedidos con link enviado pero sin confirmar"
          accent={(by_payment_status['pending'] ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
      </div>

      {/* Gráfica de ventas con filtro de fecha */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Ventas — {rangeLabel}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatCOP(rangeRevenue)} · {rangeOrders} pedidos pagados
            </p>
          </div>
          <div className="flex gap-1">
            {([7, 30, 90] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  range === r
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r === 7 ? '7 días' : r === 30 ? '30 días' : '90 días'}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfica: eje Y + barras */}
        <div className="flex gap-2">

          {/* Eje Y — 3 referencias: máximo, mitad, cero */}
          <div className="flex flex-col justify-between text-right flex-shrink-0" style={{ width: '56px', height: '120px' }}>
            <span className="text-xs text-gray-400 font-mono">{formatAxisY(maxRev)}</span>
            <span className="text-xs text-gray-400 font-mono">{formatAxisY(maxRev / 2)}</span>
            <span className="text-xs text-gray-400 font-mono">$0</span>
          </div>

          {/* Área de barras con líneas de referencia */}
          <div className="flex-1 relative" style={{ height: '120px' }}>
            {/* Líneas horizontales de referencia */}
            <div className="absolute inset-x-0 pointer-events-none" style={{ top: 0, height: '96px' }}>
              <div className="absolute inset-x-0 top-0 border-t border-gray-100" />
              <div className="absolute inset-x-0 border-t border-gray-100" style={{ top: '50%' }} />
              <div className="absolute inset-x-0 bottom-0 border-t border-gray-200" />
            </div>

            {/* Barras */}
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-0.5" style={{ height: '120px' }}>
              {filteredSeries.map((d, i) => {
                const BAR_MAX_PX = 96
                const barPx = maxRev > 0 ? Math.round((d.revenue / maxRev) * BAR_MAX_PX) : 0
                const step = range === 7 ? 1 : range === 30 ? 5 : 10
                const showLabel = i % step === 0
                const label = d.date.slice(5).replace('-', '/')
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end min-w-0"
                    style={{ height: '120px' }}
                    title={`${d.date}: ${formatCOP(d.revenue)}${d.orders > 0 ? ` · ${d.orders} pedido${d.orders !== 1 ? 's' : ''}` : ''}`}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-colors ${d.revenue > 0 ? 'bg-blue-500 hover:bg-blue-400' : 'bg-transparent'}`}
                      style={{ height: `${Math.max(barPx, d.revenue > 0 ? 3 : 0)}px` }}
                    />
                    <span
                      className="text-gray-400 font-mono mt-1 overflow-hidden"
                      style={{ fontSize: '8px', opacity: showLabel ? 1 : 0, flexShrink: 0 }}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {filteredSeries.every((d) => d.revenue === 0) && (
          <p className="text-xs text-gray-400 text-center mt-2">Sin ventas aprobadas en este período.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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
      </div>

      {/* Estado de envíos */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Estado de pedidos (envío)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
          {Object.entries(by_order_status)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => {
              const info = orderStatusLabels[status] ?? { label: status, color: 'bg-gray-400' }
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">{info.label}</span>
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
  )
}
