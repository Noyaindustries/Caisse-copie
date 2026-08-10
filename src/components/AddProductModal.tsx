import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Product, ProductCategory } from '../db/types'
import { db } from '../db/db'
import { getAppSettings } from '../lib/appSettings'
import { resolveProductImageFields } from '../lib/uploads/blob'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Field, Input, Select } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'

const VAT_PRESETS = [0, 9, 18] as const
const MAX_IMAGE_BYTES = 500 * 1024

type Props = {
  activeStoreLabel: string
  onClose: () => void
  onSave: (product: Product, initialStock: number) => Promise<void>
}

export function AddProductModal({ activeStoreLabel, onClose, onSave }: Props) {
  const toast = useToast()
  const categoryRows =
    useLiveQuery(
      () => db.productCategories.orderBy('sortOrder').toArray(),
      [],
      [],
    ) ?? []
  const categoryOptions = useMemo(
    () => categoryRows.map((r) => r.name),
    [categoryRows],
  )
  const [name, setName] = useState('')
  const [priceTTC, setPriceTTC] = useState('')
  const [purchasePriceTTC, setPurchasePriceTTC] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState<ProductCategory>('Autre')
  const [stock, setStock] = useState('0')
  const [lowTh, setLowTh] = useState('5')
  const [vatRatePct, setVatRatePct] = useState(() =>
    String(getAppSettings().defaultVatRatePct),
  )
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (categoryOptions.length === 0) return
    if (
      !categoryOptions.some((n) => n.toLowerCase() === category.toLowerCase())
    ) {
      setCategory(
        categoryOptions.includes('Autre')
          ? 'Autre'
          : (categoryOptions[0] ?? 'Autre'),
      )
    }
  }, [categoryOptions, category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const price = Number.parseInt(priceTTC.replace(/\s/g, ''), 10)
    const st = Number.parseInt(stock, 10)
    const th = Number.parseInt(lowTh.replace(/\s/g, ''), 10)
    if (!name.trim()) return setErr('Indiquez un nom de produit.')
    if (!Number.isFinite(price) || price < 0) return setErr('Prix TTC invalide.')
    let purchase: number | undefined
    const purRaw = purchasePriceTTC.replace(/\s/g, '').trim()
    if (purRaw !== '') {
      purchase = Number.parseInt(purRaw, 10)
      if (!Number.isFinite(purchase) || purchase < 0)
        return setErr('Prix de revient invalide.')
    }
    if (!Number.isFinite(st) || st < 0) return setErr('Stock invalide.')
    if (!Number.isFinite(th) || th < 0) return setErr('Seuil invalide.')
    const vat = Number.parseFloat(vatRatePct.replace(',', '.'))
    if (!Number.isFinite(vat) || vat < 0 || vat > 100)
      return setErr('TVA invalide (0–100).')
    const productId = crypto.randomUUID()
    setBusy(true)
    try {
      const imageFields = await resolveProductImageFields(productId, imageDataUrl)
      const product: Product = {
        id: productId,
        name: name.trim(),
        priceTTC: price,
        category,
        barcode: barcode.trim(),
        lowStockThreshold: th,
        vatRatePct: Math.round(vat * 100) / 100,
        archived: false,
        ...(purchase !== undefined ? { purchasePriceTTC: purchase } : {}),
        ...imageFields,
      }
      await onSave(product, st)
      toast.success('Article créé', product.name)
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau produit"
      subtitle={`Stock initial sur ${activeStoreLabel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="accent"
            loading={busy}
            onClick={(e) =>
              handleSubmit(e as unknown as React.FormEvent)
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Bissap maison"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prix TTC (FCFA)" required>
            <Input
              inputMode="numeric"
              value={priceTTC}
              onChange={(e) => setPriceTTC(e.target.value)}
              className="font-mono-nums"
            />
          </Field>
          <Field
            label="Prix de revient TTC"
            hint="optionnel"
          >
            <Input
              inputMode="numeric"
              value={purchasePriceTTC}
              onChange={(e) => setPurchasePriceTTC(e.target.value)}
              placeholder="—"
              className="font-mono-nums"
            />
          </Field>
        </div>
        <Field label="Code-barres" hint="Optionnel — laissez vide si aucun">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scanner ou saisir (facultatif)"
            className="font-mono-nums"
            data-barcode-input
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Catégorie" required>
            <Select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductCategory)
              }
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="TVA (%)" required>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {VAT_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVatRatePct(String(v))}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-[12px] font-semibold transition',
                      String(v) === vatRatePct.trim()
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
                    )}
                  >
                    {v} %
                  </button>
                ))}
              </div>
              <Input
                inputMode="decimal"
                value={vatRatePct}
                onChange={(e) => setVatRatePct(e.target.value)}
                className="font-mono-nums"
              />
            </div>
          </Field>
        </div>
        <Field label="Photo" hint="Optionnel · max 500 Ko · stockée sur Vercel Blob si configuré">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-[12px] text-zinc-600 file:mr-2 file:rounded-md file:border file:border-zinc-200 file:bg-zinc-50 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-zinc-700"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > MAX_IMAGE_BYTES) {
                setErr('Image trop volumineuse (max 500 Ko).')
                e.target.value = ''
                return
              }
              setErr(null)
              const r = new FileReader()
              r.onload = () => {
                const url =
                  typeof r.result === 'string' ? r.result : undefined
                setImageDataUrl(url)
              }
              r.readAsDataURL(f)
            }}
          />
          {imageDataUrl ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={imageDataUrl}
                alt=""
                className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImageDataUrl(undefined)}
              >
                Retirer
              </Button>
            </div>
          ) : null}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock initial" required>
            <Input
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="font-mono-nums"
            />
          </Field>
          <Field label="Alerte stock" required>
            <Input
              inputMode="numeric"
              value={lowTh}
              onChange={(e) => setLowTh(e.target.value)}
              className="font-mono-nums"
            />
          </Field>
        </div>
        {err ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
            {err}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
