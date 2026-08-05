import { useCallback, useEffect, useState } from 'react'
import { BrandLogo } from '../BrandLogo'
import { BRAND_LOGO_SRC, BRAND_NAME } from '../../brand'
import { useSiteBranding } from '../../context/SiteBrandingContext'
import {
  fetchSiteBrandingAdmin,
  saveSiteBrandingAdmin,
  uploadSiteBrandingLogo,
  type SiteBrandingAdmin,
} from '../../lib/platformAdmin/api'
import type { AdminThemeClasses } from '../../lib/platformAdmin/theme'
import { Button } from '../../ui/Button'
import { Card, CardContent, CardHeader } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { cn } from '../../ui/cn'

type Props = {
  theme: AdminThemeClasses
  inputClass: string
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Lecture fichier impossible.'))
    }
    reader.onerror = () => reject(new Error('Lecture fichier impossible.'))
    reader.readAsDataURL(file)
  })
}

export function SiteBrandingAdminPanel({ theme, inputClass }: Props) {
  const { refresh: refreshPublicBranding } = useSiteBranding()
  const [status, setStatus] = useState<SiteBrandingAdmin | null>(null)
  const [brandName, setBrandName] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = useCallback((next: SiteBrandingAdmin) => {
    setStatus(next)
    setBrandName(next.brandName ?? '')
  }, [])

  const reload = useCallback(async () => {
    setLoadError(null)
    try {
      apply(await fetchSiteBrandingAdmin())
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Impossible de charger le branding.',
      )
    }
  }, [apply])

  useEffect(() => {
    void reload()
  }, [reload])

  const previewSrc = status?.logoUrl?.trim() || BRAND_LOGO_SRC

  const handleUpload = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Choisissez une image (PNG, JPEG, WebP ou GIF).')
      return
    }
    if (file.size > 500 * 1024) {
      setMessage('Image trop volumineuse (max 500 Ko).')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const next = await uploadSiteBrandingLogo(dataUrl)
      apply(next)
      await refreshPublicBranding()
      setMessage('Logo mis à jour — visible sur la page d’accueil.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveName = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await saveSiteBrandingAdmin({
        brandName: brandName.trim() || null,
      })
      apply(next)
      await refreshPublicBranding()
      setMessage('Nom de marque enregistré.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleResetLogo = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const next = await saveSiteBrandingAdmin({ logoUrl: null })
      apply(next)
      await refreshPublicBranding()
      setMessage('Logo réinitialisé (fichier par défaut).')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Réinitialisation impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {loadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {loadError}
        </p>
      ) : null}

      <Card className={theme.card}>
        <CardHeader
          title="Logo page d’accueil"
          subtitle="Remplace le logo Caisse CI sur le site marketing (/)"
        />
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <BrandLogo size="xl" src={previewSrc} alt="Aperçu logo" ring="subtle" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className={cn('text-sm', theme.muted)}>
                PNG, JPEG, WebP ou GIF · max 500 Ko.
                {status && !status.blobConfigured
                  ? ' Blob non configuré : l’image sera stockée en base (data URL).'
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="ui-btn ui-btn-secondary inline-flex cursor-pointer items-center px-3 py-2 text-sm font-semibold">
                  {busy ? 'Traitement…' : 'Choisir une image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      void handleUpload(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {status?.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleResetLogo()}
                  >
                    Réinitialiser
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <Field label="Nom affiché (optionnel)">
            <div className="flex flex-wrap gap-2">
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={BRAND_NAME}
                className={cn(inputClass, 'flex-1')}
                maxLength={80}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void handleSaveName()}
              >
                Enregistrer
              </Button>
            </div>
          </Field>

          {message ? (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-medium',
                message.toLowerCase().includes('impossible') ||
                  message.toLowerCase().includes('échoué')
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
              )}
            >
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
