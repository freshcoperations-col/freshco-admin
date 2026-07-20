'use client'

import { useState, useEffect, useRef } from 'react'
import { botFetch } from '@/lib/api'

interface Product {
  id: string
  name: string
  price: number
  sale_price?: number
  on_sale?: boolean
  sizes?: string[]
  colors?: string[]
  stock?: number
}

interface LineItem {
  product_id: string
  product_name: string
  size: string
  color: string
  quantity: number
  unit_price: number
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreateOrderModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [paymentLink, setPaymentLink] = useState('')
  const [shortId, setShortId] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Customer
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // Product search
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(0)
  const [items, setItems] = useState<LineItem[]>([])
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 2) { setProducts([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await botFetch(`/api/admin/web/products?search=${encodeURIComponent(query)}&limit=10`, { method: 'GET' })
      if (res.ok) {
        const body = await res.json()
        setProducts(body.products ?? [])
      }
      setSearching(false)
    }, 350)
  }, [query])

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setPrice(p.on_sale && p.sale_price ? p.sale_price : p.price)
    setSize(p.sizes?.[0] ?? '')
    setColor(p.colors?.[0] ?? '')
    setQuery(p.name)
    setProducts([])
  }

  function addItem() {
    if (!selectedProduct) return
    const item: LineItem = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      size,
      color,
      quantity: qty,
      unit_price: price,
    }
    setItems((prev) => [...prev, item])
    setSelectedProduct(null)
    setQuery('')
    setSize('')
    setColor('')
    setQty(1)
    setPrice(0)
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  async function handleSubmit() {
    if (!name || !phone || items.length === 0) {
      setError('Nombre, celular y al menos un producto son requeridos.')
      return
    }
    setError('')
    setSaving(true)
    const res = await botFetch('/api/admin/web/orders/create-manual', {
      method: 'POST',
      body: JSON.stringify({ customer_name: name, customer_phone: phone, customer_email: email || undefined, shipping_address: address || undefined, notes: notes || undefined, items }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Error al crear el pedido.')
      return
    }
    const body = await res.json()
    setPaymentLink(body.payment_link ?? '')
    setShortId(body.short_id ?? '')
    setStep('done')
    onCreated()
  }

  function copyLink() {
    navigator.clipboard.writeText(paymentLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">
            {step === 'form' ? 'Nuevo pedido manual' : `Pedido #${shortId} creado`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {step === 'done' ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              El pedido fue creado con estado <strong>pendiente</strong>. Envía este link al cliente para que pague — el precio ya viene configurado.
            </p>
            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Link de pago Wompi</p>
              <p className="text-xs text-gray-700 break-all">{paymentLink}</p>
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 transition"
              >
                {copied ? '✓ Copiado' : 'Copiar link'}
              </button>
            </div>
            {paymentLink && (
              <a
                href={`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${name} 👋 Aquí te comparto el link de pago de tu pedido #${shortId} por $${total.toLocaleString('es-CO')} COP:\n\n${paymentLink}\n\nSolo ábrelo y completa el pago con tu método preferido 💳`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
              >
                📱 Enviar por WhatsApp
              </a>
            )}
            <button onClick={onClose} className="block w-full text-center text-sm text-gray-500 hover:text-gray-800 mt-2">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Cliente */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Celular *</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+573001234567" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dirección de envío</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Cra 7 #45-23, Bogotá" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Notas internas</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
              </div>
            </section>

            {/* Agregar producto */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Agregar producto</p>
              <div className="relative mb-3">
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedProduct(null) }}
                  placeholder="Buscar producto por nombre…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                />
                {searching && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
                {products.length > 0 && (
                  <ul className="absolute z-10 bg-white border border-gray-200 rounded shadow-lg w-full mt-1 max-h-48 overflow-y-auto">
                    {products.map((p) => (
                      <li key={p.id} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between" onClick={() => selectProduct(p)}>
                        <span>{p.name}</span>
                        <span className="text-gray-400">${(p.on_sale && p.sale_price ? p.sale_price : p.price).toLocaleString('es-CO')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Talla</label>
                      <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded">
                        {selectedProduct.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Color</label>
                      <select value={color} onChange={(e) => setColor(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded">
                        {selectedProduct.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
                    <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Precio unitario (COP)</label>
                    <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                  </div>
                </div>
              )}

              {selectedProduct && (
                <button onClick={addItem} className="px-4 py-2 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 transition">
                  + Agregar al pedido
                </button>
              )}
            </section>

            {/* Items del pedido */}
            {items.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Productos en el pedido</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-center">Talla</th>
                        <th className="px-3 py-2 text-center">Color</th>
                        <th className="px-3 py-2 text-center">Cant.</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{item.product_name}</td>
                          <td className="px-3 py-2 text-center">{item.size || '—'}</td>
                          <td className="px-3 py-2 text-center">{item.color || '—'}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">${(item.unit_price * item.quantity).toLocaleString('es-CO')}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Total</td>
                        <td className="px-3 py-2 text-right font-bold">${total.toLocaleString('es-CO')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || items.length === 0}
                className="px-5 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition"
              >
                {saving ? 'Creando…' : 'Crear pedido y generar link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
