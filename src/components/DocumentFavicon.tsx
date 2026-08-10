'use client'

import { useEffect } from 'react'
import { useSiteBranding } from '../context/SiteBrandingContext'

function guessIconType(src: string): string | undefined {
  const lower = src.split('?')[0]?.toLowerCase() ?? ''
  if (lower.startsWith('data:image/')) {
    const mime = lower.slice('data:'.length).split(';')[0]
    return mime || undefined
  }
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  return undefined
}

/**
 * Applique le logo de branding (admin) comme favicon d’onglet.
 * Les balises metadata Next restent en repli tant que le branding n’est pas chargé.
 */
export function DocumentFavicon() {
  const { logoSrc, ready } = useSiteBranding()

  useEffect(() => {
    if (!ready || !logoSrc) return

    const type = guessIconType(logoSrc)
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ]

    let updated = false
    for (const sel of selectors) {
      const nodes = document.querySelectorAll<HTMLLinkElement>(sel)
      nodes.forEach((link) => {
        link.href = logoSrc
        if (type) link.type = type
        else link.removeAttribute('type')
        updated = true
      })
    }

    if (!updated) {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = logoSrc
      if (type) link.type = type
      document.head.appendChild(link)
    }
  }, [logoSrc, ready])

  return null
}
