'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { botFetch } from '@/lib/api'

interface Conversation {
  customer_phone: string
  last_message: string
  last_message_at: string
  last_intent: string
  total_messages: number
  first_contact_at: string
  ai_paused: boolean
}

interface Message {
  id: string
  customer_phone: string
  direction: 'inbound' | 'outbound'
  content: string
  intent: string | null
  created_at: string
}

const INTENT_LABEL: Record<string, string> = {
  consulta_producto: '🛍 Producto',
  pedido: '📦 Pedido',
  consulta_pago: '💳 Pago',
  consulta_envio: '🚚 Envío',
  consulta_tallas: '📏 Tallas',
  saludo: '👋 Saludo',
  solicita_asesor: '🆘 Asesor',
  otro: '',
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [aiPaused, setAiPaused] = useState(false)
  const [advisorName, setAdvisorName] = useState('')

  // Obtener nombre del asesor logueado para el saludo
  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      const u = data.user
      const name =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        u?.email?.split('@')[0] ||
        'Asesor'
      setAdvisorName(name)
    })
  }, [])

  const loadConversations = useCallback(async () => {
    const res = await botFetch('/api/admin/web/conversations', { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setConversations(body.conversations ?? [])
    }
    setLoadingConvs(false)
  }, [])

  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMsgs(true)
    const res = await botFetch(`/api/admin/web/conversations/${phone}/messages`, { method: 'GET' })
    if (res.ok) {
      const body = await res.json()
      setMessages(body.messages ?? [])
    }
    setLoadingMsgs(false)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (selected) {
      loadMessages(selected)
      const conv = conversations.find((c) => c.customer_phone === selected)
      setAiPaused(conv?.ai_paused ?? false)
    }
  }, [selected, loadMessages, conversations])

  // Realtime: suscripción a mensajes nuevos en Supabase
  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel('admin-conv-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        // Actualizar conversaciones siempre
        loadConversations()
        // Si es del cliente seleccionado, agregar al chat
        if (msg.customer_phone === selected) {
          setMessages((prev) => [...prev, msg])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selected, loadConversations])

  async function handleSend() {
    if (!draft.trim() || !selected) return
    setSending(true)
    const res = await botFetch(`/api/admin/web/conversations/${selected}/send`, {
      method: 'POST',
      body: JSON.stringify({ message: draft.trim() }),
    })
    setSending(false)
    if (res.ok) {
      setDraft('')
      loadMessages(selected)
    }
  }

  async function handleToggleAI() {
    if (!selected) return
    const newPaused = !aiPaused
    await botFetch(`/api/admin/web/conversations/${selected}/toggle-ai`, {
      method: 'POST',
      body: JSON.stringify({
        paused: newPaused,
        advisor_name: newPaused ? advisorName : undefined,
      }),
    })
    setAiPaused(newPaused)
    setConversations((prev) =>
      prev.map((c) =>
        c.customer_phone === selected ? { ...c, ai_paused: newPaused } : c,
      ),
    )
  }

  async function handleDeleteConv() {
    if (!selected) return
    if (!confirm(`¿Eliminar todos los mensajes de +${selected}?\n\nEsta acción no se puede deshacer.`)) return
    await botFetch(`/api/admin/web/conversations/${selected}/delete`, { method: 'DELETE' })
    setSelected(null)
    setMessages([])
    loadConversations()
  }

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.customer_phone.includes(q) || c.last_message.toLowerCase().includes(q)
  })

  const showChat = selected !== null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Móvil: lista O chat a pantalla completa */}
      <div className={`md:hidden w-full h-full ${showChat ? 'hidden' : 'flex flex-col'} bg-white`}>
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold mb-2">Conversaciones</h2>
          <input placeholder="Buscar por teléfono…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 text-xs text-gray-400 text-center">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-xs text-gray-400 text-center">Sin conversaciones.</div>
          ) : filtered.map((c) => (
            <button key={c.customer_phone} onClick={() => setSelected(c.customer_phone)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-medium">+{c.customer_phone}</span>
                <span className="text-[10px] text-gray-400">{new Date(c.last_message_at).toLocaleDateString('es-CO')}</span>
              </div>
              <div className="text-xs text-gray-600 truncate">{c.last_message}</div>
              {c.ai_paused && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Manual</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Chat móvil: altura exacta de pantalla menos el header del AdminShell (h-12 = 3rem) */}
      <div className={`md:hidden w-full h-[calc(100dvh-3rem)] ${showChat ? 'flex flex-col' : 'hidden'}`}>
        {selected && (
          <ChatView phone={selected} conversations={conversations} messages={messages}
            loadingMsgs={loadingMsgs} aiPaused={aiPaused}
            draft={draft} setDraft={setDraft} sending={sending} advisorName={advisorName}
            onBack={() => setSelected(null)} onToggleAI={handleToggleAI} onSend={handleSend}
            onDeleteConv={handleDeleteConv} />
        )}
      </div>

      {/* Desktop: dos paneles lado a lado */}
      <div className="hidden md:flex w-full h-full overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold mb-2">Conversaciones</h2>
            <input placeholder="Buscar por teléfono…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="p-4 text-xs text-gray-400 text-center">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">Sin conversaciones.</div>
            ) : filtered.map((c) => (
              <button key={c.customer_phone} onClick={() => setSelected(c.customer_phone)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${selected === c.customer_phone ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium">+{c.customer_phone}</span>
                  <span className="text-[10px] text-gray-400">{new Date(c.last_message_at).toLocaleDateString('es-CO')}</span>
                </div>
                <div className="text-xs text-gray-600 truncate">{c.last_message}</div>
                {c.ai_paused && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Manual</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <ChatView phone={selected} conversations={conversations} messages={messages}
              loadingMsgs={loadingMsgs} aiPaused={aiPaused}
              draft={draft} setDraft={setDraft} sending={sending} advisorName={advisorName}
              onBack={() => setSelected(null)} onToggleAI={handleToggleAI} onSend={handleSend}
              onDeleteConv={handleDeleteConv} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Selecciona una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChatView({ phone, conversations, messages, loadingMsgs, aiPaused,
  draft, setDraft, sending, advisorName, onBack, onToggleAI, onSend, onDeleteConv }: {
  phone: string
  conversations: { customer_phone: string; total_messages: number }[]
  messages: { id: string; direction: string; content: string; intent: string | null; created_at: string }[]
  loadingMsgs: boolean
  aiPaused: boolean
  draft: string
  setDraft: (v: string) => void
  sending: boolean
  advisorName: string
  onBack: () => void
  onToggleAI: () => void
  onSend: () => void
  onDeleteConv: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || messages.length === 0) return
    const isInitial = prevLen.current === 0
    // scrollTop = scrollHeight es el método más confiable en todos los browsers móviles
    if (isInitial) {
      el.scrollTop = el.scrollHeight
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
    prevLen.current = messages.length
  }, [messages])

  // Reset al cambiar de conversación
  useEffect(() => {
    prevLen.current = 0
  }, [phone])

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-900">←</button>
          <div>
            <div className="text-sm font-mono font-medium">+{phone}</div>
            <div className="text-xs text-gray-500">
              {conversations.find((c) => c.customer_phone === phone)?.total_messages ?? 0} mensajes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleAI}
            className={`px-3 py-1.5 text-xs rounded border font-medium ${aiPaused ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
            {aiPaused ? '🟠 Pausado' : '🟢 AI activo'}
          </button>
          <button onClick={onDeleteConv}
            className="px-2 py-1.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
            title="Eliminar conversación">
            🗑
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
        {loadingMsgs ? (
          <div className="text-center text-xs text-gray-400 pt-8">Cargando mensajes…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 pt-8">Sin mensajes.</div>
        ) : messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.direction === 'outbound' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'}`}>
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
              <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'}`}>
                {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
        {aiPaused && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-orange-600">Al pausado — tu mensaje llegará al cliente.</span>
            <button
              onClick={() => setDraft(`¡Hola! 👋 Soy ${advisorName || 'tu asesor'} de Freshco. Estoy aquí para atenderte personalmente. ¿En qué te puedo ayudar? 💛`)}
              className="text-xs px-2.5 py-1 bg-orange-50 border border-orange-300 text-orange-700 rounded hover:bg-orange-100 font-medium whitespace-nowrap"
            >
              👋 Usar saludo
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            rows={2} placeholder="Escribe un mensaje…"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded resize-none focus:outline-none" />
          <button onClick={onSend} disabled={sending || !draft.trim()}
            className="px-4 py-2 text-xs uppercase tracking-wide bg-blue-600 text-white rounded disabled:opacity-50 self-end">
            {sending ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
