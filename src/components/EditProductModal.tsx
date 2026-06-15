import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Product, ProductCategory } from '../db/types'
import { db } from '../db/db'
import { DEFAULT_VAT_RATE_PCT } from '../lib/money'
import { resolveProductImageFields, type ProductImageFields } from '../lib/uploads/blob'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { Field, Input, Select } from '../ui/Input'
import { Modal } from '../ui/Modal'

const VAT_PRESETS = [0, 9, 18] as const
const MAX_IMAGE_BYTES = 500 * 1024

type Props = {
  product: Product
  canEditPrices?: boolean
  stockAtActiveStore: number
  activeStoreLabel: string
  onClose: () => void
  onSave: (product: Product, stockAtActiveStore: number) => Promise<void>
}

export function EditProductModal({
  product,
  canEditPrices = true,
  stockAtActiveStore,
  activeStoreLabel,
  onClose,
  onSave,
}: Props) {
  const categoryRows =
    useLiveQuery(
      () => db.productCategories.orderBy('sortOrder').toArray(),
      [],
      [],
    ) ?? []
  const categoryOptions = useMemo(() => {
    const names = categoryRows.map((r) => r.name)
    const cur = product.category?.trim()
    if (cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase())) {
      return [cur, ...names]
    }
    return names
  }, [categoryRows, product.category])
  const optionsForSelect =
    categoryOptions.length > 0
      ? categoryOptions
      : product.category
        ? [product.category]
        : []

  const [name, setName] = useState(product.name)
  const [priceTTC, setPriceTTC] = useState(String(product.priceTTC))
  const [purchasePriceTTC, setPurchasePriceTTC] = useState(
    product.purchasePriceTTC != null ? String(product.purchasePriceTTC) : '',
  )
  const [barcode, setBarcode] = useState(product.barcode)
  const [category, setCategory] = useState<ProductCategory>(product.category)
  const [stock, setStock] = useState(String(stockAtActiveStore))
  const [lowTh, setLowTh] = useState(String(product.lowStockThreshold))
  const [vatRatePct, setVatRatePct] = useState(
    String(product.vatRatePct ?? DEFAULT_VAT_RATE_PCT),
  )
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    product.imageDataUrl ?? product.imageUrl,
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setName(product.name)
    setPriceTTC(String(product.priceTTC))
    setPurchasePriceTTC(
      product.purchasePriceTTC != null ? String(product.purchasePriceTTC) : '',
    )
    setBarcode(product.barcode)
    setCategory(product.category)
    setStock(String(stockAtActiveStore))
    setLowTh(String(product.lowStockThreshold))
    setVatRatePct(String(product.vatRatePct ?? DEFAULT_VAT_RATE_PCT))
    setImagePreview(product.imageDataUrl ?? product.imageUrl)
  }, [product, stockAtActiveStore])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const price = canEditPrices
      ? Number.parseInt(priceTTC.replace(/\s/g, ''), 10)
      : product.priceTTC
    const st = Number.parseInt(stock, 10)
    const th = Number.parseInt(lowTh, 10)
    if (!name.trim()) return setErr('Indiquez un nom de produit.')
    if (canEditPrices && (!Number.isFinite(price) || price < 0))
      return setErr('Prix TTC invalide.')
    let purchaseOpt: number | undefined
    if (canEditPrices) {
      const purRaw = purchasePriceTTC.replace(/\s/g, '').trim()
      if (purRaw !== '') {
        const p = Number.parseInt(purRaw, 10)
        if (!Number.isFinite(p) || p < 0)
          return setErr('Prix de revient invalide.')
        purchaseOpt = p
      }
    }
    if (!barcode.trim()) return setErr('Indiquez un code-barres.')
    if (!Number.isFinite(st) || st < 0) return setErr('Stock invalide.')
    if (!Number.isFinite(th) || th < 0) return setErr('Seuil invalide.')
    const vat = Number.parseFloat(vatRatePct.replace(',', '.'))
    if (!Number.isFinite(vat) || vat < 0 || vat > 100)
      return setErr('TVA invalide (0–100).')
    const next: Product = {
      ...product,
      name: name.trim(),
      priceTTC: canEditPrices ? price : product.priceTTC,
      category,
      barcode: barcode.trim(),
      lowStockThreshold: th,
      vatRatePct: Math.round(vat * 100) / 100,
      archived: product.archived,
    }
    if (canEditPrices) {
      if (purchaseOpt !== undefined) {
        next.purchasePriceTTC = purchaseOpt
      } else {
        delete next.purchasePriceTTC
      }
    }
    setBusy(true)
    try {
      let imageFields: ProductImageFields = {}
      if (imagePreview) {
        if (imagePreview.startsWith('data:')) {
          imageFields = await resolveProductImageFields(product.id, imagePreview)
        } else if (imagePreview === product.imageUrl && product.imageUrl) {
          imageFields = { imageUrl: product.imageUrl }
        } else if (imagePreview === product.imageDataUrl && product.imageDataUrl) {
          imageFields = { imageDataUrl: product.imageDataUrl }
        } else {
          imageFields = { imageUrl: imagePreview }
        }
      }
      delete next.imageDataUrl
      delete next.imageUrl
      Object.assign(next, imageFields)
      await onSave(next, st)
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
      title="Modifier l’article"
      subtitle={`Stock affiché pour ${activeStoreLabel}`}
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
            Mettre à jour
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prix TTC (FCFA)">
            <Input
              inputMode="numeric"
              value={priceTTC}
              onChange={(e) => setPriceTTC(e.target.value)}
              readOnly={!canEditPrices}
              disabled={!canEditPrices}
              className="font-mono-nums"
            />
          </Field>
          <Field label="Prix de revient TTC" hint="optionnel">
            <Input
              inputMode="numeric"
              value={purchasePriceTTC}
              onChange={(e) => setPurchasePriceTTC(e.target.value)}
              readOnly={!canEditPrices}
              disabled={!canEditPrices}
              placeholder="—"
              className="font-mono-nums"
            />
          </Field>
        </div>
        <Field label="Code-barres" required>
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="font-mono-nums"
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
              {optionsForSelect.map((c) => (
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
        <Field label="Photo" hint="Max 500 Ko · Vercel Blob si configuré">
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
                setImagePreview(url)
              }
              r.readAsDataURL(f)
            }}
          />
          {imagePreview ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={imagePreview}
                alt=""
                className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImagePreview(undefined)}
              >
                Retirer
              </Button>
            </div>
          ) : null}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock (ce magasin)" required>
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
