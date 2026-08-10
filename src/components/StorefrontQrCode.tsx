import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  getCachedOrgWorkspaceBranding,
  ORG_BRANDING_CHANGED_EVENT,
  resolveOrgWorkspaceBranding,
} from '../lib/orgWorkspaceBranding'
import { Button } from '../ui/Button'

type Props = {
  url: string
  storeCode: string
  storeName?: string
  /** Logo entreprise (sinon branding boutique en cache). */
  logoUrl?: string | null
}

const PREVIEW_SIZE = 168
const DOWNLOAD_SIZE = 1024
const LOGO_RATIO = 0.22

export function StorefrontQrCode(props: Props) {
  return (
    <StorefrontQrCodeContent
      key={`${props.url}:${props.logoUrl ?? ''}`}
      {...props}
    />
  )
}

function loadLogoImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Logo introuvable'))
    img.src = src
  })
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function paintQrOnCanvas(
  canvas: HTMLCanvasElement,
  url: string,
  size: number,
  logoSrc: string | null | undefined,
): Promise<void> {
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  const trimmed = logoSrc?.trim()
  if (!trimmed) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  try {
    const img = await loadLogoImage(trimmed)
    const logoSize = Math.round(size * LOGO_RATIO)
    const pad = Math.max(4, Math.round(logoSize * 0.14))
    const box = logoSize + pad * 2
    const x = (canvas.width - box) / 2
    const y = (canvas.height - box) / 2

    ctx.fillStyle = '#ffffff'
    drawRoundedRect(ctx, x, y, box, box, Math.max(6, Math.round(box * 0.16)))
    ctx.fill()

    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    if (iw <= 0 || ih <= 0) return
    const scale = Math.min(logoSize / iw, logoSize / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = x + pad + (logoSize - dw) / 2
    const dy = y + pad + (logoSize - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
  } catch {
    /* QR sans logo si chargement / CORS échoue */
  }
}

function StorefrontQrCodeContent({
  url,
  storeCode,
  storeName,
  logoUrl: logoUrlProp,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(
    () => logoUrlProp?.trim() || getCachedOrgWorkspaceBranding().logoUrl,
  )

  useEffect(() => {
    if (logoUrlProp !== undefined) {
      setResolvedLogoUrl(logoUrlProp?.trim() || null)
      return
    }
    const sync = () => {
      setResolvedLogoUrl(getCachedOrgWorkspaceBranding().logoUrl)
    }
    sync()
    void resolveOrgWorkspaceBranding().then((b) => {
      setResolvedLogoUrl(b.logoUrl)
    })
    window.addEventListener(ORG_BRANDING_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener(ORG_BRANDING_CHANGED_EVENT, sync)
    }
  }, [logoUrlProp])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !url) return
    let cancelled = false
    setReady(false)
    setError(null)
    void paintQrOnCanvas(canvas, url, PREVIEW_SIZE, resolvedLogoUrl)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError('QR code indisponible')
      })
    return () => {
      cancelled = true
    }
  }, [url, resolvedLogoUrl])

  const handleDownload = async () => {
    try {
      const canvas = document.createElement('canvas')
      await paintQrOnCanvas(canvas, url, DOWNLOAD_SIZE, resolvedLogoUrl)
      const dataUrl = canvas.toDataURL('image/png')
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = `boutique-${(storeName ?? storeCode)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || storeCode}.png`
      anchor.click()
    } catch {
      setError('Téléchargement impossible')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white p-3 shadow-sm">
      <canvas
        ref={canvasRef}
        className="rounded-xl"
        aria-label={`QR code boutique ${storeName ?? storeCode}`}
      />
      {!ready && !error ? (
        <p className="text-[10px] text-slate-500">Génération…</p>
      ) : null}
      {error ? <p className="text-[10px] text-rose-600">{error}</p> : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!ready}
        onClick={() => void handleDownload()}
      >
        Télécharger PNG
      </Button>
      <p className="max-w-[168px] text-center text-[10px] leading-snug text-slate-500">
        Scannez pour ouvrir le menu
        {storeName ? ` · ${storeName}` : ` · ${storeCode}`}
      </p>
    </div>
  )
}
