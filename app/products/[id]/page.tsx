'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { botFetch } from '@/lib/api'
import { ProductForm } from '@/components/ProductForm'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [product, setProduct] = useState<Record<string, unknown> | null>(null)
  const [meta, setMeta] = useState<{ garment_types: { id: string; label: string }[]; collections: { id: string; label: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [productRes, metaRes] = await Promise.all([
      botFetch('/api/admin/web/products', { method: 'GET' }),
      botFetch('/api/admin/web/meta', { method: 'GET' }),
    ])
    const [pBody, mBody] = await Promise.all([productRes.json(), metaRes.json()])
    const found = (pBody.products ?? []).find((p: { id: string }) => p.id === id)
    setProduct(found ?? null)
    setMeta(mBody)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>
  if (!product) return <div className="p-6 text-sm text-red-600">Producto no encontrado.</div>

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => router.back()} className="text-xs text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-1">
        ← Volver
      </button>
      <h1 className="text-xl font-semibold mb-6">Editar producto</h1>
      {meta && (
        <ProductForm
          initial={product}
          garmentTypes={meta.garment_types}
          collections={meta.collections}
          onSaved={() => router.push('/products')}
          onDeleted={() => router.push('/products')}
        />
      )}
    </div>
  )
}
