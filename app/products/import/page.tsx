'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { botFetch } from '@/lib/api'
import { parseCsv } from '@/lib/csv'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Change { field: string; label: string; from: unknown; to: unknown }
interface RowResult {
  line: number
  id: string
  name: string | null
  status: 'changes' | 'unchanged' | 'error' | 'applied'
  changes: Change[]
  errors: string[]
}
interface Summary { rows: number; with_changes: number; unchanged: number; errors: number; fields_changed: number }
interface ImportResponse {
  dry_run: boolean
  import_id?: string
  warnings: string[]
  summary: Summary
  results: RowResult[]
}
interface ImportRecord {
  id: string
  created_at: string
  actor_email: string | null
  file_name: string | null
  products_changed: number
  fields_changed: number
  reverted_at: string | null
  reverted_by: string | null
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(vacío)'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  if (typeof value === 'number') return `$${value.toLocaleString('es-CO')}`
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(ninguno)'
  return String(value)
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ImportProductsPage() {
  const { can } = usePermissions()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [preview, setPreview] = useState<ImportResponse | null>(null)
  const [applied, setApplied] = useState<ImportResponse | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const loadHistory = useCallback(async () => {
    const res = await botFetch('/api/admin/web/products/import', { method: 'GET' })
    if (res.ok) setHistory((await res.json()).imports ?? [])
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function download() {
    setBusy('Preparando el archivo…')
    setError(null)
    try {
      const res = await botFetch('/api/admin/web/products/export', { method: 'GET' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `catalogo-freshco-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(`No se pudo descargar el catálogo: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function send(dataRows: Record<string, string>[], dryRun: boolean, name: string | null) {
    const res = await botFetch('/api/admin/web/products/import', {
      method: 'POST',
      body: JSON.stringify({ rows: dataRows, dry_run: dryRun, file_name: name }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
    return body as ImportResponse
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setError(null)
    setPreview(null)
    setApplied(null)
    setFileName(file.name)
    setBusy('Revisando el archivo…')
    try {
      const parsed = parseCsv(await file.arrayBuffer())
      if (parsed.rows.length === 0) throw new Error('El archivo no tiene filas con datos.')
      setRows(parsed.rows)
      setPreview(await send(parsed.rows, true, file.name))
    } catch (err) {
      setRows(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!rows || !preview) return
    const n = preview.summary.with_changes
    if (!confirm(`Se van a actualizar ${n} producto${n === 1 ? '' : 's'}. Puedes deshacerlo después desde el historial. ¿Continuar?`)) return
    setBusy('Aplicando cambios…')
    setError(null)
    try {
      const result = await send(rows, false, fileName)
      setApplied(result)
      setPreview(null)
      setRows(null)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function revert(imp: ImportRecord) {
    if (!confirm(`¿Deshacer la importación del ${fecha(imp.created_at)}? Los ${imp.fields_changed} campos vuelven a su valor anterior.`)) return
    setBusy('Deshaciendo…')
    try {
      const res = await botFetch(`/api/admin/web/products/import/${imp.id}/revert`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      const conflictos = (body.conflicts ?? []) as Array<{ name: string | null; field: string }>
      if (conflictos.length) {
        setError(
          `Se restauraron ${body.restored} campos. ${conflictos.length} no se tocaron porque alguien los cambió después de la importación: ` +
          conflictos.map((c) => `${c.name ?? ''} (${c.field})`).join(', '),
        )
      } else {
        showToast(`Importación deshecha: ${body.restored} campos restaurados ✅`)
      }
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (!can('products_edit')) {
    return <div className="p-6 text-sm text-gray-500">Tu rol no puede editar productos.</div>
  }

  const current = applied ?? preview
  const withChanges = current?.results.filter((r) => r.status === 'changes' || r.status === 'applied') ?? []
  const withErrors = current?.results.filter((r) => r.status === 'error') ?? []

  return (
    <div className="p-6 max-w-5xl">
      <Link href="/products" className="text-xs text-gray-500 hover:text-gray-900">← Productos</Link>
      <h1 className="text-xl font-semibold mt-2 mb-1">Editar productos con CSV</h1>
      <p className="text-sm text-gray-500 mb-6">
        Descarga el catálogo, edítalo en Excel o Google Sheets y vuelve a subirlo. Antes de aplicar ves exactamente qué cambia.
      </p>

      {/* Paso 1 */}
      <section className="border border-gray-200 rounded-lg p-5 mb-4 bg-white">
        <h2 className="text-sm font-semibold mb-3">1. Descarga el catálogo</h2>
        <button type="button" onClick={download} disabled={!!busy}
          className="px-4 py-2 text-xs uppercase tracking-wide border border-gray-300 rounded hover:border-gray-900 disabled:opacity-50">
          Descargar catálogo (.csv)
        </button>
        <ul className="mt-4 text-xs text-gray-600 space-y-1.5 list-disc pl-4">
          <li><strong>Celda vacía = no se toca.</strong> Puedes dejar solo las columnas que vas a cambiar, o borrar el contenido de las demás.</li>
          <li><strong>No cambies la columna <code className="bg-gray-100 px-1 rounded">id</code>:</strong> es como se identifica cada producto.</li>
          <li><code className="bg-gray-100 px-1 rounded">tipo_prenda</code> y <code className="bg-gray-100 px-1 rounded">stock</code> van solo como referencia; se ignoran al subir. El stock se maneja desde el producto.</li>
          <li>Sí/no se escribe <em>sí</em> o <em>no</em>. Las listas (tallas, colores, colecciones) van separadas por coma.</li>
          <li>Para <em>borrar</em> un valor (dejar un campo vacío), hazlo desde el producto en el admin.</li>
        </ul>
      </section>

      {/* Paso 2 */}
      <section className="border border-gray-200 rounded-lg p-5 mb-4 bg-white">
        <h2 className="text-sm font-semibold mb-3">2. Sube el archivo editado</h2>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50">
          Elegir archivo CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        {fileName && <span className="ml-3 text-xs text-gray-500">{fileName}</span>}
        {busy && <p className="mt-3 text-sm text-gray-600">{busy}</p>}
      </section>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 whitespace-pre-wrap">{error}</p>
      )}

      {/* Vista previa / resultado */}
      {current && (
        <section className="border border-gray-200 rounded-lg p-5 mb-4 bg-white">
          <h2 className="text-sm font-semibold mb-3">
            {applied ? '✅ Cambios aplicados' : '3. Revisa antes de aplicar'}
          </h2>

          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200">
              {current.summary.with_changes} con cambios
            </span>
            <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
              {current.summary.unchanged} sin cambios
            </span>
            {current.summary.errors > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                {current.summary.errors} con errores (no se aplican)
              </span>
            )}
          </div>

          {current.warnings.length > 0 && (
            <ul className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-1">
              {current.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
            </ul>
          )}

          {withErrors.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-red-700 mb-2">Filas con error — corrígelas en el archivo y vuelve a subirlo</h3>
              <table className="w-full text-xs border border-red-100">
                <tbody>
                  {withErrors.map((r) => (
                    <tr key={`${r.line}-${r.id}`} className="border-b border-red-50 align-top">
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">Fila {r.line}</td>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.name || r.id || '(sin id)'}</td>
                      <td className="px-2 py-1.5 text-red-700">{r.errors.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {withChanges.length > 0 && (
            <div className="space-y-3">
              {withChanges.map((r) => (
                <div key={r.id} className="border border-gray-200 rounded">
                  <div className="px-3 py-2 bg-gray-50 text-xs">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-gray-400 ml-2">{r.id}</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {r.changes.map((c) => (
                        <tr key={c.field} className="border-t border-gray-100 align-top">
                          <td className="px-3 py-2 w-40 text-gray-600">{c.label}</td>
                          <td className="px-3 py-2 text-gray-400 line-through whitespace-pre-wrap max-w-xs">{show(c.from)}</td>
                          <td className="px-3 py-2 text-green-800 whitespace-pre-wrap">{show(c.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {!applied && (
            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={apply} disabled={!!busy || current.summary.with_changes === 0}
                className="px-5 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-40">
                Aplicar cambios a {current.summary.with_changes} producto{current.summary.with_changes === 1 ? '' : 's'}
              </button>
              {current.summary.with_changes === 0 && (
                <span className="text-xs text-gray-500">No hay nada que cambiar.</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Historial */}
      <section className="border border-gray-200 rounded-lg p-5 bg-white">
        <h2 className="text-sm font-semibold mb-3">Historial de importaciones</h2>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no hay importaciones.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3 whitespace-nowrap">{fecha(h.created_at)}</td>
                  <td className="py-2 pr-3 text-gray-500 truncate max-w-[12rem]">{h.actor_email}</td>
                  <td className="py-2 pr-3 text-gray-500 truncate max-w-[14rem]">{h.file_name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{h.products_changed} productos · {h.fields_changed} campos</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {h.reverted_at ? (
                      <span className="text-gray-400">Deshecha {fecha(h.reverted_at)}</span>
                    ) : (
                      <button type="button" onClick={() => revert(h)} disabled={!!busy}
                        className="text-red-600 hover:underline disabled:opacity-40">
                        Deshacer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">{toast}</div>
      )}
    </div>
  )
}
