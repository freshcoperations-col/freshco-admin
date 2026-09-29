// Lector de CSV para la importación de productos.
//
// Tiene que aguantar lo que de verdad producen Excel y Google Sheets:
//   · separador ";" (Excel en español), "," (Google Sheets) o tabulador —
//     se detecta solo mirando el encabezado
//   · campos entre comillas con comas, punto y coma o saltos de línea
//     adentro (una descripción con párrafos), y comillas escapadas ("")
//   · la marca UTF-8 (BOM) al inicio
//   · archivos que NO vienen en UTF-8: el "CSV" clásico de Excel se guarda en
//     Windows-1252, y leído como UTF-8 convierte "Diseño" en "Dise�o".

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
  delimiter: string
  encoding: 'utf-8' | 'windows-1252'
}

export function decodeCsv(buffer: ArrayBuffer): { text: string; encoding: ParsedCsv['encoding'] } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return { text, encoding: 'utf-8' }
  } catch {
    // No es UTF-8 válido: es el CSV clásico de Excel.
    return { text: new TextDecoder('windows-1252').decode(buffer), encoding: 'windows-1252' }
  }
}

// El separador que más aparece en la primera línea, fuera de comillas.
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

// Parser RFC 4180: recorre carácter por carácter para respetar comillas.
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }  // comilla escapada
        else inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

export function parseCsv(buffer: ArrayBuffer): ParsedCsv {
  const { text: raw, encoding } = decodeCsv(buffer)
  const text = raw.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(text)
  const all = parseRows(text, delimiter)

  // Encabezados sin espacios alrededor. Una columna sin nombre se ignora, y si
  // un nombre se repite exacto gana la primera.
  const headers = (all[0] ?? []).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (const cells of all.slice(1)) {
    if (cells.every((c) => c.trim() === '')) continue // filas en blanco al final
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h !== '' && !(h in obj)) obj[h] = cells[i] ?? ''
    })
    rows.push(obj)
  }
  return { headers, rows, delimiter, encoding }
}
