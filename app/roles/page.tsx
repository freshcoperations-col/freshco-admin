'use client'

import { useEffect, useState, useCallback } from 'react'
import { botFetch } from '@/lib/api'
import { PERMISSION_DEFS, type PermissionId, type PermissionsMap } from '@/lib/permissions'
import { usePermissions } from '@/contexts/PermissionsContext'
import { useRouter } from 'next/navigation'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: PermissionsMap
  is_system: boolean
  user_count?: number
}

const SECTIONS = Array.from(new Set(PERMISSION_DEFS.map((p) => p.section)))

function emptyPermissions(): PermissionsMap {
  return Object.fromEntries(PERMISSION_DEFS.map((p) => [p.id, false])) as PermissionsMap
}

function PermissionCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: PermissionsMap
  onChange: (next: PermissionsMap) => void
  disabled?: boolean
}) {
  function toggle(id: PermissionId) {
    onChange({ ...value, [id]: !value[id] })
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => (
        <div key={section}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{section}</p>
          <div className="space-y-1">
            {PERMISSION_DEFS.filter((p) => p.section === section).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-0"
                  checked={!!value[p.id]}
                  onChange={() => toggle(p.id)}
                  disabled={disabled}
                />
                <span className={disabled ? 'text-gray-400' : 'text-gray-700'}>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RolesPage() {
  const router = useRouter()
  const { isOwner, loading: permLoading } = usePermissions()

  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form para crear
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createPerms, setCreatePerms] = useState<PermissionsMap>(emptyPermissions)

  // Rol en edición
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPerms, setEditPerms] = useState<PermissionsMap>(emptyPermissions)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await botFetch('/api/admin/web/roles')
    if (res.ok) {
      const data = await res.json()
      setRoles(data.roles ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!permLoading && !isOwner) router.replace('/')
    if (!permLoading && isOwner) load()
  }, [permLoading, isOwner, load, router])

  async function handleCreate() {
    if (!createName.trim()) return
    setSaving(true)
    const res = await botFetch('/api/admin/web/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || null, permissions: createPerms }),
    })
    setSaving(false)
    if (res.ok) {
      showToast('Rol creado')
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setCreatePerms(emptyPermissions())
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al crear')
    }
  }

  function startEdit(role: Role) {
    setEditId(role.id)
    setEditName(role.name)
    setEditDesc(role.description ?? '')
    setEditPerms({ ...emptyPermissions(), ...role.permissions })
  }

  async function handleEdit() {
    if (!editId || !editName.trim()) return
    setSaving(true)
    const res = await botFetch(`/api/admin/web/roles/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null, permissions: editPerms }),
    })
    setSaving(false)
    if (res.ok) {
      showToast('Rol actualizado')
      setEditId(null)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al guardar')
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(role.id)
    const res = await botFetch(`/api/admin/web/roles/${role.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      showToast('Rol eliminado')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Error al eliminar')
    }
  }

  if (permLoading || loading) {
    return <div className="p-8 text-sm text-gray-400">Cargando…</div>
  }

  if (!isOwner) return null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Roles</h1>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditId(null) }}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
        >
          {showCreate ? 'Cancelar' : '+ Nuevo rol'}
        </button>
      </div>

      {/* Formulario crear */}
      {showCreate && (
        <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
          <p className="font-semibold text-sm">Nuevo rol</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ej: Operador de ventas"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descripción (opcional)</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Ej: Solo pedidos y conversaciones"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-2">Permisos</label>
            <PermissionCheckboxes value={createPerms} onChange={setCreatePerms} />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !createName.trim()}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Crear rol'}
          </button>
        </div>
      )}

      {/* Lista de roles */}
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            {/* Header del rol */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div>
                <span className="font-semibold text-sm">{role.name}</span>
                {role.is_system && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    Sistema
                  </span>
                )}
                {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!role.is_system && editId !== role.id && (
                  <button
                    onClick={() => startEdit(role)}
                    className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded hover:bg-white"
                  >
                    Editar
                  </button>
                )}
                {editId === role.id && (
                  <button
                    onClick={() => setEditId(null)}
                    className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                )}
                {!role.is_system && (
                  <button
                    onClick={() => handleDelete(role)}
                    disabled={deleting === role.id}
                    className="text-xs text-red-500 border border-red-100 px-2.5 py-1 rounded hover:bg-red-50 disabled:opacity-40"
                  >
                    {deleting === role.id ? '…' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>

            {/* Edición inline */}
            {editId === role.id ? (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Nombre</label>
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                </div>
                <PermissionCheckboxes value={editPerms} onChange={setEditPerms} />
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-40"
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            ) : (
              /* Vista de solo lectura de permisos */
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSION_DEFS.filter((p) => role.permissions?.[p.id]).map((p) => (
                    <span key={p.id} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {p.label}
                    </span>
                  ))}
                  {!PERMISSION_DEFS.some((p) => role.permissions?.[p.id]) && (
                    <span className="text-xs text-gray-300 italic">Sin permisos asignados</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
