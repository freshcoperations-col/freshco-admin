import { botFetch } from './api'

// Valores rápidos (chips) y plantillas del formulario de producto.
// Viven en una sola fila de app_settings en Supabase; el bot los expone
// en /api/admin/web/presets.

export const VALUE_LISTS = [
  'materiales',
  'metodos_impresion',
  'precios',
  'precios_oferta',
  'descuentos',
] as const

export type ValueList = typeof VALUE_LISTS[number]

export const LIST_LABELS: Record<ValueList, string> = {
  materiales: 'Materiales',
  metodos_impresion: 'Métodos de impresión',
  precios: 'Precios (COP)',
  precios_oferta: 'Precios de oferta (COP)',
  descuentos: 'Descuentos (%)',
}

export const LIST_HINTS: Record<ValueList, string> = {
  materiales: 'Aparecen como chips debajo del campo Material.',
  metodos_impresion: 'Aparecen como chips debajo del campo Método de impresión.',
  precios: 'Aparecen como chips debajo del campo Precio (COP).',
  precios_oferta: 'Aparecen como chips debajo del campo Precio de oferta (COP).',
  descuentos: 'Calculan el precio de oferta a partir del precio base, redondeando al millar.',
}

export const NUMERIC_LISTS: ValueList[] = ['precios', 'precios_oferta', 'descuentos']

export function isNumericList(list: ValueList): boolean {
  return NUMERIC_LISTS.includes(list)
}

export interface PresetValue {
  id: string
  valor: string | number
  orden: number
  esDefault: boolean
}

export interface Plantilla {
  id: string
  nombre: string
  garment_type?: string
  price?: number | null
  sale_price?: number | null
  on_sale?: boolean
  available?: boolean
  featured?: boolean
  free_shipping?: boolean
  sizes?: string[]
  colors?: string[]
  material?: string | null
  printing_method?: string | null
}

export interface PresetsDoc {
  materiales: PresetValue[]
  metodos_impresion: PresetValue[]
  precios: PresetValue[]
  precios_oferta: PresetValue[]
  descuentos: PresetValue[]
  plantillas: Plantilla[]
}

export const EMPTY_PRESETS: PresetsDoc = {
  materiales: [],
  metodos_impresion: [],
  precios: [],
  precios_oferta: [],
  descuentos: [],
  plantillas: [],
}

export async function fetchPresets(): Promise<PresetsDoc> {
  try {
    const res = await botFetch('/api/admin/web/presets', { method: 'GET' })
    if (!res.ok) return EMPTY_PRESETS
    const body = await res.json()
    return { ...EMPTY_PRESETS, ...(body.presets ?? {}) }
  } catch {
    // El formulario tiene que abrir igual aunque los presets fallen —
    // los chips son un atajo, nunca un requisito.
    return EMPTY_PRESETS
  }
}

export async function savePresets(patch: Partial<PresetsDoc>): Promise<{ ok: boolean; error?: string }> {
  const res = await botFetch('/api/admin/web/presets', {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  if (res.ok) return { ok: true }
  const body = await res.json().catch(() => ({}))
  return { ok: false, error: body.error ?? 'No se pudo guardar.' }
}

// "+ guardar como rápido": agrega un valor suelto sin reemplazar la lista.
export async function addPresetValue(
  lista: ValueList,
  valor: string | number,
): Promise<{ ok: boolean; presets?: PresetsDoc; error?: string }> {
  const res = await botFetch('/api/admin/web/presets', {
    method: 'POST',
    body: JSON.stringify({ lista, valor }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error ?? 'No se pudo guardar.' }
  return { ok: true, presets: body.presets }
}

// Los chips de precio se muestran formateados pero escriben el número plano.
export function formatCop(value: string | number): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('es-CO') : String(value)
}

// Precio base menos un porcentaje, redondeado al millar más cercano.
// Ej: 90000 con 30% → 63000.
export function applyDiscount(basePrice: number, percent: number): number {
  const raw = basePrice * (1 - percent / 100)
  return Math.round(raw / 1000) * 1000
}

export function defaultValue(list: PresetValue[]): string {
  const found = list.find((v) => v.esDefault)
  return found ? String(found.valor) : ''
}
