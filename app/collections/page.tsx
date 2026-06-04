'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Collection {
  id: string
  label: string
  description: string | null
  sort_order: number
  active: boolean
  created_at: string
}

const INPUT = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formLabel, setFormLabel] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formOrder, setFormOrder] = useState('0')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/collections')
    if (res.ok) {
      const body = await res.json()
      setCollections(body.collections ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setFormLabel('')
    setFormDesc('')
    setFormOrder(String(collections.length))
    setCreating(true)
  }

  function openEdit(c: Collection) {
    setCreating(false)
    setEditing(c)
    setFormLabel(c.label)
    setFormDesc(c.description ?? '')
    setFormOrder(String(c.sort_order))
  }

  function closeForm() { setCreating(false); setEditing(null) }

  async function handleSave() {
    if (!formLabel.trim()) { showToast('El nombre es requerido'); return }
    setSaving(true)
    try {
      let res: Response
      if (editing) {
        res = await botFetch(`/api/admin/web/collections/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ label: formLabel.trim(), description: formDesc.trim() || null, sort_order: Number(formOrder) }),
        })
      } else {
        res = await botFetch('/api/admin/web/collections', {
          method: 'POST',
          body: JSON.stringify({ label: formLabel.trim(), description: formDesc.trim() || null, sort_order: Number(formOrder) }),
        })
      }
      if (res.ok) {
        showToast(editing ? 'Colección actualizada ✅' : 'Colección creada ✅')
        closeForm()
        load()
      } else {
        const b = await res.json().catch(() => ({}))
        showToast(b.error || 'Error al guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(c: Collection) {
    const res = await botFetch(`/api/admin/web/collections/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ active: !c.active }),
    })
    if (res.ok) {
      setCollections((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x))
    }
  }

  async function handleDelete(id: string) {
    const res = await botFetch(`/api/admin/web/collections/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCollections((prev) => prev.filter((x) => x.id !== id))
      showToast('Colección eliminada')
    } else {
      const b = await res.json().catch(() => ({}))
      showToast(b.error || 'Error al eliminar')
    }
    setConfirmDelete(null)
  }

  const showForm = creating || !!editing

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Colecciones</h1>
          <p className="text-sm text-gray-500">
            Agrupa los productos por temática. Cada colección aparece en el catálogo y en el bot.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded"
        >
          + Nueva colección
        </button>
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">{editing ? `Editando: ${editing.label}` : 'Nueva colección'}</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
            <input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} className={INPUT}
              placeholder="Todo Melo (O Eso Parece)" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Descripción (opcional)</label>
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
              rows={2} className={INPUT} placeholder="Descripción corta de la colección" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Orden de aparición</label>
            <input type="number" value={formOrder} onChange={(e) => setFormOrder(e.target.value)}
              className={`${INPUT} w-24`} min="0" />
          </div>
          {!editing && (
            <p className="text-xs text-gray-400">
              El ID (slug) se genera automáticamente del nombre. Por ejemplo "Todo Melo" → <code>todo-melo</code>.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear colección'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="text-sm text-gray-400">Cargando…</div>
      ) : collections.length === 0 ? (
        <div className="text-sm text-gray-400">Sin colecciones. Crea la primera.</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Slug (ID)</th>
                <th className="px-4 py-2 text-left">Descripción</th>
                <th className="px-4 py-2 text-center">Orden</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.id}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={c.description ?? ''}>
                    {c.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{c.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActive(c)}
                      className={`px-2 py-0.5 text-xs rounded ${c.active
                        ? 'bg-green-100 text-green-700 hover:bg-orange-50 hover:text-orange-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700'}`}>
                      {c.active ? 'Activa' : 'Oculta'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)}
                        className="text-xs text-gray-500 hover:text-gray-900 underline">
                        Editar
                      </button>
                      {confirmDelete === c.id ? (
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-gray-500">¿Eliminar?</span>
                          <button onClick={() => handleDelete(c.id)}
                            className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">Sí</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-0.5 bg-gray-200 rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)}
                          className="text-gray-300 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
