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
    botFetch('/api/admin/web/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => { setMe(data); setLoading(false) })
      .catch(() => setLoading(false))
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
