export function normalizeGmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isGmailAddress(email: string): boolean {
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(normalizeGmail(email))
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
