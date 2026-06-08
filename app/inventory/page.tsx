'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface InventoryEntry {
  id: string
  size: string
  color: string
  quantity: number
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Form para agregar
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')
  const [newQty, setNewQty] = useState('0')

  // Edición inline de cantidad
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/inventory', { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setInventory(body.inventory ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addOrUpdate() {
    const size = newSize.trim()
    const color = newColor.trim()
    const quantity = Math.max(0, Number(newQty) || 0)
    if (!size || !color) { showToast('Ingresa talla y color'); return }

    setSaving('add')
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'POST',
      body: JSON.stringify({ size, color, quantity }),
    })
    setSaving(null)
    if (res.ok) {
      setNewSize('')
      setNewColor('')
      setNewQty('0')
      await load()
      showToast('Guardado ✅')
    } else {
      showToast('Error al guardar')
    }
  }

  async function saveEdit(entry: InventoryEntry) {
    const qty = Math.max(0, Number(editQty) || 0)
    setSaving(entry.id)
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'POST',
      body: JSON.stringify({ size: entry.size, color: entry.color, quantity: qty }),
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
    if (!confirm(`¿Eliminar ${entry.size} ${entry.color} del inventario?`)) return
    setSaving(entry.id)
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'DELETE',
      body: JSON.stringify({ size: entry.size, color: entry.color }),
    })
    setSaving(null)
    if (res.ok) {
      setInventory((prev) => prev.filter((e) => e.id !== entry.id))
      showToast('Eliminado')
    } else {
      showToast('Error al eliminar')
    }
  }

  // Agrupar por color para mostrar mejor
  const byColor = inventory.reduce<Record<string, InventoryEntry[]>>((acc, e) => {
    if (!acc[e.color]) acc[e.color] = []
    acc[e.color].push(e)
    return acc
  }, {})

  const totalUnits = inventory.reduce((s, e) => s + e.quantity, 0)
  const agotados = inventory.filter((e) => e.quantity === 0).length

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1">Inventario Global</h1>
      <p className="text-sm text-gray-500 mb-2">
        Lleva el conteo de prendas disponibles por talla y color. Aplica a <strong>todos los productos</strong>: si "Vainilla S" llega a 0,
        ningún producto podrá venderse en esa combinación. El stock baja automáticamente al confirmar un pago.
      </p>

      {/* Resumen rápido */}
      {!loading && inventory.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            <p className="text-xs text-gray-500 mt-0.5">Unidades totales</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
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

      {/* Agregar nueva combinación */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Agregar / actualizar stock</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Talla</label>
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              placeholder="S, M, L, XL…"
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color</label>
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              placeholder="Negro, Vainilla…"
              className="w-36 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
            <input
              type="number"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
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
          Si la combinación ya existe, actualiza la cantidad. Si es nueva, la crea.
        </p>
      </div>

      {/* Tabla de inventario */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando inventario…</p>
      ) : inventory.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400">No hay stock registrado aún.</p>
          <p className="text-xs text-gray-400 mt-1">Agrega combinaciones de talla y color con sus cantidades disponibles.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Color</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Talla</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(byColor).map(([color, entries]) =>
                entries.map((entry, idx) => (
                  <tr key={entry.id} className={entry.quantity === 0 ? 'bg-red-50' : ''}>
                    {/* Color: solo en la primera fila del grupo */}
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {idx === 0 ? color : ''}
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
                          <button
                            onClick={() => saveEdit(entry)}
                            disabled={saving === entry.id}
                            className="text-xs text-white bg-gray-900 px-2 py-1 rounded disabled:opacity-40"
                          >
                            OK
                          </button>
                          <button onClick={() => setEditId(null)} className="text-xs text-gray-400">
                            ✕
                          </button>
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
                      <button
                        onClick={() => remove(entry)}
                        disabled={saving === entry.id}
                        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Haz clic en la cantidad para editarla. El stock baja automáticamente con cada venta confirmada por Wompi.
      </p>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
