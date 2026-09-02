'use client'

import { useState } from 'react'
import {
  addPresetValue,
  formatCop,
  type PresetValue,
  type PresetsDoc,
  type ValueList,
} from '@/lib/presets'

// Fila de chips debajo de un input del formulario de producto.
//
// Reglas (instrucción del admin):
//  - Click en un chip escribe ese valor en el input.
//  - El chip cuyo valor coincide con el input se ve activo (fondo oscuro).
//  - Click en el chip activo limpia el input.
//  - El input sigue siendo libre: los chips son un atajo, nunca una restricción.

interface PresetChipsProps {
  values: PresetValue[]
  /** Valor actual del input, como string (así viene de useState). */
  current: string
  onPick: (value: string) => void
  /** Formatea el texto del chip sin cambiar lo que se escribe en el input. */
  format?: (value: string | number) => string
  /** Lista donde guardar con "+ guardar como rápido". Omitir para ocultar el enlace. */
  quickSaveList?: ValueList
  onPresetsChanged?: (presets: PresetsDoc) => void
  canEditPresets?: boolean
  emptyHint?: string
}

export function PresetChips({
  values,
  current,
  onPick,
  format,
  quickSaveList,
  onPresetsChanged,
  canEditPresets = true,
  emptyHint,
}: PresetChipsProps) {
  const [savingQuick, setSavingQuick] = useState(false)

  const trimmed = current.trim()
  const isActive = (v: PresetValue) => trimmed !== '' && String(v.valor) === trimmed

  // El enlace de guardado rápido solo aparece con un valor escrito que no
  // esté ya en la lista.
  const showQuickSave =
    !!quickSaveList &&
    canEditPresets &&
    trimmed !== '' &&
    !values.some((v) => String(v.valor).toLowerCase() === trimmed.toLowerCase())

  async function handleQuickSave() {
    if (!quickSaveList) return
    setSavingQuick(true)
    const res = await addPresetValue(quickSaveList, trimmed)
    setSavingQuick(false)
    if (res.ok && res.presets) onPresetsChanged?.(res.presets)
  }

  if (values.length === 0 && !showQuickSave) {
    return emptyHint ? <p className="text-xs text-gray-400 mt-1.5">{emptyHint}</p> : null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5">
      {values.map((v) => {
        const active = isActive(v)
        return (
          <button
            key={v.id}
            type="button"
            // Click en el chip activo limpia el input.
            onClick={() => onPick(active ? '' : String(v.valor))}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'
            }`}
          >
            {format ? format(v.valor) : String(v.valor)}
          </button>
        )
      })}

      {showQuickSave && (
        <button
          type="button"
          onClick={handleQuickSave}
          disabled={savingQuick}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50 whitespace-nowrap"
        >
          {savingQuick ? 'guardando…' : '+ guardar como rápido'}
        </button>
      )}
    </div>
  )
}

// Chips de descuento: calculan el precio de oferta a partir del precio base.
// Se desactivan si todavía no hay precio base con el que calcular.
export function DiscountChips({
  values,
  basePrice,
  currentSalePrice,
  onPick,
  compute,
}: {
  values: PresetValue[]
  basePrice: string
  currentSalePrice: string
  onPick: (value: string) => void
  compute: (base: number, percent: number) => number
}) {
  if (values.length === 0) return null

  const base = Number(basePrice)
  const hasBase = Number.isFinite(base) && base > 0

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className="text-xs text-gray-400">Desde el precio base:</span>
      {values.map((v) => {
        const percent = Number(v.valor)
        const result = hasBase ? compute(base, percent) : null
        const active = result != null && String(result) === currentSalePrice.trim()
        return (
          <button
            key={v.id}
            type="button"
            disabled={!hasBase}
            title={hasBase ? `${formatCop(base)} − ${percent}% = ${formatCop(result!)}` : 'Escribe primero el precio base'}
            onClick={() => onPick(active ? '' : String(result))}
            className={`px-3 py-1 text-xs rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'
            }`}
          >
            −{percent}%
          </button>
        )
      })}
    </div>
  )
}
