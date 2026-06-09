'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { botFetch } from '@/lib/api'
import type { MeResponse, PermissionsMap, PermissionId } from '@/lib/permissions'

interface PermissionsContextValue {
  loading: boolean
  email: string | null
  role: string | null
  permissions: PermissionsMap | null
  isOwner: boolean
  can: (perm: PermissionId) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue>({
  loading: true,
  email: null,
  role: null,
  permissions: null,
  isOwner: false,
  can: () => false,
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<MeResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(attempt = 0) {
      try {
        const r = await botFetch('/api/admin/web/me')
        if (cancelled) return
        if (r.ok) {
          const data: MeResponse = await r.json()
          setMe(data)
          setLoading(false)
        } else if (r.status === 403 && attempt < 3) {
          // Sesión aún no lista — reintenta con backoff
          setTimeout(() => load(attempt + 1), 600 * (attempt + 1))
        } else {
          setLoading(false)
        }
      } catch {
        if (cancelled) return
        if (attempt < 3) {
          setTimeout(() => load(attempt + 1), 600 * (attempt + 1))
        } else {
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  function can(perm: PermissionId): boolean {
    if (!me?.permissions) return false
    return me.permissions[perm] === true
  }

  return (
    <PermissionsContext.Provider value={{
      loading,
      email: me?.email ?? null,
      role: me?.role ?? null,
      permissions: me?.permissions ?? null,
      isOwner: me?.isOwner ?? false,
      can,
    }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
