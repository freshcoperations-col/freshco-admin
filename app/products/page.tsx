'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { botFetch } from '@/lib/api'

interface Product {
  id: string
  name: string
  price: number
  sale_price: number | null
  on_sale: boolean
  stock: number
  available: boolean
  featured: boolean | null
  free_shipping: boolean | null
  colors: string[] | null
  sizes: string[] | null
  visual_tags: string[] | null
  garment_type_label: string | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const STORAGE_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/productos/`

function backImageUrl(id: string, color?: string): string {
  const slug = (color ?? 'Vainilla').toLowerCase().replace(/\s+/g, '-')
  return `${STORAGE_BASE}${encodeURIComponent(`${id}-detras-${slug}.png`)}`
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [retagging, setRetagging] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/products', { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setProducts(body.products ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handleRetag(force: boolean) {
    if (!confirm(
      force
        ? '¿Re-analizar TODAS las imágenes con IA? Esto sobreescribe los tags existentes.'
        : '¿Analizar las imágenes que aún no tienen tags? Solo procesa los productos sin tags.',
    )) return
    setRetagging(true)
    const res = await botFetch(`/api/admin/web/products/retag${force ? '?force=true' : ''}`, {
      method: 'POST',
    })
    setRetagging(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(body.error || 'No se pudo analizar.')
    } else {
      showToast(`Listo: ${body.tagged} taggeados, ${body.skipped} sin cambios, ${body.failed} fallidos.`)
      load()
    }
  }

  async function toggleAvailable(p: Product) {
    const res = await botFetch(`/api/admin/web/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ available: !p.available }),
    })
    if (res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: !x.available } : x)))
      showToast(p.available ? 'Producto pausado.' : 'Producto activado.')
    } else {
      showToast('No se pudo cambiar.')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Productos</h1>
          <p className="text-sm text-gray-500">
            Click en un producto para editar. Aquí también puedes analizar imágenes con IA y pausar/activar.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRetag(false)}
            disabled={retagging}
            className="px-3 py-2 text-xs uppercase tracking-wide bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {retagging ? 'Analizando…' : 'Analizar con IA'}
          </button>
          <Link href="/products/new"
            className="px-3 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded">
            + Nuevo
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 w-16"></th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Precio</th>
              <th className="px-4 py-2">Tallas</th>
              <th className="px-4 py-2">Colores</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Badges</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Cargando…</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin productos.</td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-middle hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/products/${p.id}`)}>

                  <td className="px-4 py-3">
                    <img
                      src={backImageUrl(p.id, p.colors?.[0])}
                      alt={p.name}
                      className="w-12 h-12 object-contain bg-gray-100 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden'
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.garment_type_label ?? ''}</div>
                    {p.featured && <div className="text-xs text-amber-600 mt-0.5">⭐ Destacado</div>}
                  </td>
                  <td className="px-4 py-3">
                    {p.on_sale && p.sale_price ? (
                      <div>
                        <div className="font-medium text-red-600">${Number(p.sale_price).toLocaleString('es-CO')}</div>
                        <div className="text-xs text-gray-400 line-through">${Number(p.price).toLocaleString('es-CO')}</div>
                      </div>
                    ) : (
                      <div className="font-medium">${Number(p.price).toLocaleString('es-CO')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-0.5">
                      {(p.sizes ?? []).length > 0
                        ? (p.sizes ?? []).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded font-mono">{s}</span>
                          ))
                        : <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {(p.colors ?? []).length > 0
                        ? (p.colors ?? []).map((c) => (
                            <span key={c} className="text-xs text-gray-700">{c}</span>
                          ))
                        : <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${p.stock === 0 ? 'text-red-600' : p.stock <= 3 ? 'text-amber-600' : 'text-gray-700'}`}>
                      {p.stock} unidades
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.on_sale && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">SALE</span>
                      )}
                      {p.free_shipping && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Envío gratis</span>
                      )}
                      {!p.on_sale && !p.free_shipping && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {(p.visual_tags ?? []).slice(0, 8).map((t) => (
                        <span key={t} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                          {t}
                        </span>
                      ))}
                      {(p.visual_tags ?? []).length > 8 && (
                        <span className="text-xs text-gray-400">+{(p.visual_tags ?? []).length - 8}</span>
                      )}
                      {(p.visual_tags ?? []).length === 0 && (
                        <span className="text-xs text-amber-600">Sin tags — usa "Analizar"</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.available ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Activo</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">Pausado</span>
                    )}
                    {p.stock === 0 && p.available && (
                      <div className="text-xs text-red-500 mt-1">Sin stock</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditing(p)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded mr-2"
                    >
                      Tags
                    </button>
                    <button
                      onClick={() => toggleAvailable(p)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded"
                    >
                      {p.available ? 'Pausar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditTagsModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(tags) => {
            setProducts((prev) =>
              prev.map((x) => (x.id === editing.id ? { ...x, visual_tags: tags } : x)),
            )
            setEditing(null)
            showToast('Tags actualizados.')
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function EditTagsModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: (tags: string[]) => void
}) {
  const [tags, setTags] = useState<string[]>(product.visual_tags ?? [])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTag() {
    const t = draft.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    setTags([...tags, t])
    setDraft('')
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const res = await botFetch(`/api/admin/web/products/${product.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ visual_tags: tags }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'No se pudo guardar.')
      return
    }
    onSaved(tags)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-1">Editar tags visuales</h2>
        <p className="text-xs text-gray-500 mb-4">
          {product.name} · Estos son los sustantivos por los que el bot encuentra este producto cuando un cliente busca.
        </p>

        <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
          {tags.map((t) => (
            <span
              key={t}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded flex items-center gap-1"
            >
              {t}
              <button
                onClick={() => removeTag(t)}
                className="ml-1 text-gray-400 hover:text-red-600"
                aria-label={`Quitar ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && (
            <span className="text-xs text-gray-400">Aún no hay tags.</span>
          )}
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="Agregar tag (ej: piña)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded"
          />
          <button
            onClick={addTag}
            className="px-3 py-2 text-xs uppercase tracking-wide border border-gray-300 rounded"
          >
            Agregar
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs uppercase tracking-wide text-gray-700 border border-gray-300 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
