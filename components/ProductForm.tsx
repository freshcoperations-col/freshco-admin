'use client'

import { useState, useRef, useEffect } from 'react'
import { botFetch } from '@/lib/api'
import { uploadProductImage } from '@/lib/upload'
import { PresetChips, DiscountChips } from '@/components/PresetChips'
import { usePermissions } from '@/contexts/PermissionsContext'
import {
  StockVariants,
  distribute,
  payloadToVariants,
  qtyForColor,
  qtyForSize,
  totalOf,
  variantsToPayload,
  type VariantQty,
} from '@/components/StockVariants'
import {
  fetchPresets,
  applyDiscount,
  defaultValue,
  formatCop,
  EMPTY_PRESETS,
  type PresetsDoc,
  type Plantilla,
} from '@/lib/presets'

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
  /**
   * Id del producto original cuando estamos duplicando. El formulario se
   * comporta como "nuevo" (initial trae los valores precargados pero sin
   * id ni imágenes) y al guardar clona las imágenes del original.
   */
  duplicateFrom?: string
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

export function ProductForm({ initial, garmentTypes, collections, onSaved, onDeleted, duplicateFrom }: ProductFormProps) {
  const isDuplicate = !!duplicateFrom
  const isNew = !initial || isDuplicate
  const { can } = usePermissions()

  const [name, setName] = useState(String(initial?.name ?? ''))
  const [id, setId] = useState(() =>
    String(initial?.id ?? (initial?.name ? slugify(String(initial.name)) : '')),
  )
  const [idManual, setIdManual] = useState(!isNew)
  const [description, setDescription] = useState(String(initial?.description ?? ''))
  const [garmentType, setGarmentType] = useState(String(initial?.garment_type ?? garmentTypes[0]?.id ?? ''))
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    Array.isArray(initial?.collections) ? (initial.collections as string[]) : [],
  )
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [salePrice, setSalePrice] = useState(String(initial?.sale_price ?? ''))
  const [stock, setStock] = useState(String(initial?.stock ?? '0'))
  const [stockMode, setStockMode] = useState<'general' | 'variantes'>(
    initial?.stock_mode === 'variantes' ? 'variantes' : 'general',
  )
  const [variantQty, setVariantQty] = useState<VariantQty>(
    () => payloadToVariants(initial?.stock_variants),
  )
  const [onSale, setOnSale] = useState(Boolean(initial?.on_sale))
  const [available, setAvailable] = useState(initial?.available !== false)
  const [featured, setFeatured] = useState(Boolean(initial?.featured))
  const [sizes, setSizes] = useState<string[]>(
    Array.isArray(initial?.sizes) ? (initial.sizes as string[]) : [],
  )
  const [colors, setColors] = useState<string[]>(
    Array.isArray(initial?.colors) ? (initial.colors as string[]) : [],
  )
  const [colorPalette, setColorPalette] = useState<Array<{ id: string; name: string; hex: string }>>([])
  const [availableSizes, setAvailableSizes] = useState<string[]>(SIZES_BY_TYPE[garmentType] ?? SIZES_SHIRT)

  const [material, setMaterial] = useState(String(initial?.material ?? ''))
  const [printingMethod, setPrintingMethod] = useState(String(initial?.printing_method ?? ''))

  const [freeShipping, setFreeShipping] = useState(Boolean(initial?.free_shipping))
  const [model3dKeys, setModel3dKeys] = useState<Record<string, number>>({})
  const [model3dExists, setModel3dExists] = useState<Record<string, boolean>>({})
  const [uploadingModel, setUploadingModel] = useState<Record<string, boolean>>({})
  const [optimizingModel, setOptimizingModel] = useState<Record<string, boolean>>({})
  const model3dFileRef = useRef<HTMLInputElement>(null)
  const [pendingModel, setPendingModel] = useState<string | null>(null)

  const [extraImages, setExtraImages] = useState<Array<{ url: string; type: string; color: string | null; label: string | null }>>(() => {
    const raw = Array.isArray(initial?.images)
      ? (initial.images as Array<{ url: string; type: string; color: string | null; label: string | null }>)
      : []
    // Antes, subir dos fotos del mismo tipo y color dejaba dos entradas con la
    // misma URL. Se muestran una sola vez; el servidor las limpia al guardar.
    const seen = new Set<string>()
    return raw.filter((img) => (seen.has(img.url) ? false : (seen.add(img.url), true)))
  })
  const [extraImageType, setExtraImageType] = useState<'back' | 'front' | 'lifestyle' | 'detail' | 'flat'>('lifestyle')
  const [extraImageColor, setExtraImageColor] = useState('')
  // null = libre; texto = mensaje de progreso ("Subiendo 2 de 5…")
  const [uploadingExtra, setUploadingExtra] = useState<string | null>(null)
  const extraFileRef = useRef<HTMLInputElement>(null)
  const [presets, setPresets] = useState<PresetsDoc>(EMPTY_PRESETS)
  // Se marca en cuanto el usuario cambia algún campo que una plantilla
  // sobrescribiría — sirve para pedir confirmación antes de reemplazarlos.
  const [touched, setTouched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const productId = (initial?.id as string) ?? id ?? slugify(name)

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

  useEffect(() => {
    botFetch('/api/admin/web/colors')
      .then((r) => r.json())
      .then((d) => setColorPalette(d.colors ?? []))
      .catch(() => {})
  }, [])

  // Probar si ya existe un modelo 3D subido para cada color (sin probe automático antes)
  useEffect(() => {
    if (!productId || colors.length === 0) return
    let cancelled = false
    colors.forEach((color) => {
      const colorSlug = color.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-')
      const modelFilename = `${productId}-3d-${colorSlug}.glb`
      const modelUrl = `${STORAGE_BASE}${encodeURIComponent(modelFilename)}`
      fetch(modelUrl, { method: 'HEAD' })
        .then((res) => { if (!cancelled) setModel3dExists((prev) => ({ ...prev, [color]: res.ok })) })
        .catch(() => { if (!cancelled) setModel3dExists((prev) => ({ ...prev, [color]: false })) })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, colors.join(',')])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Carga única de presets al abrir el formulario. En un producto nuevo
  // desde cero, los valores marcados como default se escriben en el input
  // (valor real, no placeholder). Al duplicar o editar no se pisa nada.
  useEffect(() => {
    let cancelled = false
    fetchPresets().then((doc) => {
      if (cancelled) return
      setPresets(doc)
      if (!isNew || isDuplicate) return
      setMaterial((prev) => prev || defaultValue(doc.materiales))
      setPrintingMethod((prev) => prev || defaultValue(doc.metodos_impresion))
      setPrice((prev) => prev || defaultValue(doc.precios))
      setSalePrice((prev) => prev || defaultValue(doc.precios_oferta))
    })
    return () => { cancelled = true }
  }, [isNew, isDuplicate])

  // Rellena de golpe los campos de una plantilla. Nombre, slug y descripción
  // nunca se tocan.
  function applyTemplate(t: Plantilla) {
    if (touched && !confirm('Se reemplazarán los valores actuales excepto nombre y descripción. ¿Continuar?')) {
      return
    }
    if (t.garment_type) setGarmentType(t.garment_type)
    if (t.price != null) setPrice(String(t.price))
    setSalePrice(t.sale_price != null ? String(t.sale_price) : '')
    setOnSale(!!t.on_sale)
    setAvailable(t.available !== false)
    setFeatured(!!t.featured)
    setFreeShipping(!!t.free_shipping)
    if (Array.isArray(t.sizes)) setSizes(t.sizes)
    if (Array.isArray(t.colors)) setColors(t.colors)
    // Un campo vacío en la plantilla significa "no lo define", no "bórralo":
    // así una plantilla sin material no pisa el default del formulario.
    if (t.material) setMaterial(t.material)
    if (t.printing_method) setPrintingMethod(t.printing_method)
    setTouched(false)
    showToast(`Plantilla "${t.nombre}" aplicada`)
  }

  // La tabla de variantes se muestra en orden canónico (el de la guía de
  // tallas y el de la paleta), no en el orden en que se marcaron los chips.
  // Lo que no esté en esas listas se agrega al final para no perder celdas.
  const orderedSizes = [
    ...availableSizes.filter((s) => sizes.includes(s)),
    ...sizes.filter((s) => !availableSizes.includes(s)),
  ]
  const paletteNames = colorPalette.map((c) => c.name)
  const orderedColors = [
    ...paletteNames.filter((c) => colors.includes(c)),
    ...colors.filter((c) => !paletteNames.includes(c)),
  ]

  // Cambia tipo o color de una foto ya subida. Optimista: se ve al instante y
  // se revierte si el servidor falla.
  async function updateExtraImage(url: string, patch: { type?: string; color?: string | null }) {
    const antes = extraImages
    setExtraImages((prev) => prev.map((img) => (img.url === url ? { ...img, ...patch } : img)))
    const res = await botFetch(`/api/admin/web/products/${productId}/images`, {
      method: 'PATCH',
      body: JSON.stringify({ url, ...patch }),
    })
    if (!res.ok) {
      setExtraImages(antes)
      const b = await res.json().catch(() => ({}))
      showToast(b.error || 'No se pudo actualizar la foto')
    }
  }

  function handleNameChange(v: string) {
    setName(v)
    if (!idManual) setId(slugify(v))
  }

  function toggleSize(s: string) {
    if (stockMode === 'variantes' && sizes.includes(s)) {
      const registradas = qtyForSize(variantQty, s, colors)
      if (registradas > 0 && !confirm(
        `La talla ${s} tiene ${registradas} ${registradas === 1 ? 'unidad registrada' : 'unidades registradas'}. ¿Quitarla?`,
      )) return
    }
    setTouched(true)
    setSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function toggleColor(name: string) {
    if (stockMode === 'variantes' && colors.includes(name)) {
      const registradas = qtyForColor(variantQty, name, sizes)
      if (registradas > 0 && !confirm(
        `El color ${name} tiene ${registradas} ${registradas === 1 ? 'unidad registrada' : 'unidades registradas'}. ¿Quitarlo?`,
      )) return
    }
    setTouched(true)
    setColors((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name])
  }

  // Cambio de modo. De general a variantes la tabla arranca vacía (se ofrece
  // repartir el total que había). De variantes a general se confirma, porque
  // el detalle por talla y color se pierde.
  function changeStockMode(mode: 'general' | 'variantes') {
    if (mode === stockMode) return
    if (mode === 'general') {
      const total = totalOf(variantQty, sizes, colors)
      if (total > 0 && !confirm(
        `Se perderá el detalle por talla y color. El stock quedará en ${total} ${total === 1 ? 'unidad' : 'unidades'}. ¿Continuar?`,
      )) return
      setStock(String(total))
      setVariantQty({})
    }
    setTouched(true)
    setStockMode(mode)
  }

  function repartirEquitativamente() {
    const total = Math.max(0, Math.floor(Number(stock) || 0))
    if (total <= 0) return
    setVariantQty(distribute(total, orderedSizes, orderedColors))
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
      sizes,
      colors,
      material: material.trim() || null,
      printing_method: printingMethod.trim() || null,
      available,
      featured,
      free_shipping: freeShipping,
      stock_mode: stockMode,
      // En modo variantes el backend recalcula stock como la suma de la tabla.
      ...(stockMode === 'variantes'
        ? { stock_variants: variantsToPayload(variantQty, orderedSizes, orderedColors) }
        : { stock: stock !== '' ? Number(stock) : undefined }),
      // Campos que el formulario no edita pero que sí hay que arrastrar al
      // duplicar, o el producto nuevo nacería como 'unisex' y sin etiquetas.
      ...(isDuplicate && {
        audience: initial?.audience,
        visual_tags: initial?.visual_tags,
      }),
    }

    try {
      const res = isNew
        ? await botFetch('/api/admin/web/products', { method: 'POST', body: JSON.stringify(body) })
        : await botFetch(`/api/admin/web/products/${initial?.id}`, { method: 'PUT', body: JSON.stringify(body) })

      const resBody = await res.json().catch(() => ({}))
      if (!res.ok) { setError(resBody.error || 'No se pudo guardar.'); return }

      const savedId = (resBody.product?.id ?? initial?.id ?? id) as string

      // Duplicado: las imágenes se copian una vez que el producto nuevo
      // existe, porque los archivos en Storage se nombran con su slug.
      if (isDuplicate && duplicateFrom) {
        showToast('Producto creado — copiando imágenes…')
        try {
          const copyRes = await botFetch(`/api/admin/web/products/${savedId}/copy-images`, {
            method: 'POST',
            body: JSON.stringify({ source_id: duplicateFrom }),
          })
          if (!copyRes.ok) {
            const b = await copyRes.json().catch(() => ({}))
            showToast(`Producto creado, pero las imágenes no se copiaron: ${b.error ?? 'error'}`)
          }
        } catch {
          showToast('Producto creado, pero las imágenes no se copiaron.')
        }
      } else {
        showToast(isNew ? 'Producto creado ✅' : 'Producto actualizado ✅')
      }

      setTimeout(() => onSaved(savedId), 800)
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
      {/* Plantillas — solo al crear, nunca al editar un producto existente */}
      {isNew && presets.plantillas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200">
          <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Empezar desde:
          </span>
          {presets.plantillas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 text-xs rounded-full border border-gray-300 text-gray-700 hover:border-gray-900 hover:bg-gray-50 transition-colors"
            >
              {t.nombre}
            </button>
          ))}
        </div>
      )}

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
          <select value={garmentType}
            onChange={(e) => { setTouched(true); setGarmentType(e.target.value) }} className={INPUT}>
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
        <div className="grid grid-cols-3 gap-4 items-start">
          <Field label="Precio (COP)">
            <input type="number" value={price}
              onChange={(e) => { setTouched(true); setPrice(e.target.value) }}
              className={INPUT} placeholder="90000" />
            <PresetChips
              values={presets.precios}
              current={price}
              onPick={(v) => { setTouched(true); setPrice(v) }}
              format={formatCop}
            />
          </Field>
          <Field label="Precio de oferta (COP)">
            <input type="number" value={salePrice}
              onChange={(e) => { setTouched(true); setSalePrice(e.target.value) }}
              className={INPUT} placeholder="70000" />
            <PresetChips
              values={presets.precios_oferta}
              current={salePrice}
              onPick={(v) => { setTouched(true); setSalePrice(v) }}
              format={formatCop}
            />
            <DiscountChips
              values={presets.descuentos}
              basePrice={price}
              currentSalePrice={salePrice}
              onPick={(v) => { setTouched(true); setSalePrice(v) }}
              compute={applyDiscount}
            />
          </Field>
          <Field label="Stock">
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="stock-mode" checked={stockMode === 'general'}
                  onChange={() => changeStockMode('general')} />
                General
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="stock-mode" checked={stockMode === 'variantes'}
                  onChange={() => changeStockMode('variantes')} />
                Personalizado
              </label>
            </div>
            {stockMode === 'general' && (
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)}
                className={`${INPUT} mt-2`} placeholder="0" />
            )}
          </Field>
        </div>

        {stockMode === 'variantes' && (
          <div className="border border-gray-200 rounded p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-xs text-gray-500">
                Unidades por talla y color. El total se guarda como el stock del producto.
              </p>
              {Number(stock) > 0 && orderedSizes.length > 0 && totalOf(variantQty, orderedSizes, orderedColors) === 0 && (
                <button type="button" onClick={repartirEquitativamente}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:border-gray-900 whitespace-nowrap">
                  Repartir {Math.floor(Number(stock))} unidades equitativamente
                </button>
              )}
            </div>
            <StockVariants
              sizes={orderedSizes}
              colors={orderedColors}
              qty={variantQty}
              onChange={(q) => { setTouched(true); setVariantQty(q) }}
            />
          </div>
        )}
        <Field label="Estado">
          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle label="En oferta" value={onSale} onChange={setOnSale} />
            <Toggle label="Mostrar" value={available} onChange={setAvailable} />
            <Toggle label="Destacado" value={featured} onChange={setFeatured} />
            <Toggle label="Envío gratis siempre 🎁" value={freeShipping} onChange={setFreeShipping} />
          </div>
        </Field>
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
        <p className="text-xs text-gray-400 mb-3">
          Selecciona los colores disponibles para esta prenda. Deja vacío si es prenda única sin variantes de color.
          Para crear nuevos colores ve a <strong>Colores</strong> en el menú lateral.
        </p>
        {colorPalette.length === 0 ? (
          <p className="text-xs text-amber-600">No hay colores creados aún. Ve a <strong>Colores</strong> para crearlos.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {colorPalette.map((c) => {
              const selected = colors.includes(c.name)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleColor(c.name)}
                  title={c.name}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: c.hex,
                    border: selected
                      ? '3px solid #111'
                      : c.hex.toUpperCase() === '#FFFFFF' ? '2px solid #ddd' : '2px solid transparent',
                    boxShadow: selected ? '0 0 0 1px #fff, 0 0 0 3px #111' : '0 2px 4px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'box-shadow 0.15s, border 0.15s',
                    position: 'relative',
                  }}>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs ${selected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {c.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {colors.length === 0 && colorPalette.length > 0 && (
          <p className="text-xs text-gray-400 italic mt-2">Sin colores → prenda única (no muestra selector en la tienda)</p>
        )}
      </Section>

      {/* Detalles */}
      <Section title="Detalles de fabricación">
        <Field label="Material">
          <input value={material}
            onChange={(e) => { setTouched(true); setMaterial(e.target.value) }}
            className={INPUT} placeholder="100% algodón" />
          <PresetChips
            values={presets.materiales}
            current={material}
            onPick={(v) => { setTouched(true); setMaterial(v) }}
            quickSaveList="materiales"
            onPresetsChanged={setPresets}
            canEditPresets={can('presets_edit')}
          />
        </Field>
        <Field label="Método de impresión">
          <input value={printingMethod}
            onChange={(e) => { setTouched(true); setPrintingMethod(e.target.value) }}
            className={INPUT} placeholder="DTF" />
          <PresetChips
            values={presets.metodos_impresion}
            current={printingMethod}
            onPick={(v) => { setTouched(true); setPrintingMethod(v) }}
            quickSaveList="metodos_impresion"
            onPresetsChanged={setPresets}
            canEditPresets={can('presets_edit')}
          />
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
                  {modelExistsNow && (
                    <model-viewer
                      key={key}
                      src={`${modelUrl}?t=${key}`}
                      camera-controls
                      auto-rotate
                      camera-target="0m 0m -4.4017m"
                      camera-orbit="0deg 75deg 26m"
                      min-camera-orbit="auto auto 12m"
                      max-camera-orbit="auto auto 65m"
                      field-of-view="30deg"
                      shadow-intensity="1"
                      style={{ width: '100%', height: '180px', borderRadius: '8px', backgroundColor: '#f9f9f9', marginBottom: '8px' }}
                    />
                  )}
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
                        title="Comprimir modelo 3D (reduce el tamaño del archivo)"
                        disabled={optimizingModel[color]}
                        onClick={async () => {
                          setOptimizingModel((prev) => ({ ...prev, [color]: true }))
                          try {
                            const res = await botFetch(
                              `/api/admin/web/products/${productId}/optimize-model`,
                              { method: 'POST', body: JSON.stringify({ color, ext: 'glb' }) },
                            )
                            const body = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(body.error || 'Error al comprimir')
                            const beforeMb = (body.before_size / 1024 / 1024).toFixed(1)
                            const afterMb = (body.after_size / 1024 / 1024).toFixed(1)
                            setModel3dKeys((prev) => ({ ...prev, [color]: Date.now() }))
                            showToast(`Modelo de ${color} comprimido: ${beforeMb}MB → ${afterMb}MB ✅`)
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Error de conexión')
                          } finally {
                            setOptimizingModel((prev) => ({ ...prev, [color]: false }))
                          }
                        }}
                        className="px-2 py-1.5 text-xs border border-gray-300 rounded text-gray-500 hover:border-gray-500 disabled:opacity-50"
                      >
                        {optimizingModel[color] ? 'Comprimiendo…' : '🗜 Comprimir'}
                      </button>
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
              {extraImages.map((img) => (
                <div key={img.url} className="relative border border-gray-200 rounded overflow-hidden">
                  <img src={img.url} alt={img.type} className="w-full h-28 object-cover bg-gray-50" />
                  <div className="p-1.5 bg-gray-50 space-y-1">
                    <select
                      value={img.type}
                      onChange={(e) => updateExtraImage(img.url, { type: e.target.value })}
                      className="w-full px-1.5 py-1 text-[11px] border border-gray-300 rounded bg-white"
                      title="Tipo de foto"
                    >
                      {Object.entries(TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <select
                      value={img.color ?? ''}
                      onChange={(e) => updateExtraImage(img.url, { color: e.target.value || null })}
                      className="w-full px-1.5 py-1 text-[11px] border border-gray-300 rounded bg-white"
                      title="Color al que pertenece esta foto"
                    >
                      <option value="">Todos los colores</option>
                      {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                      {/* Un color que ya no está marcado en el producto sigue visible */}
                      {img.color && !colors.includes(img.color) && (
                        <option value={img.color}>{img.color}</option>
                      )}
                    </select>
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
                        setExtraImages((prev) => prev.filter((x) => x.url !== img.url))
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
              <label className="block text-xs text-gray-500 mb-1">Tipo de las fotos nuevas</label>
              <select value={extraImageType} onChange={(e) => setExtraImageType(e.target.value as typeof extraImageType)}
                className={INPUT}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color de las fotos nuevas</label>
              <select value={extraImageColor} onChange={(e) => setExtraImageColor(e.target.value)}
                className={`${INPUT} w-40`}>
                <option value="">Todos los colores</option>
                {colors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={uploadingExtra !== null}
              onClick={() => extraFileRef.current?.click()}
              className="px-3 py-2 text-xs border border-gray-300 rounded hover:border-gray-500 disabled:opacity-50"
            >
              {uploadingExtra ?? '+ Subir fotos'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Puedes elegir varias fotos a la vez. Después de subirlas, cambia el tipo o el color de cada una desde su miniatura.
          </p>
          <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length === 0) return
              let subidas = 0
              const fallidas: string[] = []
              // Una por una: el servidor agrega cada foto al arreglo leyendo el
              // estado actual, y en paralelo dos subidas se pisarían entre sí.
              for (let n = 0; n < files.length; n++) {
                const file = files[n]
                setUploadingExtra(files.length > 1 ? `Subiendo ${n + 1} de ${files.length}…` : 'Subiendo…')
                const fd = new FormData()
                fd.append('file', file)
                fd.append('type', extraImageType)
                if (extraImageColor.trim()) fd.append('color', extraImageColor.trim())
                const res = await botFetch(`/api/admin/web/products/${productId}/images`, { method: 'POST', headers: {}, body: fd })
                if (res.ok) {
                  const { image } = await res.json()
                  setExtraImages((prev) => [...prev, image])
                  subidas++
                } else {
                  fallidas.push(file.name)
                }
              }
              setUploadingExtra(null)
              showToast(fallidas.length
                ? `${subidas} subida(s), fallaron: ${fallidas.join(', ')}`
                : subidas === 1 ? 'Foto subida ✅' : `${subidas} fotos subidas ✅`)
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
