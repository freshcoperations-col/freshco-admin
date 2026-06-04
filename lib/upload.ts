import { botFetch } from './api'

// Sube una imagen al Storage del bot para un producto específico.
// El bot maneja la autenticación con Supabase y construye el nombre correcto.
export async function uploadProductImage(
  productId: string,
  color: string,
  side: 'frente' | 'detras',
  file: File,
): Promise<{ ok: boolean; public_url?: string; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('color', color)
  form.append('side', side)

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BOT_API_URL}/api/admin/web/products/${productId}/upload-image`,
    {
      method: 'POST',
      headers: {
        // Solo Authorization — NO Content-Type, el browser lo pone solo con el boundary
        ...(await authHeader()),
      },
      body: form,
    },
  )

  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error || 'Upload failed' }
  return { ok: true, public_url: body.public_url }
}

async function authHeader(): Promise<Record<string, string>> {
  // Importación dinámica para evitar ciclos en el módulo.
  const { getSupabase } = await import('./supabase')
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
