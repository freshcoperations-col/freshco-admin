'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { botFetch } from '@/lib/api'
import { ProductForm } from '@/components/ProductForm'

interface Meta {
  garment_types: { id: string; label: string }[]
  collections: { id: string; label: string }[]
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Cargando…</div>}>
      <NewProductContent />
    </Suspense>
  )
}

// Campos que NO se copian al duplicar: identidad del producto y las imágenes
// (esas se clonan en Storage después de crear, con el slug nuevo).
const NOT_COPIED = ['id', 'images', 'created_at', 'out_of_stock']

function NewProductContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  const [meta, setMeta] = useState<Meta | null>(null)
  const [source, setSource] = useState<Record<string, unknown> | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [loadingSource, setLoadingSource] = useState(!!from)

  useEffect(() => {
    botFetch('/api/admin/web/meta', { method: 'GET' })
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [])

  // Duplicar: traemos el producto original y lo usamos como valores iniciales.
  useEffect(() => {
    if (!from) return
    setLoadingSource(true)
    botFetch('/api/admin/web/products', { method: 'GET' })
      .then((r) => r.json())
      .then((body) => {
        const found = (body.products ?? []).find((p: { id: string }) => p.id === from)
        if (!found) {
          setSourceError(`No encontré el producto "${from}" para duplicar.`)
          return
        }
        const copy: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(found)) {
          if (!NOT_COPIED.includes(k)) copy[k] = v
        }
        copy.name = `${found.name} (copia)`
        setSource(copy)
      })
      .catch(() => setSourceError('No se pudo cargar el producto original.'))
      .finally(() => setLoadingSource(false))
  }, [from])

  const ready = meta && (!from || source || sourceError)

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => router.back()} className="text-xs text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-1">
        ← Volver
      </button>
      <h1 className="text-xl font-semibold mb-1">
        {from ? 'Duplicar producto' : 'Nuevo producto'}
      </h1>
      {from && !sourceError && (
        <p className="text-sm text-gray-500 mb-6">
          Copiado de <strong>{from}</strong>. Cambia el nombre — el slug se regenera solo.
          Las imágenes se copian al crear el producto.
        </p>
      )}
      {!from && <div className="mb-6" />}

      {sourceError && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {sourceError}
        </p>
      )}

      {ready && !loadingSource ? (
        <ProductForm
          key={from ?? 'new'}
          initial={source ?? undefined}
          duplicateFrom={source ? (from as string) : undefined}
          garmentTypes={meta!.garment_types}
          collections={meta!.collections}
          onSaved={(id) => router.push(`/products/${id}`)}
        />
      ) : (
        <div className="text-sm text-gray-500">Cargando…</div>
      )}
    </div>
  )
}
