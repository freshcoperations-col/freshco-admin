'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { botFetch } from '@/lib/api'
import { imageFromDrop, uploadImage } from '@/lib/image-upload'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Banner {
  id: string
  title: string
  desktop_path: string | null
  mobile_path: string | null
  desktop_url: string | null
  mobile_url: string | null
  link_url: string | null
  sort_order: number
  active: boolean
}
interface Collection { id: string; label: string }

// Proporción real del carrusel de la tienda (BannerCarousel): 100% de ancho y
// min(40vh, 450px) de alto. En un computador eso da ~4:1; en un celular, un
// poco más ancho que alto. Los tamaños recomendados salen de ahí.
const SLOTS = {
  desktop: { label: 'Computador', ratio: 4, hint: '1920 × 480 px' },
  mobile: { label: 'Celular', ratio: 1.35, hint: '1080 × 800 px' },
} as const
type Device = keyof typeof SLOTS

export default function BannersPage() {
  const { can } = usePermissions()
  const [banners, setBanners] = useState<Banner[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [b, c] = await Promise.all([
      botFetch('/api/admin/web/banners', { method: 'GET' }),
      botFetch('/api/admin/web/meta', { method: 'GET' }),
    ])
    if (b.ok) setBanners((await b.json()).banners ?? [])
    if (c.ok) setCollections((await c.json()).collections ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function replace(next: Banner) {
    setBanners((prev) => prev.map((x) => (x.id === next.id ? next : x)))
  }

  async function create() {
    const res = await botFetch('/api/admin/web/banners', { method: 'POST', body: JSON.stringify({}) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(body.error ?? 'No se pudo crear'); return }
    setBanners((prev) => [...prev, body.banner])
    showToast('Banner creado — sube la imagen de computador para poder activarlo')
  }

  async function remove(b: Banner) {
    if (!confirm(`¿Eliminar "${b.title || 'este banner'}"? Se borran también sus imágenes.`)) return
    const res = await botFetch(`/api/admin/web/banners/${b.id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('No se pudo eliminar'); return }
    setBanners((prev) => prev.filter((x) => x.id !== b.id))
    showToast('Banner eliminado')
  }

  // Arrastrar para ordenar: se reordena en pantalla al soltar y se guarda.
  async function drop(to: number) {
    if (dragIndex === null || dragIndex === to) { setDragIndex(null); return }
    const next = [...banners]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(to, 0, moved)
    setDragIndex(null)
    const before = banners
    setBanners(next)
    const res = await botFetch('/api/admin/web/banners/order', {
      method: 'PUT',
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    })
    if (!res.ok) { setBanners(before); showToast('No se pudo guardar el orden') }
    else showToast('Orden guardado ✅')
  }

  if (!can('banners_edit')) {
    return <div className="p-6 text-sm text-gray-500">Tu rol no puede gestionar banners.</div>
  }

  return (
    <div
      className="p-6 max-w-5xl"
      // Soltar una imagen fuera de un recuadro haría que el navegador abra el
      // archivo y saque a la persona del admin. Se ignora.
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
    >
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Banners</h1>
          <p className="text-sm text-gray-500">
            El carrusel del inicio de la tienda. Cada banner tiene una imagen para computador y otra para celular.
            Arrastra las tarjetas para cambiar el orden.
          </p>
        </div>
        <button type="button" onClick={create}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded whitespace-nowrap">
          + Nuevo banner
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : banners.length === 0 ? (
        <p className="text-sm text-gray-400">No hay banners. Crea el primero.</p>
      ) : (
        <div className="space-y-4">
          {banners.map((b, i) => (
            <div
              key={b.id}
              onDragOver={(e) => { if (dragIndex !== null) e.preventDefault() }}
              onDrop={(e) => { if (dragIndex !== null) { e.preventDefault(); drop(i) } }}
              className={`border rounded-lg bg-white transition-shadow ${dragIndex === i ? 'opacity-40' : ''} ${
                dragIndex !== null && dragIndex !== i ? 'border-dashed border-gray-400' : 'border-gray-200'}`}
            >
              <BannerCard
                banner={b}
                position={i + 1}
                collections={collections}
                onChange={replace}
                onDelete={() => remove(b)}
                onToast={showToast}
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
              />
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg z-50">{toast}</div>
      )}
    </div>
  )
}

// ─── Una tarjeta de banner ───────────────────────────────────────────────────

function BannerCard({
  banner, position, collections, onChange, onDelete, onToast, onDragStart, onDragEnd,
}: {
  banner: Banner
  position: number
  collections: Collection[]
  onChange: (b: Banner) => void
  onDelete: () => void
  onToast: (m: string) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const [title, setTitle] = useState(banner.title)
  const [link, setLink] = useState(banner.link_url ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save(patch: Partial<Pick<Banner, 'title' | 'link_url' | 'active'>>) {
    setError(null)
    const res = await botFetch(`/api/admin/web/banners/${banner.id}`, { method: 'PUT', body: JSON.stringify(patch) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'No se pudo guardar'); return false }
    onChange(body.banner)
    return true
  }

  async function saveLink(value: string) {
    setLink(value)
    if ((banner.link_url ?? '') === value.trim()) return
    if (await save({ link_url: value })) onToast(value.trim() ? 'Link guardado ✅' : 'Banner sin link ✅')
  }

  const quickLinks = [
    { label: 'Sin link', value: '' },
    { label: 'Catálogo', value: '/catalog' },
    { label: 'Ofertas', value: '/search?sale=1' },
    ...collections.map((c) => ({ label: c.label, value: `/collection/${c.id}` })),
  ]

  return (
    <div className="p-4">
      {/* Encabezado: arrastrar, nombre, activo, eliminar */}
      <div className="flex items-center gap-3 mb-4">
        <span
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
          onDragEnd={onDragEnd}
          title="Arrastra para cambiar el orden"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-900 select-none px-1 text-lg leading-none"
        >
          ⋮⋮
        </span>
        <span className="text-xs text-gray-400 w-5">{position}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== banner.title) save({ title }) }}
          placeholder="Nombre del banner (ej. Lanzamiento Redmoon)"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-900"
        />
        <label className={`flex items-center gap-2 text-xs ${banner.desktop_path ? 'cursor-pointer' : 'opacity-50'}`}
          title={banner.desktop_path ? '' : 'Sube primero la imagen de computador'}>
          <input type="checkbox" checked={banner.active} disabled={!banner.desktop_path}
            onChange={async (e) => {
              if (await save({ active: e.target.checked })) onToast(e.target.checked ? 'Banner publicado ✅' : 'Banner oculto')
            }} />
          {banner.active ? <span className="text-green-700 font-medium">Publicado</span> : <span className="text-gray-500">Oculto</span>}
        </label>
        <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline">Eliminar</button>
      </div>

      {/* Imágenes */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-4 items-start">
        <ImageSlot banner={banner} device="desktop" onChange={onChange} onToast={onToast} />
        <ImageSlot banner={banner} device="mobile" onChange={onChange} onToast={onToast} />
      </div>

      {/* Link */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-gray-700 mb-1">Link al tocar el banner <span className="font-normal text-gray-400">(opcional)</span></label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => saveLink(link)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="Vacío = no es clickeable · /collection/redmoon · https://instagram.com/…"
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-900"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {quickLinks.map((q) => {
            const active = (banner.link_url ?? '') === q.value
            return (
              <button key={q.label} type="button" onClick={() => saveLink(q.value)}
                className={`px-2.5 py-1 text-[11px] rounded-full border ${active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}>
                {q.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Un link que empieza por <code>/</code> abre una página de la tienda. Uno con <code>https://</code> se abre en otra pestaña.
        </p>
      </div>

      {error && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
    </div>
  )
}

// ─── Una imagen (computador o celular) ───────────────────────────────────────

function ImageSlot({
  banner, device, onChange, onToast,
}: {
  banner: Banner
  device: Device
  onChange: (b: Banner) => void
  onToast: (m: string) => void
}) {
  const slot = SLOTS[device]
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const own = device === 'desktop' ? banner.desktop_url : banner.mobile_url
  // Sin versión de celular, la tienda muestra la de computador recortada:
  // se previsualiza así para que se vea el problema.
  const fallback = device === 'mobile' && !own ? banner.desktop_url : null
  const shown = own ?? fallback

  async function upload(file: File) {
    setError(null)
    setBusy(true)
    const res = await uploadImage<{ banner: Banner }>(`/api/admin/web/banners/${banner.id}/image`, file, { device })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    onChange(res.body.banner)
    onToast(`Imagen de ${slot.label.toLowerCase()} actualizada ✅`)
  }

  async function removeMobile() {
    if (!confirm('¿Quitar la imagen de celular? En celular se mostrará la de computador.')) return
    const res = await botFetch(`/api/admin/web/banners/${banner.id}/image?device=mobile`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'No se pudo quitar'); return }
    onChange(body.banner)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700">{slot.label}</span>
        <span className="text-[10px] text-gray-400">{slot.hint}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault(); e.stopPropagation(); setOver(false)
          const f = imageFromDrop(e); if (f) upload(f); else setError('Eso no es una imagen')
        }}
        disabled={busy}
        title={shown ? 'Clic o arrastra una imagen para reemplazar' : 'Clic o arrastra una imagen'}
        className={`relative w-full overflow-hidden rounded border-2 ${over ? 'border-gray-900' : shown ? 'border-transparent' : 'border-dashed border-gray-300 hover:border-gray-500'} bg-gray-900`}
        style={{ aspectRatio: String(slot.ratio) }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className={`absolute inset-0 w-full h-full object-cover ${fallback ? 'opacity-60' : ''}`} />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center text-center bg-white px-2">
            <span className="text-xs text-gray-600 font-medium">Arrastra o haz clic</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-gray-700">Optimizando y subiendo…</span>
        )}
      </button>

      {fallback && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 leading-snug">
          Sin versión de celular: se muestra la de computador recortada así. Sube una para que se vea bien.
        </p>
      )}
      {device === 'mobile' && own && (
        <button type="button" onClick={removeMobile} className="text-[11px] text-gray-500 hover:text-red-600 mt-1">
          Quitar versión de celular
        </button>
      )}
      {error && <p className="text-[11px] text-red-700 mt-1">{error}</p>}
    </div>
  )
}
