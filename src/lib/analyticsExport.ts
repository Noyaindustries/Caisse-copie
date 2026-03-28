/** Échappe une cellule CSV (guillemets doubles). */
export function csvEscapeCell(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

/** Génère des lignes CSV avec séparateur `;` (compat Excel FR) + BOM UTF-8. */
export function toCsvSemicolon(rows: string[][]): string {
  const lines = rows.map((row) =>
    row.map((c) => csvEscapeCell(String(c))).join(';'),
  )
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
