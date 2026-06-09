'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Color {
  id: string
  name: string
  hex: string
  sort_order: number
}

export default function ColorsPage() {
  const [colors, setColors] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#cccccc')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/colors')
    if (res.ok) {
      const body = await res.json()
      setColors(body.colors ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addColor() {
    const name = newName.trim()
    if (!name) { showToast('Ingresa un nombre'); return }
    setSaving(true)
    const res = await botFetch('/api/admin/web/colors', {
      method: 'POST',
      body: JSON.stringify({ name, hex: newHex, sort_order: colors.length }),
    })
    setSaving(false)
    if (res.ok) {
      setNewName('')
      setNewHex('#cccccc')
      await load()
      showToast('Color creado ✅')
    } else {
      const b = await res.json().catch(() => ({}))
      showToast(b.error ?? 'Error al crear')
    }
  }

  async function deleteColor(id: string) {
    if (!confirm('¿Eliminar este color? Si tiene stock en inventario o productos con este color, podría causar inconsistencias.')) return
    setDeleting(id)
    const res = await botFetch(`/api/admin/web/colors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      setColors((prev) => prev.filter((c) => c.id !== id))
      showToast('Eliminado')
    } else {
      showToast('Error al eliminar')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Colores</h1>
      <p className="text-sm text-gray-500 mb-6">
        Define la paleta de colores de Freshco. Estos colores se usan para seleccionar variantes en productos
        y en el inventario global. El círculo muestra cómo se verá el swatch en la tienda.
      </p>

      {/* Formulario agregar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Agregar color</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addColor()}
              placeholder="Vainilla, Negro, Azul Cielo…"
              className="w-48 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newHex}
                onChange={(e) => setNewHex(e.target.value)}
                className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <span className="text-xs text-gray-400 font-mono">{newHex}</span>
            </div>
          </div>
          <button
            onClick={addColor}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>

      {/* Grid de colores */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : colors.length === 0 ? (
        <p className="text-sm text-gray-400">No hay colores creados aún.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {colors.map((color) => (
            <div
              key={color.id}
              className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 group"
            >
              {/* Swatch */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: color.hex,
                  border: color.hex.toUpperCase() === '#FFFFFF' ? '1px solid #ddd' : 'none',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{color.name}</p>
                <p className="text-xs text-gray-400 font-mono">{color.hex}</p>
              </div>
              <button
                onClick={() => deleteColor(color.id)}
                disabled={deleting === color.id}
                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                title="Eliminar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Los colores eliminados no desaparecen del inventario ni de los productos que ya los tengan asignados.
      </p>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
