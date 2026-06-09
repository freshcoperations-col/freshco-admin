'use client'

import { useEffect, useState } from 'react'
import { botFetch } from '@/lib/api'

interface OrderItem {
  product_id?: string
  product_name?: string
  size?: string
  color?: string
  quantity?: number
  unit_price?: number
}

interface Order {
  id: string
  short_id: string
  customer_phone: string
  customer_name: string | null
  customer_email: string | null
  items: OrderItem[] | null
  total: number
  payment_status: string
  status: string
  paid_at: string | null
  tracking_number: string | null
  shipping_carrier: string | null
  shipped_at: string | null
  created_at: string
  shipping_address: string | null
  source: string
  payment_link_url: string | null
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  intent: string | null
  created_at: string
}

const CARRIERS = [
  'Servientrega',
  'Coordinadora',
  'Inter Rapidísimo',
  'Envia',
  '99 Minutos',
  'Otra',
]

export function OrderDrawer({
  shortId,
  onClose,
  onChanged,
}: {
  shortId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [data, setData] = useState<{ order: Order; recent_messages: Message[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'idle' | 'ship' | 'update_shipping' | 'deliver' | 'undeliver' | 'cancel' | 'resend' | 'delete_order'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!shortId) return
    setData(null)
    setAction('idle')
    setLoading(true)
    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError('No se pudo cargar el pedido.'))
      .finally(() => setLoading(false))
  }, [shortId])

  if (!shortId) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold">Pedido #{shortId.toUpperCase()}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {loading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}

        {data && (
          <div className="p-6 space-y-6">
            <Section title="Cliente">
              <KV k="Nombre" v={data.order.customer_name ?? '—'} />
              <KV k="Email" v={data.order.customer_email ?? '—'} />
              <KV k="WhatsApp" v={`+${data.order.customer_phone}`} />
            </Section>

            <Section title="Envío">
              <p className="text-sm whitespace-pre-line">
                {data.order.shipping_address ?? '—'}
              </p>
              {data.order.tracking_number && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-sm">
                  <div className="font-medium text-blue-900">{data.order.shipping_carrier}</div>
                  <div className="font-mono text-blue-700">{data.order.tracking_number}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    Enviado {data.order.shipped_at ? new Date(data.order.shipped_at).toLocaleString('es-CO') : ''}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Items">
              <ul className="text-sm divide-y divide-gray-100">
                {(data.order.items ?? []).map((it, idx) => (
                  <li key={idx} className="py-2 flex justify-between">
                    <div>
                      <div className="font-medium">{it.product_name ?? it.product_id}</div>
                      <div className="text-xs text-gray-500">
                        {it.size ? `Talla ${it.size}` : ''}
                        {it.color ? ` · ${it.color}` : ''}
                        {it.quantity ? ` · x${it.quantity}` : ''}
                      </div>
                    </div>
                    <div className="font-medium">
                      ${Number((it.unit_price ?? 0) * (it.quantity ?? 1)).toLocaleString('es-CO')}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                {(() => {
                  const subtotal = (data.order.items ?? []).reduce(
                    (s, it) => s + (it.unit_price ?? 0) * (it.quantity ?? 1), 0)
                  const shipping = Number(data.order.total) - subtotal
                  return (
                    <>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span><span>${subtotal.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Envío</span>
                        <span className={shipping === 0 ? 'text-green-600' : ''}>
                          {shipping === 0 ? '¡Gratis!' : `$${shipping.toLocaleString('es-CO')}`}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1">
                        <span>Total</span>
                        <span>${Number(data.order.total).toLocaleString('es-CO')}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </Section>

            <Section title="Estado">
              <KV k="Pago" v={data.order.payment_status} />
              <KV k="Envío" v={data.order.status} />
              <KV k="Origen" v={data.order.source} />
              <KV k="Creado" v={new Date(data.order.created_at).toLocaleString('es-CO')} />
              {data.order.paid_at && <KV k="Pagado" v={new Date(data.order.paid_at).toLocaleString('es-CO')} />}
            </Section>

            <Section title="Acciones">
              {action === 'idle' && (
                <div className="flex flex-wrap gap-2">
                  {(data.order.payment_status === 'approved' || data.order.payment_status === 'cod') && !data.order.tracking_number && (
                    <button
                      onClick={() => setAction('ship')}
                      className="px-4 py-2 text-xs uppercase tracking-wide bg-blue-600 text-white rounded"
                    >
                      Marcar enviado
                    </button>
                  )}
                  {data.order.tracking_number && data.order.status !== 'entregado' && data.order.status !== 'cancelado' && (
                    <>
                      <button
                        onClick={() => setAction('deliver')}
                        className="px-4 py-2 text-xs uppercase tracking-wide bg-green-600 text-white rounded"
                      >
                        Marcar entregado
                      </button>
                      <button
                        onClick={() => setAction('update_shipping')}
                        className="px-4 py-2 text-xs uppercase tracking-wide border border-blue-300 text-blue-700 rounded"
                      >
                        Actualizar guía
                      </button>
                    </>
                  )}
                  {data.order.payment_status === 'pending' && data.order.payment_link_url && (
                    <button
                      onClick={() => setAction('resend')}
                      className="px-4 py-2 text-xs uppercase tracking-wide bg-amber-600 text-white rounded"
                    >
                      Reenviar link de pago
                    </button>
                  )}
                  {!data.order.tracking_number && data.order.status !== 'cancelado' && (
                    <button onClick={() => setAction('cancel')}
                      className="px-4 py-2 text-xs uppercase tracking-wide border border-red-300 text-red-700 rounded">
                      Cancelar pedido
                    </button>
                  )}
                  {data.order.status === 'entregado' && (
                    <button onClick={() => setAction('undeliver')}
                      className="px-4 py-2 text-xs uppercase tracking-wide border border-orange-300 text-orange-700 rounded">
                      Desmarcar entregado
                    </button>
                  )}
                  <button onClick={() => setAction('delete_order')}
                    className="px-4 py-2 text-xs uppercase tracking-wide border border-red-400 text-red-800 rounded">
                    Eliminar pedido
                  </button>
                </div>
              )}

              {action === 'update_shipping' && (
                <ShipForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('Guía actualizada y cliente notificado.')
                    onChanged()
                    setAction('idle')
                    setTimeout(() => setToast(null), 3000)
                    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' })
                      .then((r) => r.json())
                      .then(setData)
                  }}
                  working={working}
                  setWorking={setWorking}
                  isUpdate
                />
              )}

              {action === 'undeliver' && (
                <UndeliverForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('Estado revertido a "En camino". Cliente notificado.')
                    onChanged()
                    setAction('idle')
                    setTimeout(() => setToast(null), 3000)
                    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' }).then((r) => r.json()).then(setData)
                  }}
                  working={working} setWorking={setWorking}
                />
              )}

              {action === 'delete_order' && (
                <DeleteOrderForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => { onChanged(); onClose() }}
                  working={working} setWorking={setWorking}
                />
              )}

              {action === 'deliver' && (
                <DeliverForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('¡Pedido marcado como entregado! Cliente notificado 🎉')
                    onChanged()
                    setAction('idle')
                    setTimeout(() => setToast(null), 3000)
                    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' })
                      .then((r) => r.json())
                      .then(setData)
                  }}
                  working={working}
                  setWorking={setWorking}
                />
              )}

              {action === 'ship' && (
                <ShipForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('Cliente notificado. Pedido marcado como enviado.')
                    onChanged()
                    setTimeout(() => setToast(null), 3000)
                    setAction('idle')
                    // refrescamos
                    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' })
                      .then((r) => r.json())
                      .then(setData)
                  }}
                  working={working}
                  setWorking={setWorking}
                />
              )}

              {action === 'resend' && (
                <ResendForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('Link reenviado al WhatsApp del cliente.')
                    setAction('idle')
                    setTimeout(() => setToast(null), 3000)
                  }}
                  working={working}
                  setWorking={setWorking}
                />
              )}

              {action === 'cancel' && (
                <CancelForm
                  order={data.order}
                  onCancel={() => setAction('idle')}
                  onDone={() => {
                    setToast('Pedido cancelado y cliente notificado.')
                    onChanged()
                    setAction('idle')
                    setTimeout(() => setToast(null), 3000)
                    botFetch(`/api/admin/web/orders/${shortId}`, { method: 'GET' })
                      .then((r) => r.json())
                      .then(setData)
                  }}
                  working={working}
                  setWorking={setWorking}
                />
              )}
            </Section>

            <Section title="Mensajes recientes">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.recent_messages.length === 0 && (
                  <p className="text-xs text-gray-400">Sin mensajes con este cliente.</p>
                )}
                {data.recent_messages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-xs p-2 rounded ${
                      m.direction === 'outbound'
                        ? 'bg-blue-50 ml-8'
                        : 'bg-gray-100 mr-8'
                    }`}
                  >
                    <div className="text-gray-500 text-[10px] mb-1">
                      {new Date(m.created_at).toLocaleString('es-CO')} · {m.intent ?? ''}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded shadow-lg">
            {toast}
          </div>
        )}
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2 font-semibold">{title}</h3>
      <div>{children}</div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex text-sm py-1">
      <div className="w-24 text-gray-500">{k}</div>
      <div className="flex-1 font-medium break-all">{v}</div>
    </div>
  )
}

function ShipForm({
  order,
  onCancel,
  onDone,
  working,
  setWorking,
  isUpdate,
}: {
  order: Order
  onCancel: () => void
  onDone: () => void
  working: boolean
  setWorking: (b: boolean) => void
  isUpdate?: boolean
}) {
  const [carrier, setCarrier] = useState(order.shipping_carrier ?? CARRIERS[0])
  const [customCarrier, setCustomCarrier] = useState('')
  const [tracking, setTracking] = useState(order.tracking_number ?? '')
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const finalCarrier = carrier === 'Otra' ? customCarrier.trim() : carrier
    if (!finalCarrier || !tracking.trim()) {
      setErr('Carrier y guía son requeridos.')
      return
    }
    const customerLabel = order.customer_name
      ? `${order.customer_name} (+${order.customer_phone})`
      : `+${order.customer_phone}`
    if (
      !confirm(
        `Vas a notificar a ${customerLabel} que su pedido #${order.short_id} salió con ${finalCarrier} y guía ${tracking.trim()}.\n\n¿Confirmas?`,
      )
    )
      return
    setErr(null)
    setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/ship`, {
      method: 'POST',
      body: JSON.stringify({ tracking_number: tracking.trim(), shipping_carrier: finalCarrier, is_update: isUpdate }),
    })
    setWorking(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error || 'No se pudo marcar.')
      return
    }
    const body = await res.json().catch(() => ({}))
    if (body.whatsapp_warning) {
      setErr(`⚠️ Pedido marcado, pero falló el WhatsApp al cliente: ${body.whatsapp_warning}`)
    }
    if (body.email_warning) {
      setErr((prev) => (prev ? prev + ` | Email: ${body.email_warning}` : `⚠️ Email no enviado: ${body.email_warning}`))
    }
    onDone()
  }

  return (
    <div className="border border-gray-200 rounded p-4">
      <label className="block text-xs text-gray-600 mb-1">Transportadora</label>
      <select
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded bg-white"
      >
        {CARRIERS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {carrier === 'Otra' && (
        <input
          value={customCarrier}
          onChange={(e) => setCustomCarrier(e.target.value)}
          placeholder="Nombre"
          className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded"
        />
      )}
      <label className="block text-xs text-gray-600 mb-1">Número de guía</label>
      <input
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded font-mono"
      />
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={working}
          className="px-3 py-2 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {working ? 'Enviando…' : isUpdate ? 'Actualizar y notificar' : 'Marcar y notificar'}
        </button>
      </div>
    </div>
  )
}

function ResendForm({
  order,
  onCancel,
  onDone,
  working,
  setWorking,
}: {
  order: Order
  onCancel: () => void
  onDone: () => void
  working: boolean
  setWorking: (b: boolean) => void
}) {
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const customerLabel = order.customer_name
      ? `${order.customer_name} (+${order.customer_phone})`
      : `+${order.customer_phone}`
    if (!confirm(`Vas a reenviar el link de pago del pedido #${order.short_id} a ${customerLabel} por WhatsApp.\n\n¿Confirmas?`))
      return
    setErr(null)
    setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/resend-link`, {
      method: 'POST',
    })
    setWorking(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error || 'No se pudo reenviar.')
      return
    }
    onDone()
  }

  return (
    <div className="border border-gray-200 rounded p-4 text-sm">
      <p className="mb-3">El cliente recibirá un mensaje con el link de pago activo de este pedido.</p>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={working}
          className="px-3 py-2 text-xs bg-amber-600 text-white rounded disabled:opacity-50"
        >
          {working ? 'Enviando…' : 'Reenviar ahora'}
        </button>
      </div>
    </div>
  )
}

function UndeliverForm({ order, onCancel, onDone, working, setWorking }: {
  order: Order; onCancel: () => void; onDone: () => void; working: boolean; setWorking: (b: boolean) => void
}) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function submit() {
    if (!confirm(`¿Revertir el pedido #${order.short_id} de "${order.customer_name ?? order.customer_phone}" a "En camino"? Se notificará al cliente.`)) return
    setErr(null); setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/undeliver`, {
      method: 'POST', body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
    setWorking(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'No se pudo revertir.'); return }
    onDone()
  }
  return (
    <div className="border border-orange-200 rounded p-4 bg-orange-50">
      <p className="text-sm mb-3">El cliente recibirá un WhatsApp indicando que hubo un error y su pedido sigue en proceso.</p>
      <label className="block text-xs text-gray-600 mb-1">Motivo (opcional — el cliente lo verá)</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
        placeholder="Ej: Marcamos como entregado por error, tu pedido sigue en camino."
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded resize-none mb-3" />
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">Cancelar</button>
        <button onClick={submit} disabled={working} className="px-3 py-2 text-xs bg-orange-600 text-white rounded disabled:opacity-50">
          {working ? 'Revirtiendo…' : 'Revertir y notificar'}
        </button>
      </div>
    </div>
  )
}

function DeleteOrderForm({ order, onCancel, onDone, working, setWorking }: {
  order: Order; onCancel: () => void; onDone: () => void; working: boolean; setWorking: (b: boolean) => void
}) {
  const [err, setErr] = useState<string | null>(null)
  async function submit() {
    if (!confirm(`¿Eliminar DEFINITIVAMENTE el pedido #${order.short_id} de "${order.customer_name ?? order.customer_phone}"?\n\nEsta acción NO se puede deshacer.`)) return
    setErr(null); setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/delete`, { method: 'DELETE' })
    setWorking(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.error || 'No se pudo eliminar.'); return }
    onDone()
  }
  return (
    <div className="border border-red-300 rounded p-4 bg-red-50">
      <p className="text-sm text-red-800 mb-3 font-medium">⚠️ Esta acción borra el pedido definitivamente y no se puede deshacer.</p>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">Cancelar</button>
        <button onClick={submit} disabled={working} className="px-3 py-2 text-xs bg-red-700 text-white rounded disabled:opacity-50">
          {working ? 'Eliminando…' : 'Sí, eliminar pedido'}
        </button>
      </div>
    </div>
  )
}

function DeliverForm({
  order,
  onCancel,
  onDone,
  working,
  setWorking,
}: {
  order: Order
  onCancel: () => void
  onDone: () => void
  working: boolean
  setWorking: (b: boolean) => void
}) {
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const customerLabel = order.customer_name
      ? `${order.customer_name} (+${order.customer_phone})`
      : `+${order.customer_phone}`
    if (!confirm(`Vas a marcar el pedido #${order.short_id} de ${customerLabel} como ENTREGADO y notificarle por WhatsApp.\n\n¿Confirmas?`))
      return
    setErr(null)
    setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/deliver`, { method: 'POST' })
    setWorking(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error || 'No se pudo marcar como entregado.')
      return
    }
    onDone()
  }

  return (
    <div className="border border-green-200 rounded p-4 bg-green-50">
      <p className="text-sm mb-3">
        El cliente recibirá un WhatsApp confirmando que su pedido fue entregado.
      </p>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={working}
          className="px-3 py-2 text-xs bg-green-600 text-white rounded disabled:opacity-50"
        >
          {working ? 'Marcando…' : 'Confirmar entrega'}
        </button>
      </div>
    </div>
  )
}

function CancelForm({
  order,
  onCancel,
  onDone,
  working,
  setWorking,
}: {
  order: Order
  onCancel: () => void
  onDone: () => void
  working: boolean
  setWorking: (b: boolean) => void
}) {
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const customerLabel = order.customer_name
      ? `${order.customer_name} (+${order.customer_phone})`
      : `+${order.customer_phone}`
    if (
      !confirm(
        `Vas a CANCELAR el pedido #${order.short_id} de ${customerLabel}${
          notify ? ' y notificarle por WhatsApp' : ''
        }.\n\n¿Confirmas?`,
      )
    )
      return
    setErr(null)
    setWorking(true)
    const res = await botFetch(`/api/admin/web/orders/${order.short_id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() || undefined, notify }),
    })
    setWorking(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error || 'No se pudo cancelar.')
      return
    }
    onDone()
  }

  return (
    <div className="border border-red-200 rounded p-4 bg-red-50">
      <label className="block text-xs text-gray-700 mb-1">Motivo (opcional, lo verá el cliente)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Ej: agotamos esa talla. ¡Mil disculpas!"
        className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded"
      />
      <label className="flex items-center gap-2 text-xs text-gray-700 mb-3">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Notificar al cliente por WhatsApp
      </label>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-2 text-xs border border-gray-300 rounded">
          No, dejar como está
        </button>
        <button
          onClick={submit}
          disabled={working}
          className="px-3 py-2 text-xs bg-red-600 text-white rounded disabled:opacity-50"
        >
          {working ? 'Cancelando…' : 'Sí, cancelar pedido'}
        </button>
      </div>
    </div>
  )
}
