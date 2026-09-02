'use client'

import { useCallback, useEffect, useState } from 'react'
import { botFetch } from '@/lib/api'
import { usePermissions } from '@/contexts/PermissionsContext'
import {
  EMPTY_PRESETS,
  LIST_HINTS,
  LIST_LABELS,
  VALUE_LISTS,
  fetchPresets,
  formatCop,
  isNumericList,
  savePresets,
  type Plantilla,
  type PresetValue,
  type PresetsDoc,
  type ValueList,
} from '@/lib/presets'

interface GarmentType { id: string; label: string }
interface ColorEntry { id: string; name: string; hex: string }

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white'

function newLocalId(prefix: string): string {
  return `${prefix.slice(0, 3)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export default function PresetsPage() {
  const { can, loading: permLoading } = usePermissions()
  const canEdit = can('presets_edit')

  const [tab, setTab] = useState<'valores' | 'plantillas'>('valores')
  const [presets, setPresets] = useState<PresetsDoc>(EMPTY_PRESETS)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([])
  const [palette, setPalette] = useState<ColorEntry[]>([])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [doc, metaRes, colorsRes] = await Promise.all([
      fetchPresets(),
      botFetch('/api/admin/web/meta', { method: 'GET' }),
      botFetch('/api/admin/web/colors', { method: 'GET' }),
    ])
    setPresets(doc)
    if (metaRes.ok) {
      const body = await metaRes.json()
      setGarmentTypes(body.garment_types ?? [])
    }
    if (colorsRes.ok) {
      const body = await colorsRes.json()
      setPalette(body.colors ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Guarda una lista completa y sincroniza el estado con lo que devolvió
  // el servidor (que normaliza orden y el default único).
  async function persist(patch: Partial<PresetsDoc>, okMsg: string) {
    const optimistic = { ...presets, ...patch }
    setPresets(optimistic)
    const res = await savePresets(patch)
    if (!res.ok) {
      showToast(res.error ?? 'No se pudo guardar.')
      await load()
      return
    }
    showToast(okMsg)
  }

  if (loading || permLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando…</div>
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1">Presets</h1>
      <p className="text-sm text-gray-500 mb-6">
        Valores rápidos y plantillas del formulario de producto. Lo que agregues acá aparece
        como chip en <strong>Nuevo producto</strong> sin tener que tocar código.
      </p>

      {!canEdit && (
        <p className="mb-6 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Tu rol puede ver los presets pero no modificarlos.
        </p>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabButton active={tab === 'valores'} onClick={() => setTab('valores')}>Valores</TabButton>
        <TabButton active={tab === 'plantillas'} onClick={() => setTab('plantillas')}>Plantillas</TabButton>
      </div>

      {tab === 'valores' ? (
        <div className="space-y-8">
          {VALUE_LISTS.map((list) => (
            <ValueListEditor
              key={list}
              list={list}
              values={presets[list]}
              canEdit={canEdit}
              onChange={(values) => persist({ [list]: values } as Partial<PresetsDoc>, 'Guardado ✅')}
            />
          ))}
        </div>
      ) : (
        <PlantillasEditor
          plantillas={presets.plantillas}
          garmentTypes={garmentTypes}
          palette={palette}
          canEdit={canEdit}
          onChange={(plantillas) => persist({ plantillas }, 'Plantillas guardadas ✅')}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active ? 'border-gray-900 font-semibold text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Listas de valores ────────────────────────────────────────────────────────

function ValueListEditor({
  list,
  values,
  canEdit,
  onChange,
}: {
  list: ValueList
  values: PresetValue[]
  canEdit: boolean
  onChange: (values: PresetValue[]) => void
}) {
  const numeric = isNumericList(list)
  const [draft, setDraft] = useState('')

  function add() {
    const raw = draft.trim()
    if (!raw) return
    const valor: string | number = numeric ? Number(raw) : raw
    if (numeric && (!Number.isFinite(valor as number) || (valor as number) < 0)) return
    if (values.some((v) => String(v.valor).toLowerCase() === String(valor).toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...values, { id: newLocalId(list), valor, orden: values.length, esDefault: false }])
    setDraft('')
  }

  function remove(id: string) {
    onChange(values.filter((v) => v.id !== id).map((v, i) => ({ ...v, orden: i })))
  }

  // Máximo un default por lista: marcar uno desmarca el resto.
  function toggleDefault(id: string) {
    onChange(values.map((v) => ({ ...v, esDefault: v.id === id ? !v.esDefault : false })))
  }

  function move(index: number, delta: number) {
    const next = [...values]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next.map((v, i) => ({ ...v, orden: i })))
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-1">{LIST_LABELS[list]}</h2>
      <p className="text-xs text-gray-400 mb-3">{LIST_HINTS[list]}</p>

      {values.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">Sin valores todavía.</p>
      )}

      <ul className="border border-gray-200 rounded divide-y divide-gray-100 mb-3">
        {values.map((v, i) => (
          <li key={v.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex flex-col">
              <button type="button" disabled={!canEdit || i === 0} onClick={() => move(i, -1)}
                className="text-[10px] leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30">▲</button>
              <button type="button" disabled={!canEdit || i === values.length - 1} onClick={() => move(i, 1)}
                className="text-[10px] leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30">▼</button>
            </div>

            <span className="flex-1 text-sm">
              {numeric && list !== 'descuentos' ? formatCop(v.valor) : String(v.valor)}
              {list === 'descuentos' && '%'}
            </span>

            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={v.esDefault} disabled={!canEdit}
                onChange={() => toggleDefault(v.id)} className="rounded" />
              por defecto
            </label>

            <button type="button" disabled={!canEdit} onClick={() => remove(v.id)}
              className="text-xs text-red-600 hover:underline disabled:opacity-40">
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            type={numeric ? 'number' : 'text'}
            className={INPUT}
            placeholder={numeric ? (list === 'descuentos' ? '25' : '95000') : 'Nuevo valor'}
          />
          <button type="button" onClick={add}
            className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded whitespace-nowrap">
            Agregar
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

const SIZES_BY_TYPE: Record<string, string[]> = {
  camisetas: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  hoodies: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  sudaderas: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  chaquetas: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  gorras: ['L/XL'],
  pantalones: ['28', '30', '32', '34', '36', '38'],
}

function PlantillasEditor({
  plantillas,
  garmentTypes,
  palette,
  canEdit,
  onChange,
}: {
  plantillas: Plantilla[]
  garmentTypes: GarmentType[]
  palette: ColorEntry[]
  canEdit: boolean
  onChange: (plantillas: Plantilla[]) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  function update(id: string, patch: Partial<Plantilla>) {
    onChange(plantillas.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function remove(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    onChange(plantillas.filter((p) => p.id !== id))
  }

  function add() {
    const id = newLocalId('plantilla')
    onChange([
      ...plantillas,
      {
        id,
        nombre: 'Nueva plantilla',
        garment_type: garmentTypes[0]?.id ?? '',
        price: null,
        sale_price: null,
        on_sale: false,
        available: true,
        featured: false,
        free_shipping: false,
        sizes: [],
        colors: [],
        material: '',
        printing_method: '',
      },
    ])
    setOpenId(id)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Cada plantilla llena de golpe tipo de prenda, precios, estado, tallas, colores,
        material y método. Nombre, slug y descripción del producto nunca se tocan.
      </p>

      {plantillas.length === 0 && (
        <p className="text-sm text-gray-400 py-4">Sin plantillas todavía.</p>
      )}

      {plantillas.map((t) => {
        const open = openId === t.id
        const sizeOptions = SIZES_BY_TYPE[t.garment_type ?? ''] ?? SIZES_BY_TYPE.camisetas
        return (
          <div key={t.id} className="border border-gray-200 rounded">
            <div className="flex items-center justify-between px-4 py-3">
              <button type="button" onClick={() => setOpenId(open ? null : t.id)}
                className="text-sm font-medium text-left flex-1">
                {t.nombre}
                <span className="ml-2 text-xs text-gray-400">
                  {garmentTypes.find((g) => g.id === t.garment_type)?.label ?? t.garment_type}
                  {t.price != null && ` · ${formatCop(t.price)}`}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setOpenId(open ? null : t.id)}
                  className="text-xs text-gray-500 hover:text-gray-900">
                  {open ? 'Cerrar' : 'Editar'}
                </button>
                <button type="button" disabled={!canEdit} onClick={() => remove(t.id)}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40">
                  Eliminar
                </button>
              </div>
            </div>

            {open && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Nombre de la plantilla</span>
                    <input value={t.nombre} disabled={!canEdit}
                      onChange={(e) => update(t.id, { nombre: e.target.value })} className={INPUT} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Tipo de prenda</span>
                    <select value={t.garment_type ?? ''} disabled={!canEdit}
                      onChange={(e) => update(t.id, { garment_type: e.target.value, sizes: [] })}
                      className={INPUT}>
                      {garmentTypes.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Precio (COP)</span>
                    <input type="number" value={t.price ?? ''} disabled={!canEdit}
                      onChange={(e) => update(t.id, { price: e.target.value === '' ? null : Number(e.target.value) })}
                      className={INPUT} placeholder="90000" />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Precio de oferta (COP)</span>
                    <input type="number" value={t.sale_price ?? ''} disabled={!canEdit}
                      onChange={(e) => update(t.id, { sale_price: e.target.value === '' ? null : Number(e.target.value) })}
                      className={INPUT} placeholder="70000" />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Material</span>
                    <input value={t.material ?? ''} disabled={!canEdit}
                      onChange={(e) => update(t.id, { material: e.target.value })}
                      className={INPUT} placeholder="100% algodón" />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Método de impresión</span>
                    <input value={t.printing_method ?? ''} disabled={!canEdit}
                      onChange={(e) => update(t.id, { printing_method: e.target.value })}
                      className={INPUT} placeholder="DTF" />
                  </label>
                </div>

                <div>
                  <span className="block text-xs text-gray-600 mb-1.5">Estado</span>
                  <div className="flex flex-wrap gap-4">
                    <Check label="En oferta" checked={!!t.on_sale} disabled={!canEdit}
                      onChange={(v) => update(t.id, { on_sale: v })} />
                    <Check label="Mostrar" checked={t.available !== false} disabled={!canEdit}
                      onChange={(v) => update(t.id, { available: v })} />
                    <Check label="Destacado" checked={!!t.featured} disabled={!canEdit}
                      onChange={(v) => update(t.id, { featured: v })} />
                    <Check label="Envío gratis siempre 🎁" checked={!!t.free_shipping} disabled={!canEdit}
                      onChange={(v) => update(t.id, { free_shipping: v })} />
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-gray-600 mb-1.5">Tallas</span>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((s) => {
                      const on = (t.sizes ?? []).includes(s)
                      return (
                        <button key={s} type="button" disabled={!canEdit}
                          onClick={() => update(t.id, {
                            sizes: on ? (t.sizes ?? []).filter((x) => x !== s) : [...(t.sizes ?? []), s],
                          })}
                          className={`px-3 py-1.5 text-xs rounded border ${on
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}>
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-gray-600 mb-1.5">Colores</span>
                  <div className="flex flex-wrap gap-2">
                    {palette.map((c) => {
                      const on = (t.colors ?? []).includes(c.name)
                      return (
                        <button key={c.id} type="button" disabled={!canEdit}
                          onClick={() => update(t.id, {
                            colors: on ? (t.colors ?? []).filter((x) => x !== c.name) : [...(t.colors ?? []), c.name],
                          })}
                          className={`px-3 py-1 text-xs rounded-full border flex items-center gap-1.5 ${on
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}>
                          <span className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: c.hex }} />
                          {c.name}
                        </button>
                      )
                    })}
                    {palette.length === 0 && (
                      <span className="text-xs text-gray-400">
                        No hay colores en la paleta. Agrégalos en <strong>Colores</strong>.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {canEdit && (
        <button type="button" onClick={add}
          className="px-4 py-2 text-xs uppercase tracking-wide border border-gray-300 rounded hover:border-gray-900">
          Agregar plantilla
        </button>
      )}
    </div>
  )
}

function Check({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  )
}
