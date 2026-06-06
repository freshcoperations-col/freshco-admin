'use client'

import { useState, useRef, useEffect } from 'react'
import { botFetch } from '@/lib/api'
import { uploadProductImage } from '@/lib/upload'

interface GarmentType { id: string; label: string }
interface Collection { id: string; label: string }

const SIZES_SHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_CAP   = ['L/XL']
const SIZES_PANTS = ['28', '30', '32', '34', '36', '38']

const SIZES_BY_TYPE: Record<string, string[]> = {
  camisetas: SIZES_SHIRT,
  hoodies:   SIZES_SHIRT,
  sudaderas: SIZES_SHIRT,
  chaquetas: SIZES_SHIRT,
  gorras:    SIZES_CAP,
  pantalones: SIZES_PANTS,
}
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

const TYPE_LABELS: Record<string, string> = {
  back: 'Vista principal',
  front: 'Vista secundaria',
  lifestyle: 'Modelo / Lifestyle',
  detail: 'Detalle / Close-up',
  flat: 'Flat / Packshot',
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  back: 'La foto más importante — la que aparece en el catálogo y la manda el bot. Para camisetas/buzos: la trasera con el estampado. Para gorras: el panel frontal con el diseño. Para pantalones: vista trasera.',
  front: 'Segunda foto en la galería. Para camisetas/buzos: la delantera. Para gorras: vista lateral o interior. Para pantalones: vista delantera.',
  lifestyle: 'Foto de modelo usando la prenda. Aparece en la galería del producto después de las vistas principales.',
  detail: 'Close-up del estampado, bordado, material o cualquier detalle que valga la pena destacar.',
  flat: 'Foto plana (prenda extendida sin modelo). Útil como referencia de forma y talla.',
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
  const [availableSizes, setAvailableSizes] = useState<string[]>(SIZES_BY_TYPE[garmentType] ?? SIZES_SHIRT)
  const [material, setMaterial] = useState(String(initial?.material ?? ''))
  const [printingMethod, setPrintingMethod] = useState(String(initial?.printing_method ?? ''))

  const [freeShipping, setFreeShipping] = useState(Boolean(initial?.free_shipping))
  const [model3dKeys, setModel3dKeys] = useState<Record<string, number>>({})
  const [model3dExists, setModel3dExists] = useState<Record<string, boolean>>({})
  const [uploadingModel, setUploadingModel] = useState<Record<string, boolean>>({})
  const model3dFileRef = useRef<HTMLInputElement>(null)
  const [pendingModel, setPendingModel] = useState<string | null>(null)

  const [extraImages, setExtraImages] = useState<Array<{ url: string; type: string; color: string | null; label: string | null }>>(
    Array.isArray(initial?.images) ? (initial.images as Array<{ url: string; type: string; color: string | null; label: string | null }>) : [],
  )
  const [extraImageType, setExtraImageType] = useState<'back' | 'front' | 'lifestyle' | 'detail' | 'flat'>('lifestyle')
  const [extraImageColor, setExtraImageColor] = useState('')
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const extraFileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const productId = (initial?.id as string) ?? id ?? slugify(name)

  // model3dExists se activa solo tras subir en esta sesión (sin probe automático)

  // sessionStorage key para persistir imágenes borradas entre navegaciones
  function ssKey(color: string, side: string) { return `del:${productId}:${color}:${side}` }
  function wasDeleted(color: string, side: string) {
    try { return sessionStorage.getItem(ssKey(color, side)) === '1' } catch { return false }
  }
  function markDeleted(color: string, side: string) {
    try { sessionStorage.setItem(ssKey(color, side), '1') } catch {}
  }
  function clearDeleted(color: string, side: string) {
    try { sessionStorage.removeItem(ssKey(color, side)) } catch {}
  }

  // Upload state por color
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [imageKeys, setImageKeys] = useState<Record<string, number>>({})
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean | undefined>>(() => {
    // Inicializar desde sessionStorage: imágenes borradas quedan en false
    const init: Record<string, boolean | undefined> = {}
    if (typeof window !== 'undefined' && productId) {
      const storedColors = Array.isArray(initial?.colors) ? (initial.colors as string[]) : []
      storedColors.forEach((c) => {
        ;(['frente', 'detras'] as const).forEach((s) => {
          if (wasDeleted(c, s)) init[`${c}-${s}`] = false
        })
      })
    }
    return init
  })
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ color: string; side: 'frente' | 'detras' } | null>(null)

  // Cargar tallas y filtrar selección al cambiar tipo de prenda
  useEffect(() => {
    if (!garmentType) return
    botFetch(`/api/admin/web/size-guide/${garmentType}`)
      .then((r) => r.json())
      .then((d) => {
        const loaded: string[] = (Array.isArray(d.sizes) && d.sizes.length > 0)
          ? d.sizes
          : (SIZES_BY_TYPE[garmentType] ?? SIZES_SHIRT)
        setAvailableSizes(loaded)
        // Eliminar tallas seleccionadas que no pertenecen al nuevo tipo
        setSizes((prev) => prev.filter((s) => loaded.includes(s)))
      })
      .catch(() => {
        const fallback = SIZES_BY_TYPE[garmentType] ?? SIZES_SHIRT
        setAvailableSizes(fallback)
        setSizes((prev) => prev.filter((s) => fallback.includes(s)))
      })
  }, [garmentType])

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
    setDeletingProduct(true)
    const res = await botFetch(`/api/admin/web/products/${initial?.id}`, { method: 'DELETE' })
    setDeletingProduct(false)
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
    clearDeleted(pendingUpload.color, pendingUpload.side)
    setImageLoaded((prev) => ({ ...prev, [key]: undefined }))
    showToast(`Imagen de ${pendingUpload.color} (${pendingUpload.side === 'frente' ? 'delantera' : 'trasera'}) subida ✅`)

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setPendingUpload(null)
  }

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
              <Toggle label="Mostrar" value={available} onChange={setAvailable} />
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
        <p className="text-xs text-gray-400 mb-3">
          Tallas definidas en <strong>Guía de tallas</strong> para {garmentTypes.find(g => g.id === garmentType)?.label ?? 'este tipo'}.
        </p>
        <div className="flex flex-wrap gap-2">
          {availableSizes.map((s) => (
            <button key={s} type="button" onClick={() => toggleSize(s)}
              className={`px-3 py-2 text-sm font-medium rounded border transition-colors ${sizes.includes(s)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}>
              {s}
            </button>
          ))}
          {availableSizes.length === 0 && (
            <span className="text-xs text-gray-400">
              No hay tallas configuradas. Ve a <strong>Guía de tallas</strong> para agregarlas.
            </span>
          )}
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
              : 'Para camisetas y buzos: sube la delantera y la trasera (con el estampado). Para gorras y pantalones: usa en cambio la sección "Fotos adicionales" con tipo "Vista principal" y "Vista secundaria" — el sistema las detecta automáticamente.'}
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
                    const loaded = imageLoaded[key]  // undefined=cargando, true=existe, false=no existe
                    const isDeletingThis = deleting[key]
                    return (
                      <div key={side} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 border-b border-gray-200">
                          {side === 'frente' ? 'Delantera' : 'Trasera (con estampado)'}
                        </div>
                        <div className="p-2 flex flex-col items-center gap-2">
                          {loaded === false ? (
                            <p className="text-xs text-gray-400 py-4 w-full text-center">No hay imagen cargada</p>
                          ) : url && productId ? (
                            <img
                              key={upKey ?? 'init'}
                              src={url}
                              alt={`${color} ${side}`}
                              className="w-full h-32 object-contain bg-gray-50"
                              style={{ display: loaded ? 'block' : 'none' }}
                              onLoad={() => setImageLoaded((p) => ({ ...p, [key]: true }))}
                              onError={() => setImageLoaded((p) => ({ ...p, [key]: false }))}
                            />
                          ) : null}
                          <div className="flex gap-2 w-full">
                            <button
                              type="button"
                              disabled={isUploading || !productId}
                              onClick={() => triggerUpload(color, side)}
                              className="flex-1 py-2 text-xs border border-gray-300 rounded hover:border-gray-500 disabled:opacity-50"
                            >
                              {isUploading ? 'Subiendo…' : 'Subir imagen'}
                            </button>
                            {productId && (
                              <button
                                type="button"
                                disabled={isDeletingThis}
                                title="Eliminar imagen del storage"
                                onClick={async () => {
                                  if (!confirm(`¿Eliminar imagen ${side === 'frente' ? 'delantera' : 'trasera'} de ${color}?`)) return
                                  setDeleting((p) => ({ ...p, [key]: true }))
                                  const res = await botFetch(
                                    `/api/admin/web/products/${productId}/upload-image?color=${encodeURIComponent(color)}&side=${side}`,
                                    { method: 'DELETE' },
                                  )
                                  setDeleting((p) => ({ ...p, [key]: false }))
                                  if (res.ok) {
                                    markDeleted(color, side)
                                    setImageKeys((p) => ({ ...p, [key]: -1 }))
                                    setImageLoaded((p) => ({ ...p, [key]: false }))
                                    showToast(`Imagen eliminada`)
                                  } else {
                                    const b = await res.json().catch(() => ({}))
                                    showToast(b.error || 'Error al eliminar')
                                  }
                                }}
                                className="px-2 py-2 text-xs border border-red-200 rounded text-red-500 hover:bg-red-50 disabled:opacity-40"
                              >
                                {isDeletingThis ? '…' : '🗑'}
                              </button>
                            )}
                          </div>
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

          {/* Modelos 3D */}
      {colors.length > 0 && !isNew && productId && (
        <Section title="Modelos 3D (opcional)">
          <p className="text-xs text-gray-500 mb-4">
            Sube el archivo <code className="bg-gray-100 px-1 rounded">.glb</code> para cada color.
            La web muestra el visor 3D automáticamente si el archivo existe.
            Nombre generado: <code className="bg-gray-100 px-1 rounded">{productId}-3d-{'{color}'}.glb</code>
          </p>
          <div className="grid grid-cols-2 gap-4">
            {colors.map((color) => {
              const colorSlug = color.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-')
              const modelFilename = `${productId}-3d-${colorSlug}.glb`
              const modelUrl = `${STORAGE_BASE}${encodeURIComponent(modelFilename)}`
              const key = model3dKeys[color] ?? 0
              const isUp = uploadingModel[color]
              const modelExistsNow = model3dExists[color] || key > 0
              return (
                <div key={color} className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-medium mb-2">{color}</div>
                  <div className="text-xs text-gray-400 font-mono mb-2 truncate">{modelFilename}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isUp}
                      onClick={() => { setPendingModel(color); model3dFileRef.current?.click() }}
                      className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:border-gray-500 disabled:opacity-50"
                    >
                      {isUp ? 'Subiendo…' : '↑ Subir .glb'}
                    </button>
                    {modelExistsNow && (
                      <a
                        href={`${modelUrl}?t=${key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:text-gray-800"
                      >
                        Ver
                      </a>
                    )}
                    {modelExistsNow && (
                      <button
                        type="button"
                        title="Eliminar modelo 3D"
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el modelo 3D de ${color}?`)) return
                          const colorSlug = color.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-')
                          const res = await botFetch(
                            `/api/admin/web/products/${productId}/upload-model?color=${encodeURIComponent(color)}&ext=glb`,
                            { method: 'DELETE' },
                          )
                          if (res.ok) {
                            setModel3dKeys((prev) => ({ ...prev, [color]: 0 }))
                            setModel3dExists((prev) => ({ ...prev, [color]: false }))
                            showToast(`Modelo 3D de ${color} eliminado`)
                          } else {
                            const b = await res.json().catch(() => ({}))
                            showToast(b.error || 'Error al eliminar')
                          }
                        }}
                        className="px-2 py-1.5 text-xs border border-red-200 rounded text-red-500 hover:bg-red-50"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  {key > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ Subido correctamente</p>
                  )}
                </div>
              )
            })}
          </div>
          <input
            ref={model3dFileRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              const color = pendingModel
              if (!file || !color) return
              setUploadingModel((prev) => ({ ...prev, [color]: true }))
              try {
                const ext = file.name.split('.').pop()?.toLowerCase() || 'glb'
                // 1. Obtener URL firmada (sin pasar el archivo por Vercel)
                const urlRes = await botFetch(
                  `/api/admin/web/products/${productId}/upload-model-url?color=${encodeURIComponent(color)}&ext=${ext}`,
                )
                if (!urlRes.ok) {
                  const b = await urlRes.json().catch(() => ({}))
                  throw new Error(b.error || 'No se pudo obtener URL de subida')
                }
                const { signedUrl } = await urlRes.json()

                // 2. Subir DIRECTAMENTE a Supabase Storage (sin pasar por Vercel)
                const uploadRes = await fetch(signedUrl, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/octet-stream' },
                  body: file,
                })
                if (!uploadRes.ok) {
                  const txt = await uploadRes.text().catch(() => '')
                  throw new Error(`Error al subir: ${uploadRes.status} ${txt.slice(0, 100)}`)
                }
                setModel3dKeys((prev) => ({ ...prev, [color]: Date.now() }))
                setModel3dExists((prev) => ({ ...prev, [color]: true }))
                showToast(`Modelo 3D de ${color} subido ✅`)
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Error de conexión')
              } finally {
                setUploadingModel((prev) => ({ ...prev, [color]: false }))
                if (model3dFileRef.current) model3dFileRef.current.value = ''
                setPendingModel(null)
              }
            }}
          />
        </Section>
      )}

      {/* Fotos adicionales (modelos, detalles, etc.) */}
      {!isNew && productId && (
        <Section title="Fotos adicionales (modelos, detalles, otras vistas)">
          <div className="text-xs text-gray-500 mb-4 space-y-1.5 bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="font-medium text-gray-700 mb-2">¿Qué subir aquí según el tipo de prenda?</p>
            {Object.entries(TYPE_DESCRIPTIONS).map(([type, desc]) => (
              <div key={type} className="flex gap-2">
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">{TYPE_LABELS[type]}:</span>
                <span>{desc}</span>
              </div>
            ))}
            <p className="mt-2 text-gray-400 border-t border-gray-200 pt-2">
              💡 Para gorras y pantalones: sube "Vista principal" aquí — el bot y el catálogo la usarán como foto principal automáticamente.
            </p>
          </div>

          {/* Imágenes existentes */}
          {extraImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {extraImages.map((img, i) => (
                <div key={i} className="relative border border-gray-200 rounded overflow-hidden">
                  <img src={img.url} alt={img.type} className="w-full h-28 object-cover bg-gray-50" />
                  <div className="px-2 py-1 bg-gray-50 text-[10px] text-gray-500">
                    {TYPE_LABELS[img.type] ?? img.type}{img.color ? ` · ${img.color}` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('¿Eliminar esta foto?')) return
                      const res = await botFetch(`/api/admin/web/products/${productId}/images`, {
                        method: 'DELETE',
                        body: JSON.stringify({ url: img.url }),
                      })
                      if (res.ok) {
                        setExtraImages((prev) => prev.filter((_, j) => j !== i))
                        showToast('Foto eliminada')
                      }
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-700"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Upload nueva foto */}
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select value={extraImageType} onChange={(e) => setExtraImageType(e.target.value as typeof extraImageType)}
                className={INPUT}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color (opcional)</label>
              <input value={extraImageColor} onChange={(e) => setExtraImageColor(e.target.value)}
                placeholder="Vainilla" className={`${INPUT} w-28`} />
            </div>
            <button
              type="button"
              disabled={uploadingExtra}
              onClick={() => extraFileRef.current?.click()}
              className="px-3 py-2 text-xs border border-gray-300 rounded hover:border-gray-500 disabled:opacity-50"
            >
              {uploadingExtra ? 'Subiendo…' : '+ Subir foto'}
            </button>
          </div>
          <input ref={extraFileRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadingExtra(true)
              const fd = new FormData()
              fd.append('file', file)
              fd.append('type', extraImageType)
              if (extraImageColor.trim()) fd.append('color', extraImageColor.trim())
              const res = await botFetch(`/api/admin/web/products/${productId}/images`, { method: 'POST', headers: {}, body: fd })
              setUploadingExtra(false)
              if (res.ok) {
                const { image } = await res.json()
                setExtraImages((prev) => [...prev, image])
                showToast('Foto subida ✅')
                setExtraImageColor('')
              } else {
                const b = await res.json().catch(() => ({}))
                showToast(b.error || 'Error al subir')
              }
              if (extraFileRef.current) extraFileRef.current.value = ''
            }}
          />
        </Section>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div>
          {!isNew && onDeleted && (
            <button type="button" onClick={handleDelete} disabled={deletingProduct}
              className="px-4 py-2 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50">
              {deletingProduct ? 'Eliminando…' : 'Eliminar producto'}
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
