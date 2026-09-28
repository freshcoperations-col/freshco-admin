// Prepara una foto para subirla: la redimensiona y la comprime en el navegador.
//
// Por qué: las funciones de Vercel rechazan cuerpos de más de 4,5 MB con un
// 413 que llega SIN cabecera CORS, así que el navegador lo ve como un fallo
// de red y la subida muere en silencio. Una foto de modelo sale fácil de
// 6-10 MB. Además, servir fotos de ese peso en la tienda es lento en celular.
//
// Resultado: máximo 2400 px en el lado largo. JPEG para fotos; PNG solo si
// la imagen tiene transparencia real. Nunca WebP: la API de WhatsApp solo
// acepta JPEG y PNG, y cualquier foto puede terminar siendo la "Vista
// principal" que el bot le manda al cliente (el tipo se cambia después).
// Las fotos que ya son livianas y de tamaño razonable se suben intactas.

const MAX_SIDE = 2400
const TARGET_BYTES = 3_500_000 // margen bajo el límite de 4,5 MB de Vercel

export const UPLOAD_LIMIT_BYTES = 4_400_000

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

// ¿Algún píxel no es totalmente opaco? Muestrea en saltos para no recorrer
// millones de píxeles; una zona transparente real ocupa bastante área.
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height)
  const step = 4 * 7 // uno de cada 7 píxeles
  for (let i = 3; i < data.length; i += step) {
    if (data[i] < 250) return true
  }
  return false
}

export async function prepareImageForUpload(file: File): Promise<File> {
  // GIF animados y SVG no se tocan: el canvas los aplanaría.
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Formato que el navegador no decodifica (ej. HEIC en Chrome): se manda
    // tal cual y, si pesa demasiado, el llamador muestra un error claro.
    return file
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  // Un WebP se convierte siempre, aunque sea liviano: WhatsApp no lo acepta.
  const esWebp = file.type === 'image/webp'
  if (scale === 1 && file.size <= TARGET_BYTES && !esWebp) {
    bitmap.close()
    return file
  }

  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, width, height)

  bitmap.close()

  let blob: Blob | null
  if (file.type !== 'image/jpeg' && hasTransparency(ctx, width, height)) {
    // PNG con transparencia (ej. un packshot recortado): se mantiene PNG.
    blob = await toBlob(canvas, 'image/png', 1)
  } else {
    // JPEG no tiene transparencia: fondo blanco por si acaso.
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    blob = await toBlob(canvas, 'image/jpeg', 0.85)
    // Si todavía pesa mucho, un segundo intento con menos calidad.
    if (blob && blob.size > TARGET_BYTES) blob = await toBlob(canvas, 'image/jpeg', 0.7)
  }

  if (!blob || (blob.size >= file.size && !esWebp)) return file

  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${base}.${ext}`, { type: blob.type })
}
