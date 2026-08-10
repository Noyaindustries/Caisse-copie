import { useEffect, useState } from 'react'
import {
  fetchStorefrontBranding,
  patchStorefrontBranding,
} from '../../lib/storefront/api'
import type { StorefrontBranding } from '../../lib/storefront/types'
import {
  DEFAULT_STOREFRONT_DELIVERY_FEE_TTC,
  DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC,
  MAX_STOREFRONT_DELIVERY_FEE_TTC,
  MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC,
} from '../../lib/storefront/types'
import { cacheOrgWorkspaceBranding } from '../../lib/orgWorkspaceBranding'
import { storefrontDisplayName } from '../../lib/storefront/types'
import { hasOrgAuth } from '../../lib/subscription/authHeaders'
import {
  isBlobUploadAvailable,
  uploadOrgAssetToBlob,
} from '../../lib/uploads/blob'
import { Button } from '../../ui/Button'
import { Field, Input, Textarea } from '../../ui/Input'
import { useToast } from '../../ui/Toast'
import { cn } from '../../ui/cn'

function normalizeHexColor(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const upper = withHash.toUpperCase()
  return /^#[0-9A-F]{6}$/.test(upper) ? upper : undefined
}

type Props = {
  boutiqueLink: string | null
  online: boolean
  usable: boolean
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Lecture image impossible.'))
    }
    reader.onerror = () => reject(new Error('Lecture image impossible.'))
    reader.readAsDataURL(file)
  })
}

