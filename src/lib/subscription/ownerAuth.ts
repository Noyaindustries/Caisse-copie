/**
 * Canonicalise l’e-mail gérant (aligné sur server/lib/ownerAuth.ts).
 * Gmail : ignore points et alias (+…) dans la partie locale.
 */
export function normalizeGmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return trimmed

  let local = trimmed.slice(0, at)
  let domain = trimmed.slice(at + 1)

  if (domain === 'googlemail.com') {
    domain = 'gmail.com'
  }

  if (domain === 'gmail.com') {
    const plus = local.indexOf('+')
    if (plus >= 0) local = local.slice(0, plus)
    local = local.replace(/\./g, '')
  }

  return `${local}@${domain}`
}

export function isGmailAddress(email: string): boolean {
  const raw = email.trim().toLowerCase()
  if (!/^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/.test(raw)) {
    return false
  }
  const normalized = normalizeGmail(email)
  return /^[a-z0-9]+@gmail\.com$/.test(normalized)
}

export function validateOwnerPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.'
  }
  if (password.length > 128) {
    return 'Le mot de passe est trop long.'
  }
  return null
}
