import { botFetch } from './api'
import { prepareImageForUpload, UPLOAD_LIMIT_BYTES } from './image-compress'

// Sube una imagen a un endpoint del bot que recibe FormData { file, ...extra }.
//
// Siempre comprime primero en el navegador: Vercel corta en 4,5 MB con un 413
// sin CORS que el navegador reporta como fallo de red, y la subida moría en
// silencio (así se perdían las fotos adicionales de producto). Nunca lanza:
// cualquier problema vuelve como { ok: false, error } para mostrarlo.
export async function uploadImage<T = Record<string, unknown>>(
  path: string,
  file: File,
  extra: Record<string, string> = {},
): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'El archivo no es una imagen' }
  }
  let prepared: File
  try {
    prepared = await prepareImageForUpload(file)
  } catch {
    prepared = file
  }
  if (prepared.size > UPLOAD_LIMIT_BYTES) {
    return { ok: false, error: 'La imagen pesa demasiado, incluso comprimida. Prueba con una más liviana.' }
  }

  const fd = new FormData()
  fd.append('file', prepared)
  for (const [k, v] of Object.entries(extra)) fd.append(k, v)

  try {
    const res = await botFetch(path, { method: 'POST', body: fd })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body.error ?? `Error ${res.status}` }
    return { ok: true, body: body as T }
  } catch {
    return { ok: false, error: 'Error de conexión al subir la imagen' }
  }
}

// Lee el primer archivo de imagen de un evento de arrastrar-y-soltar.
export function imageFromDrop(e: React.DragEvent): File | null {
  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
  return file ?? null
}
