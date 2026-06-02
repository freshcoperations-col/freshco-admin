'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/')
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.replace('/')
  }

  async function handleGoogle() {
    setError(null)
    setLoading(true)
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setLoading(false)
      setError(error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h1 className="text-lg font-semibold mb-1">Freshco Admin</h1>
        <p className="text-xs text-gray-500 mb-6">Solo para el equipo autorizado.</p>

        <label className="block text-xs text-gray-600 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="w-full px-3 py-2 mb-4 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900"
        />

        <label className="block text-xs text-gray-600 mb-1">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 mb-4 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900"
        />

        {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-3 text-xs text-gray-400">o</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-2 text-xs uppercase tracking-wide bg-white text-gray-900 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(27.009 -39.239)">
              <path fill="#4285F4" d="M-3.264 51.509c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
              <path fill="#34A853" d="M-14.754 63.239c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.75-4.96h-3.96v3.09c1.97 3.92 6.02 6.62 10.71 6.62z" />
              <path fill="#FBBC05" d="M-21.504 53.529c-.25-.72-.39-1.49-.39-2.29 0-.8.14-1.57.39-2.29v-3.09h-3.96c-.82 1.62-1.29 3.44-1.29 5.38 0 1.94.47 3.76 1.29 5.38z" />
              <path fill="#EA4335" d="M-14.754 43.989c1.77 0 3.35.61 4.6 1.8l3.42-3.42c-2.07-1.94-4.78-3.13-8.02-3.13-4.69 0-8.74 2.7-10.71 6.62l3.96 3.09c.97-2.85 3.62-4.96 6.75-4.96z" />
            </g>
          </svg>
          Entrar con Google
        </button>
      </form>
    </div>
  )
}
