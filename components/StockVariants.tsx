'use client'

import { useState } from 'react'

// Tabla de stock por variante: filas = tallas marcadas, columnas = colores
// marcados. Si el producto no tiene colores (prenda única) queda una sola
// columna "Único".
//
// Las cantidades viven en un mapa talla||color para que marcar o desmarcar
// una talla o un color arriba no pierda lo ya escrito en las demás celdas.

export const SIN_COLOR = ''

export function vKey(size: string, color: string): string {
  return `${size}||${color}`
}

export type VariantQty = Record<string, number>

/** Convierte el mapa a lo que guarda la API, descartando las celdas en 0. */
export function variantsToPayload(
  qty: VariantQty,
  sizes: string[],
  colors: string[],
): Array<{ size: string | null; color: string | null; quantity: number }> {
  const cols = colors.length > 0 ? colors : [SIN_COLOR]
  const out: Array<{ size: string | null; color: string | null; quantity: number }> = []
  for (const size of sizes) {
    for (const color of cols) {
      const quantity = qty[vKey(size, color)] ?? 0
      if (quantity > 0) {
        out.push({ size: size || null, color: color === SIN_COLOR ? null : color, quantity })
      }
    }
  }
  return out
}

/** Reconstruye el mapa desde lo que devuelve la API. */
export function payloadToVariants(
  raw: unknown,
): VariantQty {
  if (!Array.isArray(raw)) return {}
  const out: VariantQty = {}
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue
    const item = v as { size?: string | null; color?: string | null; quantity?: number }
    const size = item.size ?? ''
    const color = item.color ?? SIN_COLOR
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
    if (quantity > 0) out[vKey(size, color)] = quantity
  }
  return out
}

export function totalOf(qty: VariantQty, sizes: string[], colors: string[]): number {
  const cols = colors.length > 0 ? colors : [SIN_COLOR]
  let total = 0
  for (const size of sizes) {
    for (const color of cols) total += qty[vKey(size, color)] ?? 0
  }
  return total
}

/** Cuántas unidades hay registradas en una talla (para avisar antes de quitarla). */
export function qtyForSize(qty: VariantQty, size: string, colors: string[]): number {
  const cols = colors.length > 0 ? colors : [SIN_COLOR]
  return cols.reduce((sum, color) => sum + (qty[vKey(size, color)] ?? 0), 0)
}

/** Cuántas unidades hay registradas en un color. */
export function qtyForColor(qty: VariantQty, color: string, sizes: string[]): number {
  return sizes.reduce((sum, size) => sum + (qty[vKey(size, color)] ?? 0), 0)
}

/** Reparte un total entre las variantes; el residuo va a las primeras filas. */
export function distribute(total: number, sizes: string[], colors: string[]): VariantQty {
  const cols = colors.length > 0 ? colors : [SIN_COLOR]
  const cells: string[] = []
  for (const size of sizes) for (const color of cols) cells.push(vKey(size, color))
  if (cells.length === 0 || total <= 0) return {}

  const base = Math.floor(total / cells.length)
  let rest = total % cells.length
  const out: VariantQty = {}
  for (const key of cells) {
    out[key] = base + (rest > 0 ? 1 : 0)
    if (rest > 0) rest--
  }
  return out
}

const CELL_INPUT =
  'w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white'

interface StockVariantsProps {
  sizes: string[]
  colors: string[]
  qty: VariantQty
  onChange: (qty: VariantQty) => void
}

export function StockVariants({ sizes, colors, qty, onChange }: StockVariantsProps) {
  const [fillValue, setFillValue] = useState('')

  if (sizes.length === 0) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-3">
        Selecciona primero las tallas disponibles.
      </p>
    )
  }

  const cols = colors.length > 0 ? colors : [SIN_COLOR]
  const fillNum = Math.max(0, Math.floor(Number(fillValue) || 0))

  function setCell(size: string, color: string, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    onChange({ ...qty, [vKey(size, color)]: n })
  }

  function fillAll() {
    const next: VariantQty = { ...qty }
    for (const size of sizes) for (const color of cols) next[vKey(size, color)] = fillNum
    onChange(next)
  }

  function fillRow(size: string) {
    const next: VariantQty = { ...qty }
    for (const color of cols) next[vKey(size, color)] = fillNum
    onChange(next)
  }

  function fillColumn(color: string) {
    const next: VariantQty = { ...qty }
    for (const size of sizes) next[vKey(size, color)] = fillNum
    onChange(next)
  }

  const total = totalOf(qty, sizes, colors)

  return (
    <div>
      {/* Ayudas de llenado */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          min="0"
          value={fillValue}
          onChange={(e) => setFillValue(e.target.value)}
          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white"
          placeholder="0"
        />
        <button
          type="button"
          onClick={fillAll}
          className="px-3 py-1 text-xs border border-gray-300 rounded hover:border-gray-900"
        >
          Llenar todo
        </button>
        <span className="text-xs text-gray-400">
          Las flechas al final de cada fila y columna llenan solo esa fila o columna.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                Talla
              </th>
              {cols.map((color) => (
                <th key={color || 'unico'}
                  className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">
                  {color === SIN_COLOR ? 'Único' : color}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-xs font-semibold text-gray-500 border-b border-gray-200">
                Total
              </th>
              <th className="border-b border-gray-200" />
            </tr>
          </thead>

          <tbody>
            {sizes.map((size) => (
              <tr key={size}>
                <td className="px-2 py-1.5 font-medium text-gray-700 border-b border-gray-100">{size}</td>
                {cols.map((color) => (
                  <td key={color || 'unico'} className="px-2 py-1.5 text-center border-b border-gray-100">
                    <input
                      type="number"
                      min="0"
                      value={qty[vKey(size, color)] ?? 0}
                      onChange={(e) => setCell(size, color, e.target.value)}
                      className={CELL_INPUT}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center text-gray-500 border-b border-gray-100">
                  {qtyForSize(qty, size, colors)}
                </td>
                <td className="px-1 py-1.5 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => fillRow(size)}
                    title={`Llenar la fila ${size} con ${fillNum}`}
                    className="text-gray-300 hover:text-gray-900 text-xs px-1"
                  >
                    →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className="px-2 py-1.5 text-xs text-gray-500">Total</td>
              {cols.map((color) => (
                <td key={color || 'unico'} className="px-2 py-1.5 text-center text-gray-500">
                  {qtyForColor(qty, color, sizes)}
                </td>
              ))}
              <td />
              <td />
            </tr>
            <tr>
              <td />
              {cols.map((color) => (
                <td key={color || 'unico'} className="px-2 text-center">
                  <button
                    type="button"
                    onClick={() => fillColumn(color)}
                    title={`Llenar la columna ${color === SIN_COLOR ? 'Único' : color} con ${fillNum}`}
                    className="text-gray-300 hover:text-gray-900 text-xs"
                  >
                    ↓
                  </button>
                </td>
              ))}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end mt-3">
        <span className="text-sm font-semibold text-gray-900">
          Total: {total} {total === 1 ? 'unidad' : 'unidades'}
        </span>
      </div>
    </div>
  )
}
