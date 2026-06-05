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
  out_of_stock: boolean
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

interface Filters {
  query: string
  garmentType: string
  estado: '' | 'visible' | 'oculto' | 'agotado'
  badge: '' | 'sale' | 'free_shipping'
}

const EMPTY_FILTERS: Filters = { query: '', garmentType: '', estado: '', badge: '' }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [retagging, setRetagging] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const garmentTypes = Array.from(new Set(products.map((p) => p.garment_type_label).filter(Boolean))) as string[]

  const filtered = products.filter((p) => {
    if (filters.query) {
      const q = filters.query.toLowerCase()
      if (!p.name.toLowerCase().includes(q)) return false
    }
    if (filters.garmentType && p.garment_type_label !== filters.garmentType) return false
    if (filters.estado === 'visible' && !p.available) return false
    if (filters.estado === 'oculto' && p.available) return false
    if (filters.estado === 'agotado' && !p.out_of_stock && p.stock !== 0) return false
    if (filters.badge === 'sale' && !p.on_sale) return false
    if (filters.badge === 'free_shipping' && !p.free_shipping) return false
    return true
  })

  const hasFilters = Object.values(filters).some(Boolean)

  function setFilter<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((prev) => ({ ...prev, [k]: prev[k] === v ? '' : v }))
  }

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
      showToast(p.available ? 'Producto ocultado.' : 'Producto visible.')
    } else {
      showToast('No se pudo cambiar.')
    }
  }

  async function toggleOutOfStock(p: Product) {
    const newVal = !p.out_of_stock
    const res = await botFetch(`/api/admin/web/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ out_of_stock: newVal }),
    })
    if (res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, out_of_stock: newVal } : x)))
      showToast(newVal ? 'Marcado como agotado.' : 'Marcado como disponible.')
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

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />

        <select
          value={filters.garmentType}
          onChange={(e) => setFilters((f) => ({ ...f, garmentType: e.target.value }))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="">Todos los tipos</option>
          {garmentTypes.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {(['visible', 'oculto', 'agotado'] as const).map((v) => (
            <button key={v} onClick={() => setFilter('estado', v)}
              className={`px-2.5 py-1 text-xs rounded border capitalize ${
                filters.estado === v
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <button onClick={() => setFilter('badge', 'sale')}
            className={`px-2.5 py-1 text-xs rounded border ${
              filters.badge === 'sale'
                ? 'bg-red-600 text-white border-red-600'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}>
            SALE
          </button>
          <button onClick={() => setFilter('badge', 'free_shipping')}
            className={`px-2.5 py-1 text-xs rounded border ${
              filters.badge === 'free_shipping'
                ? 'bg-green-600 text-white border-green-600'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}>
            Envío gratis
          </button>
        </div>

        {hasFilters && (
          <button onClick={() => setFilters(EMPTY_FILTERS)}
            className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-700 underline">
            Limpiar filtros
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} de {products.length} productos
        </span>
      </div>

      {/* Tabla — solo desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
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
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {hasFilters ? 'Sin resultados para estos filtros.' : 'Sin productos.'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
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
                    {((p as unknown as { collection_labels?: string[] }).collection_labels ?? []).map((l: string) => (
                      <span key={l} className="inline-block text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mt-0.5 mr-1">{l}</span>
                    ))}
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
                    <div className="flex flex-col gap-1">
                      {p.available ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded w-fit">Visible</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded w-fit">Oculto</span>
                      )}
                      {(p.out_of_stock || p.stock === 0) && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded w-fit">Agotado</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setEditing(p)} className="px-2 py-1 text-xs border border-gray-300 rounded">Tags</button>
                      <button onClick={() => toggleAvailable(p)} className="px-2 py-1 text-xs border border-gray-300 rounded">
                        {p.available ? 'Ocultar' : 'Mostrar'}
                      </button>
                      <button
                        onClick={() => toggleOutOfStock(p)}
                        disabled={p.stock === 0}
                        className={`px-2 py-1 text-xs border rounded disabled:opacity-40 ${
                          p.out_of_stock ? 'border-green-300 text-green-700' : 'border-red-200 text-red-600'
                        }`}
                        title={p.stock === 0 ? 'Stock en 0 — agotado automáticamente' : ''}
                      >
                        {p.out_of_stock ? 'Disponible' : 'Agotado'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — solo móvil */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center text-gray-400 text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center text-gray-400 text-sm">
            {hasFilters ? 'Sin resultados para estos filtros.' : 'Sin productos.'}
          </div>
        ) : filtered.map((p) => (
          <div key={p.id} onClick={() => router.push(`/products/${p.id}`)}
            className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50">
            <div className="flex gap-3 items-start">
              <img src={backImageUrl(p.id, p.colors?.[0])} alt={p.name}
                className="w-16 h-16 object-contain bg-gray-100 rounded flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-500 mb-1">{p.garment_type_label}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.on_sale && p.sale_price ? (
                    <>
                      <span className="text-sm font-bold text-red-600">${Number(p.sale_price).toLocaleString('es-CO')}</span>
                      <span className="text-xs text-gray-400 line-through">${Number(p.price).toLocaleString('es-CO')}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold">${Number(p.price).toLocaleString('es-CO')}</span>
                  )}
                  <span className={`text-xs ${p.stock === 0 ? 'text-red-600' : p.stock <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                    Stock: {p.stock}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(p.sizes ?? []).map((s) => (
                    <span key={s} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded font-mono">{s}</span>
                  ))}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {p.on_sale && <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-full font-medium">SALE</span>}
                  {p.free_shipping && <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-full font-medium">Envío gratis</span>}
                  {!p.available && <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-medium">Pausado</span>}
                  {p.out_of_stock && <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full font-medium">Agotado</span>}
                </div>
                {(p.colors ?? []).length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(p.colors ?? []).map((c) => (
                      <span key={c} className="text-[10px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Botones de acción móvil */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditing(p)}
                className="flex-1 py-1.5 text-xs border border-gray-300 rounded text-center">Tags</button>
              <button onClick={() => toggleAvailable(p)}
                className="flex-1 py-1.5 text-xs border border-gray-300 rounded text-center">
                {p.available ? 'Ocultar' : 'Mostrar'}
              </button>
              <button onClick={() => toggleOutOfStock(p)} disabled={p.stock === 0}
                className={`flex-1 py-1.5 text-xs border rounded text-center disabled:opacity-40 ${
                  p.out_of_stock ? 'border-green-300 text-green-700' : 'border-red-200 text-red-600'
                }`}>
                {p.out_of_stock ? 'Disponible' : 'Agotado'}
              </button>
            </div>
          </div>
        ))}
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
