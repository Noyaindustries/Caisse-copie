import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '../ui/Button'

type Props = {
  url: string
  storeCode: string
  storeName?: string
}

export function StorefrontQrCode(props: Props) {
  return <StorefrontQrCodeContent key={props.url} {...props} />
}

function StorefrontQrCodeContent({ url, storeCode, storeName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !url) return
    let cancelled = false
    void QRCode.toCanvas(canvas, url, {
      width: 168,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError('QR code indisponible')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const handleDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = `boutique-${storeCode.replace(/\s+/g, '-')}.png`
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
        Scannez pour ouvrir le menu · {storeCode}
      </p>
    </div>
  )
}
