'use client'

import { useState, useRef } from 'react'
import { botFetch } from '@/lib/api'
import { uploadProductImage } from '@/lib/upload'

interface GarmentType { id: string; label: string }
interface Collection { id: string; label: string }

const SIZES_DEFAULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const ACCENT_FROM = 'ÁÉÍÓÚÜÑáéíóúüñ'
const ACCENT_TO   = 'AEIOUUNaeiouun'

function slugify(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFD').replace(/[̀-ͯ]/g, '')) {
    const i = ACCENT_FROM.indexOf(ch)
    out += i >= 0 ? ACCENT_TO[i] : ch
  }
  return out.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function slugifyColor(color: string): string {
  return slugify(color)
}

interface ProductFormProps {
  initial?: Record<string, unknown>
  garmentTypes: GarmentType[]
  collections: Collection[]
  onSaved: (id: string) => void
  onDeleted?: () => void
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const STORAGE_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/productos/`

function imageUrl(productId: string, color: string, side: 'frente' | 'detras'): string {
  const prefix = side === 'frente' ? 'alfrente' : 'detras'
  return `${STORAGE_BASE}${encodeURIComponent(`${productId}-${prefix}-${slugifyColor(color)}.png`)}`
}

export function ProductForm({ initial, garmentTypes, collections, onSaved, onDeleted }: ProductFormProps) {
  const isNew = !initial

  const [name, setName] = useState(String(initial?.name ?? ''))
  const [id, setId] = useState(String(initial?.id ?? ''))
  const [idManual, setIdManual] = useState(!isNew)
  const [description, setDescription] = useState(String(initial?.description ?? ''))
  const [garmentType, setGarmentType] = useState(String(initial?.garment_type ?? garmentTypes[0]?.id ?? ''))
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    Array.isArray(initial?.collections) ? (initial.collections as string[]) : [],
  )
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [salePrice, setSalePrice] = useState(String(initial?.sale_price ?? ''))
  const [onSale, setOnSale] = useState(Boolean(initial?.on_sale))
  const [stock, setStock] = useState(String(initial?.stock ?? '0'))
  const [available, setAvailable] = useState(initial?.available !== false)
  const [featured, setFeatured] = useState(Boolean(initial?.featured))
  const [sizes, setSizes] = useState<string[]>(
    Array.isArray(initial?.sizes) ? (initial.sizes as string[]) : [],
  )
  const [colors, setColors] = useState<string[]>(
    Array.isArray(initial?.colors) ? (initial.colors as string[]) : [],
  )
  const [colorDraft, setColorDraft] = useState('')
  const [material, setMaterial] = useState(String(initial?.material ?? ''))
  const [printingMethod, setPrintingMethod] = useState(String(initial?.printing_method ?? ''))

  const [freeShipping, setFreeShipping] = useState(Boolean(initial?.free_shipping))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Upload state por color
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [imageKeys, setImageKeys] = useState<Record<string, number>>({}) // force refresh
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ color: string; side: 'frente' | 'detras' } | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleNameChange(v: string) {
    setName(v)
    if (!idManual) setId(slugify(v))
  }

  function toggleSize(s: string) {
    setSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function addColor() {
    const c = colorDraft.trim()
    if (!c || colors.includes(c)) return
    setColors([...colors, c])
    setColorDraft('')
  }

  function removeColor(c: string) {
    setColors(colors.filter((x) => x !== c))
  }

  function toggleCollection(colId: string) {
    setSelectedCollections((prev) =>
      prev.includes(colId) ? prev.filter((x) => x !== colId) : [...prev, colId],
    )
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) { setError('El nombre es requerido.'); return }
    if (!garmentType) { setError('El tipo de prenda es requerido.'); return }
    if (!price || isNaN(Number(price))) { setError('El precio es requerido.'); return }

    setSaving(true)
    const body = {
      id: isNew ? id || slugify(name) : undefined,
      name: name.trim(),
      description: description.trim() || null,
      garment_type: garmentType,
      collections: selectedCollections,
      price: Number(price),
      sale_price: salePrice ? Number(salePrice) : null,
      on_sale: onSale,
      stock: Number(stock) || 0,
      sizes,
      colors,
      material: material.trim() || null,
      printing_method: printingMethod.trim() || null,
      available,
      featured,
      free_shipping: freeShipping,
    }

    try {
      const res = isNew
        ? await botFetch('/api/admin/web/products', { method: 'POST', body: JSON.stringify(body) })
        : await botFetch(`/api/admin/web/products/${initial?.id}`, { method: 'PUT', body: JSON.stringify(body) })

      const resBody = await res.json().catch(() => ({}))
      if (!res.ok) { setError(resBody.error || 'No se pudo guardar.'); return }

      const savedId = resBody.product?.id ?? initial?.id ?? id
      showToast(isNew ? 'Producto creado ✅' : 'Producto actualizado ✅')
      setTimeout(() => onSaved(savedId as string), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar definitivamente el producto "${name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const res = await botFetch(`/api/admin/web/products/${initial?.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error || 'No se pudo eliminar.'); return }
    onDeleted?.()
  }

  function triggerUpload(color: string, side: 'frente' | 'detras') {
    setPendingUpload({ color, side })
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload) return
    const productId = (initial?.id as string) ?? id ?? slugify(name)
    if (!productId) { showToast('Guarda el producto primero para subir imágenes.'); return }

    const key = `${pendingUpload.color}-${pendingUpload.side}`
    setUploading((prev) => ({ ...prev, [key]: true }))
    const result = await uploadProductImage(productId, pendingUpload.color, pendingUpload.side, file)
    setUploading((prev) => ({ ...prev, [key]: false }))

    if (!result.ok) { showToast(`Error: ${result.error}`); return }
    setImageKeys((prev) => ({ ...prev, [key]: Date.now() }))
    showToast(`Imagen de ${pendingUpload.color} (${pendingUpload.side === 'frente' ? 'delantera' : 'trasera'}) subida ✅`)

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setPendingUpload(null)
  }

  const productId = (initial?.id as string) ?? id ?? slugify(name)

  return (
    <div className="space-y-8">
      {/* Info básica */}
      <Section title="Información básica">
        <Field label="Nombre">
          <input value={name} onChange={(e) => handleNameChange(e.target.value)}
            className={INPUT} placeholder="Modo Fresco" />
        </Field>
        <Field label={`Slug (ID)${isNew ? ' — auto-generado del nombre' : ''}`}>
          <div className="flex gap-2">
            <input value={id} onChange={(e) => { setId(e.target.value); setIdManual(true) }}
              className={`${INPUT} font-mono`} placeholder="modo-fresco"
              disabled={!isNew} />
            {isNew && (
              <button type="button" onClick={() => { setId(slugify(name)); setIdManual(false) }}
                className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                Regenerar
              </button>
            )}
          </div>
          {isNew && <p className="text-xs text-gray-400 mt-1">Este ID no puede cambiar después de creado.</p>}
        </Field>
        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} className={INPUT} placeholder="Para cuando la vida te exige demasiado…" />
        </Field>
      </Section>

      {/* Clasificación */}
      <Section title="Clasificación">
        <Field label="Tipo de prenda">
          <select value={garmentType} onChange={(e) => setGarmentType(e.target.value)} className={INPUT}>
            {garmentTypes.map((gt) => <option key={gt.id} value={gt.id}>{gt.label}</option>)}
          </select>
        </Field>
        <Field label="Colecciones">
          <div className="flex flex-wrap gap-2">
            {collections.map((col) => (
              <button key={col.id} type="button"
                onClick={() => toggleCollection(col.id)}
                className={`px-3 py-1 text-xs rounded-full border ${selectedCollections.includes(col.id)
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}>
                {col.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Precio y stock */}
      <Section title="Precio y stock">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio (COP)">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              className={INPUT} placeholder="90000" />
          </Field>
          <Field label="Precio de oferta (COP)">
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
              className={INPUT} placeholder="70000" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Stock">
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)}
              className={INPUT} placeholder="15" />
          </Field>
          <Field label="Estado">
            <div className="flex flex-col gap-2 pt-1">
              <Toggle label="En oferta" value={onSale} onChange={setOnSale} />
              <Toggle label="Disponible" value={available} onChange={setAvailable} />
              <Toggle label="Destacado" value={featured} onChange={setFeatured} />
              <Toggle
                label="Envío gratis siempre 🎁 (sin importar ciudad ni total)"
                value={freeShipping}
                onChange={setFreeShipping}
              />
            </div>
          </Field>
        </div>
      </Section>

      {/* Tallas */}
      <Section title="Tallas disponibles">
        <div className="flex flex-wrap gap-2">
          {SIZES_DEFAULT.map((s) => (
            <button key={s} type="button" onClick={() => toggleSize(s)}
              className={`w-12 h-12 text-sm font-medium rounded border ${sizes.includes(s)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}>
              {s}
            </button>
          ))}
        </div>
      </Section>

      {/* Colores */}
      <Section title="Colores">
        <div className="flex flex-wrap gap-2 mb-3">
          {colors.map((c) => (
            <span key={c} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full flex items-center gap-1">
              {c}
              <button type="button" onClick={() => removeColor(c)}
                className="ml-1 text-gray-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={colorDraft} onChange={(e) => setColorDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
            className={INPUT} placeholder="Vainilla, Negro, Blanco…" />
          <button type="button" onClick={addColor}
            className="px-3 py-2 text-xs border border-gray-300 rounded">
            Agregar
          </button>
        </div>
      </Section>

      {/* Detalles */}
      <Section title="Detalles de fabricación">
        <Field label="Material">
          <input value={material} onChange={(e) => setMaterial(e.target.value)}
            className={INPUT} placeholder="100% algodón" />
        </Field>
        <Field label="Método de impresión">
          <input value={printingMethod} onChange={(e) => setPrintingMethod(e.target.value)}
            className={INPUT} placeholder="DTF" />
        </Field>
      </Section>

      {/* Imágenes */}
      {colors.length > 0 && (
        <Section title="Imágenes por color">
          <p className="text-xs text-gray-500 mb-4">
            {isNew && !productId
              ? 'Guarda el producto primero para poder subir imágenes.'
              : 'Sube la imagen delantera y trasera para cada color. Se reemplaza si ya existe.'}
          </p>
          <div className="space-y-6">
            {colors.map((color) => (
              <div key={color}>
                <div className="text-sm font-medium mb-2">{color}</div>
                <div className="grid grid-cols-2 gap-4">
                  {(['frente', 'detras'] as const).map((side) => {
                    const key = `${color}-${side}`
                    const upKey = imageKeys[key]
                    const url = productId ? `${imageUrl(productId, color, side)}?t=${upKey ?? 0}` : null
                    const isUploading = uploading[key]
                    return (
                      <div key={side} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 border-b border-gray-200">
                          {side === 'frente' ? 'Delantera' : 'Trasera (con estampado)'}
                        </div>
                        <div className="p-2 flex flex-col items-center gap-2">
                          {url && (
                            <img
                              key={upKey}
                              src={url}
                              alt={`${color} ${side}`}
                              className="w-full h-32 object-contain bg-gray-50"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                          <button
                            type="button"
                            disabled={isUploading || !productId}
                            onClick={() => triggerUpload(color, side)}
                            className="w-full py-2 text-xs border border-gray-300 rounded hover:border-gray-500 disabled:opacity-50"
                          >
                            {isUploading ? 'Subiendo…' : 'Subir imagen'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </Section>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div>
          {!isNew && onDeleted && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="px-4 py-2 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50">
              {deleting ? 'Eliminando…' : 'Eliminar producto'}
            </button>
          )}
        </div>
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-6 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50">
          {saving ? 'Guardando…' : isNew ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}
        className="rounded" />
      {label}
    </label>
  )
}

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white'
