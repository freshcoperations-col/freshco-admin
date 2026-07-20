'use client'

import { useState, useEffect, useRef } from 'react'
import { botFetch } from '@/lib/api'

interface RelatedOrder {
  id: string
  short_id: string
  customer_name: string | null
  customer_phone: string
  customer_email: string | null
  total: number
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreatePaymentLinkModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [paymentLink, setPaymentLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Payment
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  // Customer
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Related order search
  const [orderQuery, setOrderQuery] = useState('')
  const [orderResults, setOrderResults] = useState<RelatedOrder[]>([])
  const [relatedOrder, setRelatedOrder] = useState<RelatedOrder | null>(null)
  const [searchingOrders, setSearchingOrders] = useState(false)
  const orderSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (relatedOrder) { setOrderResults([]); return }
    if (orderQuery.length < 2) { setOrderResults([]); return }
    if (orderSearchRef.current) clearTimeout(orderSearchRef.current)
    orderSearchRef.current = setTimeout(async () => {
      setSearchingOrders(true)
      const res = await botFetch(`/api/admin/web/orders?search=${encodeURIComponent(orderQuery)}&limit=6`, { method: 'GET' })
      if (res.ok) {
        const body = await res.json()
        setOrderResults(body.orders ?? [])
      }
      setSearchingOrders(false)
    }, 350)
  }, [orderQuery, relatedOrder])

  function selectOrder(o: RelatedOrder) {
    setRelatedOrder(o)
    setOrderQuery('')
    setOrderResults([])
    if (!name) setName(o.customer_name ?? '')
    if (!phone) setPhone(o.customer_phone)
    if (!email && o.customer_email) setEmail(o.customer_email)
  }

  const amountNum = parseInt(amount.replace(/\D/g, '') || '0', 10)

  async function handleSubmit() {
    if (!amountNum || amountNum <= 0) { setError('Ingresa un monto válido.'); return }
    if (!name || !phone) { setError('Nombre y celular son requeridos.'); return }
    setError('')
    setSaving(true)
    const res = await botFetch('/api/admin/web/payment-links', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountNum,
        description: description || undefined,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || undefined,
        related_order_id: relatedOrder?.id,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Error al generar el link.')
      return
    }
    const body = await res.json()
    setPaymentLink(body.payment_link ?? '')
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">
            {step === 'form' ? 'Crear link de pago' : 'Link generado'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {step === 'done' ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Link generado por <strong>${amountNum.toLocaleString('es-CO')} COP</strong>
              {description && <span> — {description}</span>}
              {relatedOrder && <span className="ml-1 text-gray-400">(pedido <span className="font-mono">#{relatedOrder.short_id}</span>)</span>}.
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
            {phone && (
              <a
                href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${name} 👋 Aquí te comparto un link de pago por $${amountNum.toLocaleString('es-CO')} COP${description ? ` (${description})` : ''}:\n\n${paymentLink}\n\nSolo ábrelo y completa el pago con tu método preferido 💳`)}`}
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
            {/* Monto */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Monto del pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Monto (COP) *</label>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="90000"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Concepto</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Envío adicional, ajuste…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                  />
                </div>
              </div>
            </section>

            {/* Relacionar con pedido */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Relacionar con pedido <span className="text-gray-400 normal-case font-normal">(opcional)</span>
              </p>
              <div className="relative">
                {relatedOrder ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                    <span className="text-sm">
                      <span className="font-mono text-xs text-blue-600">#{relatedOrder.short_id}</span>
                      {' — '}{relatedOrder.customer_name ?? relatedOrder.customer_phone}
                      <span className="ml-2 text-gray-400 text-xs">${relatedOrder.total.toLocaleString('es-CO')}</span>
                    </span>
                    <button
                      onClick={() => { setRelatedOrder(null); setOrderQuery('') }}
                      className="text-xs text-gray-400 hover:text-gray-700 ml-3"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Buscar pedido por #ID, nombre o teléfono…"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                      autoComplete="off"
                    />
                    {searchingOrders && <p className="text-xs text-gray-400 mt-1">Buscando…</p>}
                    {orderResults.length > 0 && (
                      <ul className="absolute z-10 bg-white border border-gray-200 rounded shadow-lg w-full mt-1 max-h-44 overflow-y-auto">
                        {orderResults.map((o) => (
                          <li
                            key={o.id}
                            className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                            onClick={() => selectOrder(o)}
                          >
                            <span>
                              <span className="font-mono text-xs text-gray-400">#{o.short_id}</span>
                              {' '}{o.customer_name ?? o.customer_phone}
                            </span>
                            <span className="text-gray-400 text-xs ml-2">${o.total.toLocaleString('es-CO')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </section>

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
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full px-3 py-2 text-sm border border-gray-300 rounded" />
                </div>
              </div>
            </section>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition"
              >
                {saving ? 'Generando…' : 'Generar link de pago'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
