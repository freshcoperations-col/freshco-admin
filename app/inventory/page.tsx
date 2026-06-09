'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface InventoryEntry {
  id: string
  garment_type: string
  size: string
  color: string
  quantity: number
}

interface GarmentType {
  id: string
  label: string
}

interface ColorEntry {
  id: string
  name: string
  hex: string
}

interface LogEntry {
  id: string
  garment_type: string
  size: string
  color: string
  change_qty: number
  reason: string
  order_id: string | null
  created_at: string
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([])
  const [colorPalette, setColorPalette] = useState<ColorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [filterGarment, setFilterGarment] = useState<string>('all')
  const [log, setLog] = useState<LogEntry[]>([])
  const [showLog, setShowLog] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)

  // Form para agregar
  const [newGarmentType, setNewGarmentType] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newQty, setNewQty] = useState('0')

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, gtRes, colorRes] = await Promise.all([
      botFetch('/api/admin/web/inventory', { method: 'GET' }),
      botFetch('/api/admin/web/size-guide', { method: 'GET' }),
      botFetch('/api/admin/web/colors', { method: 'GET' }),
    ])
    if (invRes.ok) {
      const body = await invRes.json()
      setInventory(body.inventory ?? [])
    }
    if (gtRes.ok) {
      const body = await gtRes.json()
      const gts = (body.guides ?? []).map((g: { garment_type: string; label?: string }) => ({
        id: g.garment_type,
        label: g.label ?? g.garment_type,
      }))
      setGarmentTypes(gts)
      setNewGarmentType((prev) => prev || gts[0]?.id || '')
    }
    if (colorRes.ok) {
      const body = await colorRes.json()
      setColorPalette(body.colors ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadLog() {
    setLoadingLog(true)
    const res = await botFetch('/api/admin/web/inventory-log?limit=50')
    if (res.ok) {
      const body = await res.json()
      setLog(body.log ?? [])
    }
    setLoadingLog(false)
  }

  function toggleLog() {
    const next = !showLog
    setShowLog(next)
    if (next && log.length === 0) loadLog()
  }

  function garmentLabelFor(gt: string) {
    return garmentTypes.find((g) => g.id === gt)?.label ?? gt || 'General'
  }

  async function addOrUpdate() {
    const garment_type = newGarmentType.trim()
    const size = newSize.trim()
    const color = newColor.trim()
    const quantity = Math.max(0, Number(newQty) || 0)
    if (!size || !color) { showToast('Ingresa talla y color'); return }

    setSaving('add')
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'POST',
      body: JSON.stringify({ garment_type, size, color, quantity }),
    })
    setSaving(null)
    if (res.ok) {
      setNewSize('')
      setNewColor('')
      setNewQty('0')
      await load()
      showToast('Guardado ✅')
    } else {
      const b = await res.json().catch(() => ({}))
      showToast(b.error ?? 'Error al guardar')
    }
  }

  async function saveEdit(entry: InventoryEntry) {
    const qty = Math.max(0, Number(editQty) || 0)
    setSaving(entry.id)
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'POST',
      body: JSON.stringify({ garment_type: entry.garment_type, size: entry.size, color: entry.color, quantity: qty }),
    })
    setSaving(null)
    setEditId(null)
    if (res.ok) {
      setInventory((prev) => prev.map((e) => e.id === entry.id ? { ...e, quantity: qty } : e))
      showToast('Actualizado ✅')
    } else {
      showToast('Error al actualizar')
    }
  }

  async function remove(entry: InventoryEntry) {
    const label = garmentLabel(entry.garment_type)
    if (!confirm(`¿Eliminar ${label} ${entry.color} ${entry.size}?`)) return
    setSaving(entry.id)
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'DELETE',
      body: JSON.stringify({ garment_type: entry.garment_type, size: entry.size, color: entry.color }),
    })
    setSaving(null)
    if (res.ok) {
      setInventory((prev) => prev.filter((e) => e.id !== entry.id))
      showToast('Eliminado')
    } else {
      showToast('Error al eliminar')
    }
  }

  function garmentLabel(gt: string) {
    return garmentTypes.find((g) => g.id === gt)?.label ?? gt
  }

  // Filtrar y agrupar por prenda
  const filtered = filterGarment === 'all' ? inventory : inventory.filter((e) => e.garment_type === filterGarment)

  const byGarment = filtered.reduce<Record<string, InventoryEntry[]>>((acc, e) => {
    const key = e.garment_type || '__general__'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const totalUnits = filtered.reduce((s, e) => s + e.quantity, 0)
  const agotados = filtered.filter((e) => e.quantity === 0).length

  // Garment types que aparecen en el inventario actual
  const usedGarments = Array.from(new Set(inventory.map((e) => e.garment_type)))

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1">Inventario Global</h1>
      <p className="text-sm text-gray-500 mb-4">
        Lleva el conteo de prendas por tipo, talla y color. El stock baja automáticamente al confirmar un pago.
        Si "Camisetas Vainilla S" llega a 0, ningún producto de ese tipo podrá venderse en esa combinación.
      </p>

      {/* Filtro por prenda */}
      {usedGarments.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterGarment('all')}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterGarment === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
          >
            Todas
          </button>
          {usedGarments.map((gt) => (
            <button
              key={gt}
              onClick={() => setFilterGarment(gt)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterGarment === gt ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
            >
              {garmentLabel(gt)}
            </button>
          ))}
        </div>
      )}

      {/* Resumen */}
      {!loading && inventory.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            <p className="text-xs text-gray-500 mt-0.5">Unidades</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Combinaciones</p>
          </div>
          {agotados > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-700">{agotados}</p>
              <p className="text-xs text-red-500 mt-0.5">Agotadas</p>
            </div>
          )}
        </div>
      )}

      {/* Formulario agregar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Agregar / actualizar stock</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Prenda</label>
            <select
              value={newGarmentType}
              onChange={(e) => setNewGarmentType(e.target.value)}
              className="w-36 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            >
              {garmentTypes.length === 0 && <option value="">Sin tipos</option>}
              {garmentTypes.map((gt) => (
                <option key={gt.id} value={gt.id}>{gt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Talla</label>
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              placeholder="S, M, 28…"
              className="w-20 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color</label>
            {colorPalette.length > 0 ? (
              <div className="flex flex-wrap gap-2 items-center">
                {colorPalette.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setNewColor(c.name)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c.hex,
                      border: newColor === c.name ? '3px solid #111' : c.hex.toUpperCase() === '#FFFFFF' ? '1px solid #ddd' : '1px solid transparent',
                      boxShadow: newColor === c.name ? '0 0 0 1px #fff, 0 0 0 3px #111' : '0 1px 3px rgba(0,0,0,0.2)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                ))}
                {newColor && (
                  <span className="text-xs text-gray-600 font-medium">{newColor}</span>
                )}
              </div>
            ) : (
              <input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="Vainilla…"
                className="w-32 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
            <input
              type="number"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              className="w-20 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <button
            onClick={addOrUpdate}
            disabled={saving === 'add' || !newSize.trim() || !newColor.trim()}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-40"
          >
            {saving === 'add' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Si ya existe para esa prenda + talla + color, actualiza la cantidad.
        </p>
      </div>

      {/* Tabla por tipo de prenda */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando inventario…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400">No hay stock registrado aún.</p>
          <p className="text-xs text-gray-400 mt-1">Agrega combinaciones de prenda, talla y color.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byGarment).map(([garmentKey, entries]) => {
            const label = garmentKey === '__general__' ? 'General' : garmentLabel(garmentKey)
            const groupTotal = entries.reduce((s, e) => s + e.quantity, 0)
            const groupOos = entries.filter((e) => e.quantity === 0).length

            // Agrupar por color dentro de cada prenda
            const byColor = entries.reduce<Record<string, InventoryEntry[]>>((acc, e) => {
              if (!acc[e.color]) acc[e.color] = []
              acc[e.color].push(e)
              return acc
            }, {})

            return (
              <div key={garmentKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{groupTotal} uds</span>
                    {groupOos > 0 && (
                      <span className="text-red-500">{groupOos} agotada{groupOos > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Color</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Talla</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Stock</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(byColor).map(([color, colorEntries]) => {
                      const colorHex = colorPalette.find((c) => c.name === color)?.hex ?? '#cccccc'
                      return colorEntries.map((entry, idx) => (
                        <tr key={entry.id} className={entry.quantity === 0 ? 'bg-red-50' : ''}>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {idx === 0 ? (
                              <div className="flex items-center gap-2">
                                <div style={{
                                  width: 18, height: 18, borderRadius: '50%', background: colorHex, flexShrink: 0,
                                  border: colorHex.toUpperCase() === '#FFFFFF' ? '1px solid #ddd' : 'none',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                }} />
                                <span>{color}</span>
                              </div>
                            ) : ''}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{entry.size}</td>
                          <td className="px-4 py-2.5 text-right">
                            {editId === entry.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(entry)
                                    if (e.key === 'Escape') setEditId(null)
                                  }}
                                  autoFocus
                                  className="w-20 px-2 py-1 text-sm border border-gray-900 rounded focus:outline-none text-right"
                                />
                                <button onClick={() => saveEdit(entry)} disabled={saving === entry.id}
                                  className="text-xs text-white bg-gray-900 px-2 py-1 rounded disabled:opacity-40">OK</button>
                                <button onClick={() => setEditId(null)} className="text-xs text-gray-400">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditId(entry.id); setEditQty(String(entry.quantity)) }}
                                className="group flex items-center justify-end gap-2 ml-auto"
                              >
                                {entry.quantity === 0 ? (
                                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">Agotado</span>
                                ) : (
                                  <span className={`font-semibold ${entry.quantity <= 3 ? 'text-amber-600' : 'text-gray-900'}`}>
                                    {entry.quantity}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => remove(entry)} disabled={saving === entry.id}
                              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40">
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Haz clic en la cantidad para editarla. El stock baja automáticamente con cada venta confirmada.
      </p>

      {/* Historial de movimientos */}
      <div className="mt-8">
        <button
          onClick={toggleLog}
          className="text-sm text-gray-500 hover:text-gray-900 underline"
        >
          {showLog ? '▲ Ocultar historial' : '▼ Ver historial de movimientos'}
        </button>

        {showLog && (
          <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Últimos 50 movimientos</span>
              <button onClick={loadLog} disabled={loadingLog} className="text-xs text-gray-400 hover:text-gray-700">
                {loadingLog ? 'Cargando…' : '↻ Actualizar'}
              </button>
            </div>
            {loadingLog ? (
              <p className="px-4 py-4 text-xs text-gray-400">Cargando…</p>
            ) : log.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400">Sin movimientos registrados aún.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Fecha</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Prenda / Talla / Color</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-semibold">Cambio</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString('es-CO', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {garmentLabelFor(entry.garment_type)} · {entry.size} · {entry.color}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${entry.change_qty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {entry.change_qty > 0 ? '+' : ''}{entry.change_qty}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {entry.reason === 'sale' ? '🛍 Venta' : entry.reason === 'manual_set' ? '✏️ Ajuste' : '🗑 Eliminado'}
                        {entry.order_id && (
                          <span className="ml-1 text-gray-400">#{entry.order_id.slice(0, 8).toUpperCase()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
