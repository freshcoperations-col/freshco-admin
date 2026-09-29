'use client'

import { useRef, useState } from 'react'
import { botFetch } from '@/lib/api'
import { imageFromDrop, uploadImage } from '@/lib/image-upload'

export interface CollectionImageData {
  id: string
  label: string
  description: string | null
  image_url: string | null
  image_focus: string | null
  show_title: boolean | null
}

// Tamaños reales de la tarjeta en la tienda (CatalogPage + index.css):
// en computador es vertical; en celular (≤480px) baja a 360px de alto y queda
// casi cuadrada. La MISMA foto se recorta distinto en cada una, por eso se
// muestran las dos a la vez.
const PREVIEWS = [
  { key: 'desktop', label: 'Computador', w: 370, h: 450 },
  { key: 'mobile', label: 'Celular', w: 358, h: 360 },
] as const
const SCALE = 0.5
const MIN_WIDTH = 800 // por debajo de esto se ve pixelada en pantallas de alta densidad

function parseFocus(focus: string | null): { x: number; y: number } {
  const m = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(focus ?? '')
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 }
}

export function CollectionImageEditor({
  collection,
  onChange,
  onToast,
}: {
  collection: CollectionImageData
  onChange: (c: CollectionImageData) => void
  onToast: (msg: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)

  const focus = parseFocus(collection.image_focus)
  const focusCss = `${Math.round(focus.x)}% ${Math.round(focus.y)}%`
  const showTitle = collection.show_title !== false

  async function upload(file: File) {
    setError(null)
    setBusy('Optimizando y subiendo…')
    const res = await uploadImage<{ collection: CollectionImageData }>(
      `/api/admin/web/collections/${collection.id}/image`,
      file,
    )
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    setNaturalWidth(null)
    onChange({ ...collection, ...res.body.collection })
    onToast('Imagen actualizada ✅')
  }

  async function save(patch: Partial<CollectionImageData>) {
    const before = collection
    onChange({ ...collection, ...patch }) // se ve al instante
    const res = await botFetch(`/api/admin/web/collections/${collection.id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      onChange(before)
      const b = await res.json().catch(() => ({}))
      setError(b.error ?? 'No se pudo guardar')
    }
  }

  async function removeImage() {
    if (!confirm('¿Quitar la imagen? La tarjeta vuelve al diseño de solo texto.')) return
    setBusy('Quitando…')
    const res = await botFetch(`/api/admin/web/collections/${collection.id}/image`, { method: 'DELETE' })
    setBusy(null)
    if (!res.ok) { setError('No se pudo quitar la imagen'); return }
    onChange({ ...collection, image_url: null, image_focus: '50% 50%' })
    onToast('Imagen quitada')
  }

  // Clic sobre la foto COMPLETA (sin recortar) = ese punto nunca se recorta.
  function pickFocus(e: React.MouseEvent<HTMLImageElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
    save({ image_focus: `${Math.round(x)}% ${Math.round(y)}%` })
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = imageFromDrop(e)
      if (file) upload(file)
      else setError('Eso no es una imagen')
    },
  }

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200" {...dropProps}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />

      <div className="flex flex-wrap gap-6 items-start">
        {/* Foto completa + punto de enfoque */}
        <div className="w-64">
          <p className="text-xs font-semibold text-gray-700 mb-2">Foto</p>
          {collection.image_url ? (
            <>
              <div className="relative bg-white border border-gray-200 rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={collection.image_url}
                  alt={collection.label}
                  onClick={pickFocus}
                  onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
                  className="w-full h-auto block cursor-crosshair"
                />
                <span
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white ring-2 ring-gray-900 bg-gray-900/40 pointer-events-none"
                  style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                <strong>Haz clic en lo más importante</strong> (una cara, el estampado). Ese punto nunca se recorta, ni en computador ni en celular.
              </p>
              {naturalWidth != null && naturalWidth < MIN_WIDTH && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                  Esta foto mide {naturalWidth} px de ancho y puede verse pixelada. Recomendado: mínimo 1200 px.
                </p>
              )}
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
              className={`w-full aspect-[4/5] border-2 border-dashed rounded flex flex-col items-center justify-center text-center px-4 transition-colors ${
                dragOver ? 'border-gray-900 bg-white' : 'border-gray-300 hover:border-gray-500'}`}>
              <span className="text-sm font-medium text-gray-700">Arrastra una foto aquí</span>
              <span className="text-xs text-gray-400 mt-1">o haz clic para elegirla</span>
              <span className="text-[11px] text-gray-400 mt-3">Vertical, mínimo 1200 px de ancho</span>
            </button>
          )}
        </div>

        {/* Vistas previas con el recorte real de la tienda */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Así se verá en la tienda</p>
          <div className="flex gap-4 items-end">
            {PREVIEWS.map((p) => (
              <div key={p.key}>
                <div
                  className="relative overflow-hidden border border-gray-300 bg-gray-900"
                  style={{ width: p.w * SCALE, height: p.h * SCALE }}
                >
                  {collection.image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={collection.image_url} alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: focusCss }} />
                      {showTitle && (
                        <div className="absolute inset-0 flex flex-col justify-end p-3 text-white"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.55) 38%, rgba(0,0,0,0) 70%)' }}>
                          <span className="text-[7px] tracking-[3px] uppercase opacity-75 mb-1">Colección</span>
                          <span className="font-black uppercase leading-none tracking-tight text-[15px] break-words">{collection.label}</span>
                          <span className="text-[7px] tracking-[2px] uppercase mt-2 border-b border-white/60 self-start pb-0.5">Ver productos →</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center text-center px-3">
                      <span className="text-[7px] tracking-[3px] uppercase text-gray-400 mb-1">Colección</span>
                      <span className="font-black uppercase leading-none tracking-tight text-[15px] text-gray-900 break-words">{collection.label}</span>
                      <span className="text-[9px] text-gray-400 mt-2">(sin foto)</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1 text-center">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">El recorte es exacto; la tipografía es aproximada.</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        {collection.image_url && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:border-gray-900 disabled:opacity-50">
              Reemplazar foto
            </button>
            <button type="button" onClick={removeImage} disabled={!!busy}
              className="px-3 py-1.5 text-xs text-red-600 hover:underline disabled:opacity-50">
              Quitar foto
            </button>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer ml-2">
              <input type="checkbox" checked={showTitle}
                onChange={(e) => save({ show_title: e.target.checked })} />
              Mostrar el nombre sobre la foto
              <span className="text-gray-400">(apágalo si el arte ya trae el nombre)</span>
            </label>
          </>
        )}
        {busy && <span className="text-xs text-gray-500">{busy}</span>}
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
    </div>
  )
}
