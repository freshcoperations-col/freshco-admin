'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { botFetch } from '@/lib/api'
import { ProductForm } from '@/components/ProductForm'

export default function NewProductPage() {
  const router = useRouter()
  const [meta, setMeta] = useState<{ garment_types: { id: string; label: string }[]; collections: { id: string; label: string }[] } | null>(null)

  useEffect(() => {
    botFetch('/api/admin/web/meta', { method: 'GET' })
      .then((r) => r.json())
      .then(setMeta)
  }, [])

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => router.back()} className="text-xs text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-1">
        ← Volver
      </button>
      <h1 className="text-xl font-semibold mb-6">Nuevo producto</h1>
      {meta ? (
        <ProductForm
          garmentTypes={meta.garment_types}
          collections={meta.collections}
          onSaved={(id) => router.push(`/products/${id}`)}
        />
      ) : (
        <div className="text-sm text-gray-500">Cargando…</div>
      )}
    </div>
  )
}
