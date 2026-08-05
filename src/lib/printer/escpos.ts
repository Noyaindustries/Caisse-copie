/** Encodeurs et commandes ESC/POS pour imprimantes thermiques type Toplink TL-R120. */

export const ESC = 0x1b
export const GS = 0x1d
export const LF = 0x0a

/** Largeur utile 80 mm — police A (12×24) ≈ 48 colonnes. */
export const RECEIPT_COLS_80MM = 48

export function encodeAscii(text: string): Uint8Array {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[œŒ]/g, (m) => (m === 'œ' ? 'oe' : 'OE'))
    .replace(/[æÆ]/g, (m) => (m === 'æ' ? 'ae' : 'AE'))
    .replace(/[€]/g, 'EUR')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
  const bytes = new Uint8Array(normalized.length)
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i)
    bytes[i] = code < 128 ? code : 0x3f
  }
  return bytes
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function cmdInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40])
}

export function cmdAlign(mode: 'left' | 'center' | 'right'): Uint8Array {
  const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0
  return new Uint8Array([ESC, 0x61, n])
}

export function cmdBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0])
}

export function cmdDoubleSize(on: boolean): Uint8Array {
  return new Uint8Array([GS, 0x21, on ? 0x11 : 0x00])
}

export function cmdFeed(lines = 1): Uint8Array {
  const count = Math.max(1, Math.min(lines, 8))
  return new Uint8Array(Array.from({ length: count }, () => LF))
}

/** Coupe partielle (compatible auto-cutter TL-R120). */
export function cmdCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x41, 0x03])
}

/** Ouverture tiroir-caisse RJ11 — pulse pin 2 puis pin 5 (compatibilité clones POS). */
export function cmdOpenCashDrawer(): Uint8Array {
  return concatBytes(
    new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]),
    new Uint8Array([ESC, 0x70, 0x01, 0x19, 0xfa]),
  )
}

export function textLine(text: string, eol = true): Uint8Array {
  return concatBytes(encodeAscii(text), eol ? new Uint8Array([LF]) : new Uint8Array())
}

export function padLine(left: string, right: string, width = RECEIPT_COLS_80MM): string {
  const gap = Math.max(1, width - left.length - right.length)
  return `${left}${' '.repeat(gap)}${right}`.slice(0, width)
}

export function centerLine(text: string, width = RECEIPT_COLS_80MM): string {
  if (text.length >= width) return text.slice(0, width)
  const pad = Math.floor((width - text.length) / 2)
  return `${' '.repeat(pad)}${text}`
}

export function dashedLine(width = RECEIPT_COLS_80MM): string {
  return '-'.repeat(width)
}
