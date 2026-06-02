'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { botFetch } from '@/lib/api'

interface Kpis {
  orders_today: number
  pending: number
  approved_pending_shipment: number
  in_transit: number
}

export default function AdminHome() {
  const [kpis, setKpis] = useState<Kpis | null>(null)

  useEffect(() => {
    botFetch('/api/admin/web/kpis')
      .then((r) => (r.ok ? r.json() : null))
      .then(setKpis)
      .catch(() => setKpis(null))
  }, [])

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold mb-1">Inicio</h1>
      <p className="text-sm text-gray-500 mb-6">Resumen de la operación.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Pedidos hoy" value={kpis?.orders_today} />
        <KpiCard
          label="Pendientes de pago"
          value={kpis?.pending}
          accent="text-amber-600"
        />
        <KpiCard
          label="Por despachar"
          value={kpis?.approved_pending_shipment}
          accent="text-blue-600"
          href="/orders"
        />
        <KpiCard
          label="En camino"
          value={kpis?.in_transit}
          accent="text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link
          href="/orders"
          className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition"
        >
          <h3 className="text-sm font-semibold mb-1">Pedidos</h3>
          <p className="text-xs text-gray-500">
            Lista de órdenes, marcar como enviado, cancelar.
          </p>
        </Link>
        <Link
          href="/products"
          className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition"
        >
          <h3 className="text-sm font-semibold mb-1">Productos</h3>
          <p className="text-xs text-gray-500">
            Etiquetar con IA, editar tags, ver catálogo.
          </p>
        </Link>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
  href,
}: {
  label: string
  value: number | undefined
  accent?: string
  href?: string
}) {
  const inner = (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>
        {value ?? '—'}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
