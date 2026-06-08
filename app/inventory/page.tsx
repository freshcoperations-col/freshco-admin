'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Combo {
  size: string | null
  color: string | null
}

export default function InventoryPage() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newSize, setNewSize] = useState('')
  const [newColor, setNewColor] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/inventory', { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setCombos(body.out_of_stock ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save(updated: Combo[]) {
    setSaving(true)
    const res = await botFetch('/api/admin/web/inventory', {
      method: 'PUT',
      body: JSON.stringify({ out_of_stock: updated }),
    })
    setSaving(false)
    if (res.ok) {
      const body = await res.json()
      setCombos(body.out_of_stock ?? updated)
      showToast('Guardado ✅')
    } else {
      showToast('Error al guardar')
    }
  }

  function addCombo() {
    const size = newSize.trim() || null
    const color = newColor.trim() || null
    if (!size && !color) return
    const exists = combos.some((c) => c.size === size && c.color === color)
    if (exists) { showToast('Ya existe esa combinación'); return }
    const updated = [...combos, { size, color }]
    setCombos(updated)
    save(updated)
    setNewSize('')
    setNewColor('')
  }

  function removeCombo(idx: number) {
    const updated = combos.filter((_, i) => i !== idx)
    setCombos(updated)
    save(updated)
  }

  function comboLabel(c: Combo) {
    if (c.size && c.color) return `Talla ${c.size} · ${c.color}`
    if (c.size) return `Talla ${c.size} (todos los colores)`
    if (c.color) return `${c.color} (todas las tallas)`
    return '—'
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold mb-1">Inventario global</h1>
      <p className="text-sm text-gray-500 mb-6">
        Marca combinaciones de talla y/o color como agotadas. Aplica a <strong>todos los productos</strong>:
        si agregas "Talla S · Negro", ningún producto podrá venderse en talla S color Negro.
        Deja un campo en blanco para aplicarlo a todo el color o toda la talla.
      </p>

      {/* Agregar combinación */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Agregar combinación agotada</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Talla <span className="text-gray-400">(vacío = todas)</span></label>
            <input
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              placeholder="S, M, L, XL…"
              className="w-28 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color <span className="text-gray-400">(vacío = todos)</span></label>
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="Negro, Vainilla…"
              className="w-36 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <button
            onClick={addCombo}
            disabled={saving || (!newSize.trim() && !newColor.trim())}
            className="px-4 py-2 text-xs uppercase tracking-wide bg-red-600 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Marcar agotado'}
          </button>
        </div>
      </div>

      {/* Lista de combinaciones */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase">Agotados globalmente</span>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Cargando…</p>
        ) : combos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin combinaciones agotadas. Todo disponible.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {combos.map((c, idx) => (
              <li key={idx} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-800">{comboLabel(c)}</span>
                  {c.size && c.color && (
                    <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">agotado</span>
                  )}
                </div>
                <button
                  onClick={() => removeCombo(idx)}
                  disabled={saving}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                  title="Eliminar — vuelve a estar disponible"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Los cambios aplican inmediatamente a la tienda web. Los clientes verán las tallas/colores deshabilitados en el detalle del producto.
      </p>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
