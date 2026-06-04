import { getSupabase } from './supabase'

// Wrapper para llamar al backend del bot con el access_token del usuario.
// Los endpoints viven en NEXT_PUBLIC_BOT_API_URL/api/admin/web/*.
//
// El bot valida el token + verifica ADMIN_EMAILS allowlist server-side.

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL ?? ''

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function botFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!BOT_API_URL) {
    throw new Error('NEXT_PUBLIC_BOT_API_URL no está configurada.')
  }
  const isFormData = init.body instanceof FormData
  const headers = {
    // No poner Content-Type cuando es FormData — el browser lo pone con el boundary
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers ?? {}),
    ...(await authHeaders()),
  }
  return fetch(`${BOT_API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}
