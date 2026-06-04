'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'

interface Measurement {
  label: string
  values: Record<string, string>
}

interface SizeGuide {
  garment_type: string
  label: string
  sizes: string[]
  measurements: Measurement[]
}

export default function SizesPage() {
  const [guides, setGuides] = useState<SizeGuide[]>([])
  const [selected, setSelected] = useState<string>('')
  const [guide, setGuide] = useState<SizeGuide | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newSize, setNewSize] = useState('')
  const [newMeasLabel, setNewMeasLabel] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const res = await botFetch('/api/admin/web/size-guide')
    if (res.ok) {
      const body = await res.json()
      setGuides(body.guides ?? [])
      if (!selected && body.guides?.length) {
        setSelected(body.guides[0].garment_type)
      }
    }
  }, [selected])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) return
    const g = guides.find((x) => x.garment_type === selected)
    if (g) setGuide(JSON.parse(JSON.stringify(g)))  // deep copy
  }, [selected, guides])

  async function handleSave() {
    if (!guide) return
    setSaving(true)
    const res = await botFetch(`/api/admin/web/size-guide/${guide.garment_type}`, {
      method: 'PUT',
      body: JSON.stringify({ sizes: guide.sizes, measurements: guide.measurements }),
    })
    setSaving(false)
    if (res.ok) {
      showToast('Guardado ✅')
      load()
    } else {
      const b = await res.json().catch(() => ({}))
      showToast(b.error || 'Error al guardar')
    }
  }

  function addSize() {
    const s = newSize.trim()
    if (!s || !guide || guide.sizes.includes(s)) return
    const updated = { ...guide, sizes: [...guide.sizes, s] }
    // Add empty value column to all measurements
    updated.measurements = updated.measurements.map((m) => ({
      ...m,
      values: { ...m.values, [s]: '' },
    }))
    setGuide(updated)
    setNewSize('')
  }

  function removeSize(s: string) {
    if (!guide) return
    const updated = {
      ...guide,
      sizes: guide.sizes.filter((x) => x !== s),
      measurements: guide.measurements.map((m) => {
        const v = { ...m.values }
        delete v[s]
        return { ...m, values: v }
      }),
    }
    setGuide(updated)
  }

  function addMeasurement() {
    const l = newMeasLabel.trim()
    if (!l || !guide) return
    const values: Record<string, string> = {}
    guide.sizes.forEach((s) => { values[s] = '' })
    setGuide({ ...guide, measurements: [...guide.measurements, { label: l, values }] })
    setNewMeasLabel('')
  }

  function removeMeasurement(idx: number) {
    if (!guide) return
    setGuide({ ...guide, measurements: guide.measurements.filter((_, i) => i !== idx) })
  }

  function updateCell(rowIdx: number, size: string, value: string) {
    if (!guide) return
    const measurements = guide.measurements.map((m, i) =>
      i === rowIdx ? { ...m, values: { ...m.values, [size]: value } } : m,
    )
    setGuide({ ...guide, measurements })
  }

  function updateMeasLabel(idx: number, value: string) {
    if (!guide) return
    const measurements = guide.measurements.map((m, i) =>
      i === idx ? { ...m, label: value } : m,
    )
    setGuide({ ...guide, measurements })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: tipos de prenda */}
      <div className="w-44 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Tipo de prenda
        </div>
        <div className="flex-1 overflow-y-auto">
          {guides.map((g) => (
            <button
              key={g.garment_type}
              onClick={() => setSelected(g.garment_type)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-50 ${
                selected === g.garment_type ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel principal */}
      <div className="flex-1 overflow-y-auto p-6">
        {!guide ? (
          <div className="text-sm text-gray-400">Selecciona un tipo de prenda.</div>
        ) : (
          <div className="max-w-4xl space-y-8">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">{guide.label}</h1>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>

            {/* Tallas disponibles */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Tallas disponibles
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Estas son las tallas que aparecen en el formulario de producto y en la guía de la web.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {guide.sizes.map((s) => (
                  <span key={s} className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-full">
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSize(s)}
                      className="text-gray-400 hover:text-white ml-1"
                    >×</button>
                  </span>
                ))}
                {guide.sizes.length === 0 && (
                  <span className="text-xs text-gray-400">Sin tallas. Agrega una abajo.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                  placeholder="Nueva talla (S, M, L, 28, L/XL…)"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500 w-56"
                />
                <button
                  type="button"
                  onClick={addSize}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:border-gray-500"
                >
                  + Agregar
                </button>
              </div>
            </section>

            {/* Tabla de medidas */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Tabla de medidas
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Se muestra en la página del producto para que los clientes elijan su talla.
                Cada fila es una medida (ancho, largo, etc.), las columnas son las tallas.
              </p>

              {guide.sizes.length === 0 ? (
                <p className="text-xs text-gray-400">Agrega tallas primero para editar las medidas.</p>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-48">
                            Medida
                          </th>
                          {guide.sizes.map((s) => (
                            <th key={s} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 min-w-[70px]">
                              {s}
                            </th>
                          ))}
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {guide.measurements.map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1">
                              <input
                                value={row.label}
                                onChange={(e) => updateMeasLabel(ri, e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-400"
                                placeholder="Ej: Ancho pecho (cm)"
                              />
                            </td>
                            {guide.sizes.map((s) => (
                              <td key={s} className="px-2 py-1 text-center">
                                <input
                                  value={row.values[s] ?? ''}
                                  onChange={(e) => updateCell(ri, s, e.target.value)}
                                  className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-gray-400"
                                  placeholder="—"
                                />
                              </td>
                            ))}
                            <td className="px-2 py-1 text-center">
                              <button
                                type="button"
                                onClick={() => removeMeasurement(ri)}
                                className="text-gray-300 hover:text-red-500 text-sm"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                        {guide.measurements.length === 0 && (
                          <tr>
                            <td colSpan={guide.sizes.length + 2} className="px-4 py-4 text-xs text-gray-400 text-center">
                              Sin medidas. Agrega una abajo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <input
                      value={newMeasLabel}
                      onChange={(e) => setNewMeasLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMeasurement())}
                      placeholder="Nueva medida (ej: Ancho pecho (cm))"
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-500 w-72"
                    />
                    <button
                      type="button"
                      onClick={addMeasurement}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:border-gray-500"
                    >
                      + Agregar fila
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
