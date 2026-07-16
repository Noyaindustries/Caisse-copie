import { useEffect, useRef } from 'react'

/**
 * Lecteur code-barres USB en mode clavier (HID) : caractères très rapides puis Entrée (ou Tab).
 * Intercepte les frappes au niveau fenêtre lorsque le focus n’est pas dans un champ de saisie,
 * pour que le scan fonctionne même après un clic sur la grille ou un bouton.
 */
const DEFAULT_MAX_GAP_MS = 85
const MIN_BARCODE_LENGTH = 2

export function useBarcodeScannerWedge(
  enabled: boolean,
  onScan: (code: string) => void,
): void {
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const bufferRef = useRef('')
  const lastKeyAtRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const isBlockedTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      if (el.closest('[role="dialog"]')) return true
      if (el.closest('[data-barcode-input]')) return true
      if (el.closest('[data-product-search]')) return true
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true
      }
      if (el.isContentEditable) return true
      return false
    }

    const flushScan = (e: KeyboardEvent) => {
      const code = bufferRef.current.trim()
      bufferRef.current = ''
      lastKeyAtRef.current = 0
      if (code.length < MIN_BARCODE_LENGTH) return
      e.preventDefault()
      e.stopPropagation()
      onScanRef.current(code)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isBlockedTarget(e.target)) {
        bufferRef.current = ''
        return
      }

      const now = Date.now()
      if (now - lastKeyAtRef.current > DEFAULT_MAX_GAP_MS) {
        bufferRef.current = ''
      }
      lastKeyAtRef.current = now

      if (e.key === 'Enter') {
        if (bufferRef.current.trim().length >= MIN_BARCODE_LENGTH) {
          flushScan(e)
        } else {
          bufferRef.current = ''
        }
        return
      }

      if (e.key === 'Tab') {
        if (bufferRef.current.trim().length >= MIN_BARCODE_LENGTH) {
          flushScan(e)
        } else {
          bufferRef.current = ''
        }
        return
      }

      if (e.key.length === 1 && /^[0-9A-Za-z\-_.]+$/.test(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])
}
