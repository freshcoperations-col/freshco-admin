'use client'

import { useEffect, useRef, useState } from 'react'
import type { PresetValue } from '@/lib/presets'

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900 bg-white'

export interface ExtraOption {
  /** Lo que se muestra en la lista, ej. "−30%  ·  63.000". */
  label: string
  /** Lo que se escribe en el campo. */
  value: string
  disabled?: boolean
}

interface PresetSelectProps {
  values: PresetValue[]
  current: string
  onChange: (value: string) => void
  /** Formatea el texto de la opción sin cambiar lo que se guarda. */
  format?: (value: string | number) => string
  placeholder?: string
  disabled?: boolean
  numeric?: boolean
  /** Grupo extra al final de la lista (ej. descuentos calculados). */
  extraGroup?: { label: string; options: ExtraOption[] }
}

// Campo con lista plegable: el input sigue siendo libre (se puede escribir
// cualquier cosa) y la flecha despliega los valores definidos en Presets →
// Valores para elegir uno con un click.
export function PresetSelect({
  values,
  current,
  onChange,
  format,
  placeholder,
  disabled = false,
  numeric = false,
  extraGroup,
}: PresetSelectProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const hasOptions = values.length > 0 || (extraGroup?.options.length ?? 0) > 0

  function pick(value: string) {
    onChange(value)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex">
        <input
          type={numeric ? 'number' : 'text'}
          value={current}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} rounded-r-none`}
          placeholder={placeholder}
        />
        <button
          type="button"
          disabled={disabled || !hasOptions}
          onClick={() => setOpen((v) => !v)}
          title={hasOptions ? 'Elegir de la lista' : 'No hay valores definidos en la pestaña Valores'}
          aria-label="Elegir de la lista"
          aria-expanded={open}
          className="px-2.5 border border-l-0 border-gray-300 rounded-r bg-white text-gray-500 hover:text-gray-900 hover:border-gray-400 disabled:opacity-40 disabled:hover:text-gray-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
          {values.map((v) => {
            const value = String(v.valor)
            const active = value === current.trim()
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => pick(value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                  active ? 'bg-gray-50 font-medium' : ''
                }`}
              >
                <span>
                  {format ? format(v.valor) : value}
                  {v.esDefault && <span className="ml-2 text-[10px] text-gray-400 uppercase">por defecto</span>}
                </span>
                {active && <span className="text-gray-900">✓</span>}
              </button>
            )
          })}

          {extraGroup && extraGroup.options.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 bg-gray-50 border-y border-gray-100">
                {extraGroup.label}
              </div>
              {extraGroup.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => pick(o.value)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                >
                  {o.label}
                </button>
              ))}
            </>
          )}

          {current.trim() !== '' && (
            <button
              type="button"
              onClick={() => pick('')}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
