// Notificaciones del navegador (Web Notification API) — el operador no tiene
// que estar mirando la pestaña para enterarse de pedidos nuevos o de un
// cliente pidiendo asesor.

export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}

export function notify(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
    })
    // Cierra después de 8 segundos para no acumular.
    setTimeout(() => n.close(), 8000)
  } catch {
    // ignore
  }
}
