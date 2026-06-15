'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { botFetch } from '@/lib/api'

interface Overview {
  active_users: number
  new_users: number
  sessions: number
  page_views: number
  avg_session_duration: number
  bounce_rate: number
}

interface GaData {
  range: { start: string; end: string; days: number }
  current: Overview
  previous: Overview
  realtime_active_users: number
  daily_series: { date: string; active_users: number; sessions: number; page_views: number }[]
  top_pages: { path: string; page_views: number; active_users: number }[]
  traffic_sources: { channel: string; sessions: number; active_users: number }[]
  devices: { device: string; sessions: number }[]
  countries: { country: string; active_users: number }[]
}

type DateRange = 7 | 30 | 90

function formatNumber(n: number) {
  return Math.round(n).toLocaleString('es-CO')
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function formatPercent(n: number) {
  return `${Math.round(n * 100)}%`
}

function formatAxisInt(n: number) {
  if (n >= 1_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `${Math.round(n)}`
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Móvil',
  desktop: 'Escritorio',
  tablet: 'Tablet',
}

function Change({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return null
  const diff = ((current - previous) / previous) * 100
  const rounded = Math.round(diff)
  if (rounded === 0) return <span className="text-xs text-gray-400 ml-1">· sin cambio</span>
  const good = invert ? rounded < 0 : rounded > 0
  return (
    <span className={`text-xs ml-1 ${good ? 'text-green-600' : 'text-red-500'}`}>
      {rounded > 0 ? '▲' : '▼'} {Math.abs(rounded)}%
    </span>
  )
}

function StatCard({
  label, value, sub, current, previous, invert,
}: {
  label: string
  value: string
  sub?: string
  current: number
  previous: number
  invert?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {value}
        <Change current={current} previous={previous} invert={invert} />
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Bar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
    </div>
  )
}

export default function WebTrafficPage() {
  const [data, setData] = useState<GaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>(30)

  const load = useCallback(async (days: DateRange) => {
    setLoading(true)
    setError(null)
    try {
      const res = await botFetch(`/api/admin/web/ga-overview?days=${days}`, { method: 'GET' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'No se pudieron cargar los datos.')
        setData(null)
        return
      }
      setData(body)
    } catch {
      setError('Error de conexión.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [load, range])

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold">Tráfico web</h1>
          <p className="text-sm text-gray-500">Visitantes y comportamiento en freshco-design.com (Google Analytics).</p>
        </div>
        <div className="flex items-center gap-3">
          {data && data.realtime_active_users > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {data.realtime_active_users} ahora
            </span>
          )}
          <button
            onClick={() => load(range)}
            className="px-4 py-2 text-xs uppercase tracking-wide bg-gray-900 text-white rounded"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6">
        {([7, 30, 90] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              range === r
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {r === 7 ? '7 días' : r === 30 ? '30 días' : '90 días'}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400">Cargando datos...</p>}

      {!loading && error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-800">
          <p className="font-medium mb-1">No se pudo cargar el tráfico web.</p>
          <p className="text-amber-700">{error}</p>
          {error.includes('no está configurado') && (
            <p className="text-amber-700 mt-2">
              Pide al desarrollador que configure las variables <code className="font-mono">GA4_PROPERTY_ID</code>,{' '}
              <code className="font-mono">GA4_CLIENT_EMAIL</code> y <code className="font-mono">GA4_PRIVATE_KEY</code> en el backend.
            </p>
          )}
        </div>
      )}

      {!loading && !error && data && (() => {
        const { current, previous, daily_series, top_pages, traffic_sources, devices, countries } = data
        const maxSeries = Math.max(...daily_series.map((d) => d.sessions), 1)
        const maxPageViews = Math.max(...top_pages.map((p) => p.page_views), 1)
        const totalSourceSessions = traffic_sources.reduce((s, t) => s + t.sessions, 0) || 1
        const totalDeviceSessions = devices.reduce((s, d) => s + d.sessions, 0) || 1
        const maxCountryUsers = Math.max(...countries.map((c) => c.active_users), 1)
        const step = range === 7 ? 1 : range === 30 ? 5 : 10

        return (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Usuarios"
                value={formatNumber(current.active_users)}
                current={current.active_users}
                previous={previous.active_users}
              />
              <StatCard
                label="Usuarios nuevos"
                value={formatNumber(current.new_users)}
                current={current.new_users}
                previous={previous.new_users}
              />
              <StatCard
                label="Sesiones"
                value={formatNumber(current.sessions)}
                current={current.sessions}
                previous={previous.sessions}
              />
              <StatCard
                label="Vistas de página"
                value={formatNumber(current.page_views)}
                current={current.page_views}
                previous={previous.page_views}
              />
              <StatCard
                label="Duración media"
                value={formatDuration(current.avg_session_duration)}
                sub="Tiempo promedio por sesión"
                current={current.avg_session_duration}
                previous={previous.avg_session_duration}
              />
              <StatCard
                label="Tasa de rebote"
                value={formatPercent(current.bounce_rate)}
                sub="Sesiones de una sola página"
                current={current.bounce_rate}
                previous={previous.bounce_rate}
                invert
              />
            </div>

            {/* Daily trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Sesiones por día</h3>
              <div className="flex gap-2">
                <div className="flex flex-col justify-between text-right flex-shrink-0" style={{ width: '40px', height: '120px' }}>
                  <span className="text-xs text-gray-400 font-mono">{formatAxisInt(maxSeries)}</span>
                  <span className="text-xs text-gray-400 font-mono">{formatAxisInt(maxSeries / 2)}</span>
                  <span className="text-xs text-gray-400 font-mono">0</span>
                </div>
                <div className="flex-1 relative" style={{ height: '120px' }}>
                  <div className="absolute inset-x-0 pointer-events-none" style={{ top: 0, height: '96px' }}>
                    <div className="absolute inset-x-0 top-0 border-t border-gray-100" />
                    <div className="absolute inset-x-0 border-t border-gray-100" style={{ top: '50%' }} />
                    <div className="absolute inset-x-0 bottom-0 border-t border-gray-200" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-0.5" style={{ height: '120px' }}>
                    {daily_series.map((d, i) => {
                      const BAR_MAX_PX = 96
                      const barPx = maxSeries > 0 ? Math.round((d.sessions / maxSeries) * BAR_MAX_PX) : 0
                      const showLabel = i % step === 0
                      const label = d.date.slice(5).replace('-', '/')
                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center justify-end min-w-0"
                          style={{ height: '120px' }}
                          title={`${d.date}: ${d.sessions} sesiones · ${d.active_users} usuarios · ${d.page_views} vistas`}
                        >
                          <div
                            className={`w-full rounded-t-sm transition-colors ${d.sessions > 0 ? 'bg-blue-500 hover:bg-blue-400' : 'bg-transparent'}`}
                            style={{ height: `${Math.max(barPx, d.sessions > 0 ? 3 : 0)}px` }}
                          />
                          <span
                            className="text-gray-400 font-mono mt-1 overflow-hidden"
                            style={{ fontSize: '8px', opacity: showLabel ? 1 : 0, flexShrink: 0 }}
                          >
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {daily_series.every((d) => d.sessions === 0) && (
                <p className="text-xs text-gray-400 text-center mt-2">Sin datos de tráfico en este período.</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Top pages */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Páginas más visitadas</h3>
                {top_pages.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="space-y-3">
                    {top_pages.map((p) => (
                      <div key={p.path} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 flex-1 truncate font-mono" title={p.path}>{p.path}</span>
                        <div className="w-24">
                          <Bar pct={(p.page_views / maxPageViews) * 100} color="bg-indigo-400" />
                        </div>
                        <span className="text-xs font-mono text-gray-600 w-12 text-right">{formatNumber(p.page_views)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Traffic sources */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Fuentes de tráfico</h3>
                {traffic_sources.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="space-y-3">
                    {traffic_sources.map((t) => (
                      <div key={t.channel} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-32 truncate">{t.channel}</span>
                        <Bar pct={(t.sessions / totalSourceSessions) * 100} color="bg-blue-500" />
                        <span className="text-sm font-mono text-gray-700 w-10 text-right">{t.sessions}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {Math.round((t.sessions / totalSourceSessions) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Devices */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Dispositivos</h3>
                {devices.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="space-y-3">
                    {devices.map((d) => (
                      <div key={d.device} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-24">{DEVICE_LABELS[d.device] ?? d.device}</span>
                        <Bar pct={(d.sessions / totalDeviceSessions) * 100} color="bg-emerald-500" />
                        <span className="text-sm font-mono text-gray-700 w-10 text-right">{d.sessions}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {Math.round((d.sessions / totalDeviceSessions) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Countries */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Países</h3>
                {countries.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin datos.</p>
                ) : (
                  <div className="space-y-3">
                    {countries.map((c) => (
                      <div key={c.country} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-32 truncate">{c.country}</span>
                        <Bar pct={(c.active_users / maxCountryUsers) * 100} color="bg-amber-400" />
                        <span className="text-sm font-mono text-gray-700 w-10 text-right">{c.active_users}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              Datos de {data.range.start} a {data.range.end}, comparados con el período anterior equivalente.
              Ver detalle completo en{' '}
              <Link href="https://analytics.google.com" target="_blank" className="underline">
                Google Analytics
              </Link>.
            </p>
          </>
        )
      })()}
    </div>
  )
}