export function StorefrontBrandingSection({
  boutiqueLink,
  online,
  usable,
}: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shopName, setShopName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#B8922E')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [storeNameHint, setStoreNameHint] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [openingHours, setOpeningHours] = useState('')
  const [footerTagline, setFooterTagline] = useState('')
  const [legalMentions, setLegalMentions] = useState('')
  const [deliveryFeeTTC, setDeliveryFeeTTC] = useState(
    String(DEFAULT_STOREFRONT_DELIVERY_FEE_TTC),
  )
  const [freeDeliveryThresholdTTC, setFreeDeliveryThresholdTTC] = useState(
    String(DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC),
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!online || !usable || !hasOrgAuth()) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await fetchStorefrontBranding()
        if (cancelled) return
        setShopName(data.branding.shopName ?? '')
        setPrimaryColor(data.branding.primaryColor ?? '#B8922E')
        setWelcomeMessage(data.branding.welcomeMessage ?? '')
        setLogoUrl(data.branding.logoUrl ?? '')
        setBannerUrl(data.branding.bannerUrl ?? '')
        setPhone(data.branding.phone ?? '')
        setWhatsapp(data.branding.whatsapp ?? '')
        setEmail(data.branding.email ?? '')
        setAddress(data.branding.address ?? '')
        setMapsUrl(data.branding.mapsUrl ?? '')
        setOpeningHours(data.branding.openingHours ?? '')
        setFooterTagline(data.branding.footerTagline ?? '')
        setLegalMentions(data.branding.legalMentions ?? '')
        setDeliveryFeeTTC(
          String(
            data.branding.deliveryFeeTTC ?? DEFAULT_STOREFRONT_DELIVERY_FEE_TTC,
          ),
        )
        setFreeDeliveryThresholdTTC(
          String(
            data.branding.freeDeliveryThresholdTTC ??
              DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC,
          ),
        )
        setStoreNameHint(data.storeName)
        const displayName = storefrontDisplayName(
          data.branding,
          data.storeName,
          '',
        )
        cacheOrgWorkspaceBranding({
          logoUrl: data.branding.logoUrl,
          displayName: displayName || data.storeName,
        })
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : 'Impossible de charger l’apparence boutique.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [online, usable, toast])

  const resolveAssetUrl = async (
    kind: 'logo' | 'banner',
    dataUrl: string,
  ): Promise<string> => {
    if (await isBlobUploadAvailable()) {
      try {
        return await uploadOrgAssetToBlob(kind, dataUrl)
      } catch {
        /* fallback data URL */
      }
    }
    return dataUrl
  }

  const onPickImage = async (
    kind: 'logo' | 'banner',
    file: File | null,
  ) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image (JPEG, PNG, WebP ou GIF).')
      return
    }
    if (file.size > 500 * 1024) {
      toast.error('Image trop volumineuse (max 500 Ko).')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      const url = await resolveAssetUrl(kind, dataUrl)
      if (kind === 'logo') setLogoUrl(url)
      else setBannerUrl(url)
      toast.success(kind === 'logo' ? 'Logo prêt.' : 'Bannière prête.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload impossible.')
    }
  }

  const handleSave = async () => {
    if (!online || !usable) {
      toast.error('Connexion et abonnement actifs requis.')
      return
    }
    const color = normalizeHexColor(primaryColor)
    if (primaryColor.trim() && !color) {
      toast.error('Couleur hex invalide (ex. #B8922E).')
      return
    }
    const feeParsed = Math.round(
      Number(deliveryFeeTTC.trim().replace(/\s/g, '')),
    )
    const thresholdParsed = Math.round(
      Number(freeDeliveryThresholdTTC.trim().replace(/\s/g, '')),
    )
    if (
      !Number.isFinite(feeParsed) ||
      feeParsed < 0 ||
      feeParsed > MAX_STOREFRONT_DELIVERY_FEE_TTC
    ) {
      toast.error(
        `Frais de livraison invalide (0 – ${MAX_STOREFRONT_DELIVERY_FEE_TTC.toLocaleString('fr-FR')} FCFA).`,
      )
      return
    }
    if (
      !Number.isFinite(thresholdParsed) ||
      thresholdParsed < 0 ||
      thresholdParsed > MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC
    ) {
      toast.error(
        `Seuil livraison offerte invalide (0 – ${MAX_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC.toLocaleString('fr-FR')} FCFA).`,
      )
      return
    }
    setSaving(true)
    try {
      const branding: StorefrontBranding = {
        shopName: shopName.trim() || undefined,
        primaryColor: color,
        welcomeMessage: welcomeMessage.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        mapsUrl: mapsUrl.trim() || undefined,
        openingHours: openingHours.trim() || undefined,
        footerTagline: footerTagline.trim() || undefined,
        legalMentions: legalMentions.trim() || undefined,
        deliveryFeeTTC: feeParsed,
        freeDeliveryThresholdTTC: thresholdParsed,
      }
      await patchStorefrontBranding(branding)
      const displayName = storefrontDisplayName(
        branding,
        storeNameHint,
        '',
      )
      cacheOrgWorkspaceBranding({
        logoUrl: branding.logoUrl,
        displayName: displayName || storeNameHint || branding.shopName,
      })
      if (color) setPrimaryColor(color)
      toast.success('Apparence boutique enregistrée.')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Enregistrement impossible.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      id="sub-appearance"
      className="scroll-mt-28 rounded-2xl border border-border bg-white/90 p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Apparence boutique</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Personnalisez la vitrine publique vue par vos clients
            {storeNameHint ? ` (${storeNameHint})` : ''}.
          </p>
        </div>
        {boutiqueLink ? (
          <a
            href={boutiqueLink}
            target="_blank"
            rel="noreferrer"
            className="ui-btn ui-btn-secondary shrink-0 text-sm"
          >
            Voir ma boutique
          </a>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-ink-subtle">Chargement…</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom boutique (vitrine)">
            <Input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder={storeNameHint || 'Ma boutique'}
              maxLength={120}
              disabled={!online || !usable}
            />
          </Field>
          <Field label="Couleur d’accent">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#B8922E'}
                onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-white p-1"
                disabled={!online || !usable}
                aria-label="Choisir la couleur"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#B8922E"
                maxLength={7}
                className="font-mono-nums"
                disabled={!online || !usable}
              />
            </div>
          </Field>
          <Field label="Logo">
            <div className="flex flex-wrap items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo boutique"
                  className="h-14 w-14 rounded-full border border-border object-contain bg-white"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-ink-subtle">
                  Logo
                </div>
              )}
              <label
                className={cn(
                  'ui-btn ui-btn-secondary cursor-pointer text-sm',
                  (!online || !usable) && 'pointer-events-none opacity-50',
                )}
              >
                Choisir
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={!online || !usable}
                  onChange={(e) => {
                    void onPickImage('logo', e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </label>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!online || !usable}
                  onClick={() => setLogoUrl('')}
                >
                  Retirer
                </Button>
              ) : null}
            </div>
          </Field>
          <Field label="Bannière">
            <div className="space-y-2">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Bannière boutique"
                  className="h-24 w-full rounded-xl border border-border object-cover"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <label
                  className={cn(
                    'ui-btn ui-btn-secondary cursor-pointer text-sm',
                    (!online || !usable) && 'pointer-events-none opacity-50',
                  )}
                >
                  Choisir
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={!online || !usable}
                    onChange={(e) => {
                      void onPickImage('banner', e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {bannerUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!online || !usable}
                    onClick={() => setBannerUrl('')}
                  >
                    Retirer
                  </Button>
                ) : null}
              </div>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Message d’accueil">
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Bienvenue ! Commandez en ligne et retirez en magasin."
                maxLength={500}
                rows={3}
                disabled={!online || !usable}
              />
            </Field>
          </div>

          <div className="sm:col-span-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-ink">
              Contact & pied de page
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Affichés sur la vitrine publique. Laissez vide pour masquer un
              bloc.
            </p>
          </div>

          <Field label="Téléphone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              maxLength={40}
              disabled={!online || !usable}
            />
          </Field>
          <Field label="WhatsApp" hint="Optionnel — sinon dérivé du téléphone">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              maxLength={40}
              disabled={!online || !usable}
            />
          </Field>
          <Field label="Email de contact">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@votre-boutique.com"
              maxLength={160}
              disabled={!online || !usable}
            />
          </Field>
          <Field label="Adresse">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Cocody, Abidjan"
              maxLength={300}
              disabled={!online || !usable}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Lien Google Maps"
              hint="Optionnel — sinon construit depuis l’adresse"
            >
              <Input
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=…"
                maxLength={500}
                disabled={!online || !usable}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Horaires d’ouverture">
              <Textarea
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder={
                  'Lun–Ven : 8h–20h\nSam : 9h–21h\nDimanche : fermé'
                }
                maxLength={1000}
                rows={3}
                disabled={!online || !usable}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Accroche pied de page">
              <Input
                value={footerTagline}
                onChange={(e) => setFooterTagline(e.target.value)}
                placeholder="Commande en ligne, retrait en magasin."
                maxLength={200}
                disabled={!online || !usable}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Mentions légales / infos footer">
              <Textarea
                value={legalMentions}
                onChange={(e) => setLegalMentions(e.target.value)}
                placeholder="RCCM, NIF, CGV…"
                maxLength={1000}
                rows={3}
                disabled={!online || !usable}
              />
            </Field>
          </div>

          <div className="sm:col-span-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-ink">Livraison</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Tarifs appliqués sur la boutique en ligne. Seuil à 0 = jamais de
              livraison offerte.
            </p>
          </div>

          <Field label="Frais de livraison (FCFA TTC)">
            <Input
              inputMode="numeric"
              value={deliveryFeeTTC}
              onChange={(e) => setDeliveryFeeTTC(e.target.value)}
              placeholder={String(DEFAULT_STOREFRONT_DELIVERY_FEE_TTC)}
              disabled={!online || !usable}
            />
          </Field>
          <Field
            label="Livraison offerte dès (FCFA)"
            hint="0 = désactiver l’offre"
          >
            <Input
              inputMode="numeric"
              value={freeDeliveryThresholdTTC}
              onChange={(e) => setFreeDeliveryThresholdTTC(e.target.value)}
              placeholder={String(DEFAULT_STOREFRONT_FREE_DELIVERY_THRESHOLD_TTC)}
              disabled={!online || !usable}
            />
          </Field>

          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="primary"
              disabled={!online || !usable || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer l’apparence'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
