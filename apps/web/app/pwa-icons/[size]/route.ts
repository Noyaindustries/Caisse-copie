import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getSiteBranding } from '../../../../../server/lib/siteBranding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set([192, 512])

async function readDefaultLogo(): Promise<Buffer> {
  const candidates = [
    path.join(process.cwd(), 'public', 'branding', 'caisse-ci-logo.png'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'branding', 'caisse-ci-logo.png'),
  ]
  for (const file of candidates) {
    try {
      return await readFile(file)
    } catch {
      /* try next */
    }
  }
  throw new Error('Logo par défaut introuvable.')
}

async function resolveSourceLogo(): Promise<Buffer> {
  try {
    const branding = await getSiteBranding()
    const logo = branding.logoUrl?.trim()
    if (logo?.startsWith('data:image/')) {
      const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(
        logo,
      )
      if (match?.[1]) {
        return Buffer.from(match[1].replace(/\s/g, ''), 'base64')
      }
    }
    if (
      logo &&
      (logo.startsWith('https://') || logo.startsWith('http://localhost'))
    ) {
      const res = await fetch(logo, { cache: 'no-store' })
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer())
      }
    }
  } catch {
    /* fallback défaut */
  }
  return readDefaultLogo()
}

async function renderPwaIcon(size: number, maskable: boolean): Promise<Buffer> {
  const source = await resolveSourceLogo()
  const padRatio = maskable ? 0.18 : 0.08
  const pad = Math.round(size * padRatio)
  const inner = Math.max(1, size - pad * 2)

  const resized = await sharp(source)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 51, b: 153 },
    },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toBuffer()
}

type Ctx = { params: Promise<{ size: string }> }

export async function GET(request: Request, context: Ctx) {
  const { size: sizeRaw } = await context.params
  const size = Number.parseInt(sizeRaw, 10)
  if (!ALLOWED.has(size)) {
    return NextResponse.json({ error: 'Taille invalide.' }, { status: 400 })
  }

  const url = new URL(request.url)
  const maskable = url.searchParams.get('maskable') === '1'

  try {
    const png = await renderPwaIcon(size, maskable)
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[pwa-icon]', error)
    // Repli fichiers statiques générés au build
    const name = maskable
      ? `pwa-icon-maskable-${size}.png`
      : `pwa-icon-${size}.png`
    return NextResponse.redirect(new URL(`/branding/${name}`, request.url), 302)
  }
}
