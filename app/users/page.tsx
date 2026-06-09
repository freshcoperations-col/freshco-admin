'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'
import { usePermissions } from '@/contexts/PermissionsContext'
import { useRouter } from 'next/navigation'

interface Role {
  id: string
  name: string
}

interface AdminUser {
  id: string
  email: string
  role_id: string
  role_name: string
  created_at: string
}

export default function UsersPage() {
  const router = useRouter()
  const { isOwner, loading: permLoading } = usePermissions()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [changing, setChanging] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [newRoleId, setNewRoleId] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, rolesRes] = await Promise.all([
      botFetch('/api/admin/web/users'),
      botFetch('/api/admin/web/roles'),
    ])
    if (usersRes.ok) {
      const d = await usersRes.json()
      setUsers(d.users ?? [])
    }
    if (rolesRes.ok) {
      const d = await rolesRes.json()
      const r: Role[] = d.roles ?? []
      setRoles(r)
      setNewRoleId((prev) => prev || r[0]?.id || '')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!permLoading && !isOwner) router.replace('/')
    if (!permLoading && isOwner) load()
  }, [permLoading, isOwner, load, router])

  async function handleAddUser() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !newRoleId) return
    setSaving(true)
    const res = await botFetch('/api/admin/web/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role_id: newRoleId }),
    })
    setSaving(false)
    if (res.ok) {
      showToast('Usuario agregado')
      setNewEmail('')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al agregar')
    }
  }

  async function handleChangeRole(user: AdminUser, roleId: string) {
    setChanging(user.id)
    const res = await botFetch(`/api/admin/web/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId }),
    })
    setChanging(null)
    if (res.ok) {
      showToast('Rol actualizado')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al cambiar rol')
    }
  }

  async function handleRemove(user: AdminUser) {
    if (!confirm(`¿Revocar acceso de ${user.email}?`)) return
    setDeleting(user.id)
    const res = await botFetch(`/api/admin/web/users/${user.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      showToast('Acceso revocado')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al revocar')
    }
  }

  if (permLoading || loading) {
    return <div className="p-8 text-sm text-gray-400">Cargando…</div>
  }

  if (!isOwner) return null

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Usuarios con acceso al admin</h1>

      {/* Agregar usuario */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <p className="font-semibold text-sm">Agregar usuario</p>
        <div className="flex gap-3">
          <input
            type="email"
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="correo@ejemplo.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
          />
          <select
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddUser}
            disabled={saving || !newEmail.trim() || !newRoleId}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700 disabled:opacity-40 whitespace-nowrap"
          >
            {saving ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          El usuario debe iniciar sesión con Google usando este correo para acceder al admin.
        </p>
      </div>

      {/* Lista de usuarios */}
      {users.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin usuarios adicionales. Los admins del sistema no aparecen aquí.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl bg-white divide-y divide-gray-100 overflow-hidden">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
                <p className="text-xs text-gray-400">
                  Agregado {new Date(user.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {/* Selector de rol inline */}
              <select
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={user.role_id}
                disabled={changing === user.id}
                onChange={(e) => handleChangeRole(user, e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              {changing === user.id && (
                <span className="text-xs text-gray-400">…</span>
              )}

              <button
                onClick={() => handleRemove(user)}
                disabled={deleting === user.id}
                className="text-xs text-red-500 border border-red-100 px-2.5 py-1 rounded hover:bg-red-50 disabled:opacity-40 whitespace-nowrap"
              >
                {deleting === user.id ? '…' : 'Revocar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
