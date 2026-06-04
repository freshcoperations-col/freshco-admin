'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Coupon {
  id: string
  code: string
  discount: number
  description: string | null
  active: boolean
  usage_limit: number | null
  used_count: number
  expires_at: string | null
  created_at: string
}

const EMPTY_FORM = { code: '', discount: '', description: '', usage_limit: '', expires_at: '' }

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/coupons', { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setCoupons(body.coupons ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handleCreate() {
    setError(null)
    const discountPct = Number(form.discount)
    if (!form.code.trim() || isNaN(discountPct) || discountPct <= 0 || discountPct > 100) {
      setError('Código y descuento (1-100%) son requeridos.')
      return
    }
    setSaving(true)
    const res = await botFetch('/api/admin/web/coupons', {
      method: 'POST',
      body: JSON.stringify({
        code: form.code.trim().toUpperCase(),
        discount: discountPct / 100,
        description: form.description.trim() || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        expires_at: form.expires_at || null,
      }),
    })
    setSaving(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error || 'No se pudo crear.'); return }
    showToast(`Cupón ${body.coupon?.code} creado ✅`)
    setShowForm(false)
    setForm(EMPTY_FORM)
    load()
  }

  async function toggleActive(c: Coupon) {
    await botFetch(`/api/admin/web/coupons/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !c.active }),
    })
    setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x))
    showToast(c.active ? 'Cupón desactivado.' : 'Cupón activado.')
  }

  async function resetCount(c: Coupon) {
    if (!confirm(`¿Reiniciar el contador de usos de ${c.code} a 0?`)) return
    await botFetch(`/api/admin/web/coupons/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ used_count: 0 }),
    })
    setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, used_count: 0 } : x))
    showToast('Contador reiniciado.')
  }

  async function deleteCoupon(c: Coupon) {
    if (!confirm(`¿Eliminar el cupón ${c.code}? Esta acción no se puede deshacer.`)) return
    await botFetch(`/api/admin/web/coupons/${c.id}`, { method: 'DELETE' })
    setCoupons((prev) => prev.filter((x) => x.id !== c.id))
    showToast(`Cupón ${c.code} eliminado.`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Cupones de descuento</h1>
          <p className="text-sm text-gray-500">Crea, activa, desactiva y elimina códigos de descuento.</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(null) }}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded">
          + Nuevo cupón
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">Nuevo cupón</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Código</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="BIENVENIDO20" className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Descuento (%)</label>
              <input type="number" min="1" max="100" value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                placeholder="20" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Descripción (opcional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Primera compra" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Límite de usos (vacío = ilimitado)</label>
              <input type="number" min="1" value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                placeholder="100" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Expiración (vacío = nunca)</label>
              <input type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-xs border border-gray-300 rounded text-gray-700">
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50">
              {saving ? 'Creando…' : 'Crear cupón'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descuento</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Usos</th>
              <th className="px-4 py-2">Expira</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin cupones. Crea uno arriba.</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono font-bold text-sm">{c.code}</td>
                <td className="px-4 py-3 font-medium text-green-700">{Math.round(c.discount * 100)}%</td>
                <td className="px-4 py-3 text-xs text-gray-600">{c.description ?? '—'}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={c.usage_limit && c.used_count >= c.usage_limit ? 'text-red-600 font-medium' : 'text-gray-700'}>
                    {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </span>
                  <button onClick={() => resetCount(c)} className="ml-2 text-[10px] text-gray-400 hover:text-gray-600 underline">
                    reiniciar
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-CO') : 'Nunca'}
                </td>
                <td className="px-4 py-3">
                  {c.active
                    ? <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Activo</span>
                    : <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(c)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded mr-2">
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => deleteCoupon(c)}
                    className="px-3 py-1 text-xs border border-red-200 text-red-700 rounded">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
