import { useState } from 'react'
import type { Product, ProductCategory } from '../db/types'
import { PRODUCT_CATEGORY_LIST } from '../db/types'
import { DEFAULT_VAT_RATE_PCT } from '../lib/money'

const VAT_PRESETS = [0, 9, 18] as const
const MAX_IMAGE_BYTES = 500 * 1024

type Props = {
  activeStoreLabel: string
  onClose: () => void
  onSave: (product: Product, initialStock: number) => Promise<void>
}

export function AddProductModal({ activeStoreLabel, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [priceTTC, setPriceTTC] = useState('')
  const [purchasePriceTTC, setPurchasePriceTTC] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState<ProductCategory>('Autre')
  const [stock, setStock] = useState('0')
  const [lowTh, setLowTh] = useState('5')
  const [vatRatePct, setVatRatePct] = useState(String(DEFAULT_VAT_RATE_PCT))
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const price = Number.parseInt(priceTTC.replace(/\s/g, ''), 10)
    const st = Number.parseInt(stock, 10)
    const th = Number.parseInt(lowTh.replace(/\s/g, ''), 10)
    if (!name.trim()) {
      setErr('Indiquez un nom de produit.')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setErr('Prix TTC invalide (FCFA).')
      return
    }
    let purchase: number | undefined
    const purRaw = purchasePriceTTC.replace(/\s/g, '').trim()
    if (purRaw !== '') {
      purchase = Number.parseInt(purRaw, 10)
      if (!Number.isFinite(purchase) || purchase < 0) {
        setErr('Prix de revient TTC invalide.')
        return
      }
    }
    if (!barcode.trim()) {
      setErr('Indiquez un code-barres.')
      return
    }
    if (!Number.isFinite(st) || st < 0) {
      setErr('Stock invalide.')
      return
    }
    if (!Number.isFinite(th) || th < 0) {
      setErr('Seuil d’alerte invalide.')
      return
    }
    const vat = Number.parseFloat(vatRatePct.replace(',', '.'))
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setErr('TVA % invalide (0–100).')
      return
    }
    const product: Product = {
      id: crypto.randomUUID(),
      name: name.trim(),
      priceTTC: price,
      category,
      barcode: barcode.trim(),
      lowStockThreshold: th,
      vatRatePct: Math.round(vat * 100) / 100,
      archived: false,
      ...(purchase !== undefined ? { purchasePriceTTC: purchase } : {}),
      ...(imageDataUrl ? { imageDataUrl } : {}),
    }
    setBusy(true)
    try {
      await onSave(product, st)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-product-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="add-product-title"
          className="text-lg font-semibold text-slate-900"
        >
          Nouveau produit
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Réservé aux administrateurs — ajout local (IndexedDB). Stock initial
          sur <strong>{activeStoreLabel}</strong>.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Prix TTC (FCFA)
            </span>
            <input
              inputMode="numeric"
              value={priceTTC}
              onChange={(e) => setPriceTTC(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Prix de revient TTC (FCFA, optionnel — marges analytiques)
            </span>
            <input
              inputMode="numeric"
              value={purchasePriceTTC}
              onChange={(e) => setPurchasePriceTTC(e.target.value)}
              placeholder="Laisser vide si inconnu"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Code-barres
            </span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Catégorie
            </span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductCategory)
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              {PRODUCT_CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              TVA (%)
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {VAT_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVatRatePct(String(v))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    String(v) === vatRatePct.trim()
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {v} %
                </button>
              ))}
            </div>
            <input
              inputMode="decimal"
              value={vatRatePct}
              onChange={(e) => setVatRatePct(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">
              Photo (optionnel, max ~500 Ko)
            </span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-800"
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
                  const url = typeof r.result === 'string' ? r.result : undefined
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
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => setImageDataUrl(undefined)}
                >
                  Retirer l’image
                </button>
              </div>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Stock</span>
              <input
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Alerte stock
              </span>
              <input
                inputMode="numeric"
                value={lowTh}
                onChange={(e) => setLowTh(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              />
            </label>
          </div>
          {err ? (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
