import { useCallback, useMemo, useState } from 'react'
import type { Sale } from '../db/types'
import { formatFCFA } from '../lib/money'
import {
  computeRefundFromLineQty,
  lineRefundAmountTTC,
  refundableQty,
  saleNetTTC,
  saleFullyRefunded,
} from '../lib/refundMath'
import type { LineRefundQtyMap } from '../lib/refundMath'
import { applySaleRefund } from '../lib/refundApply'

type Props = {
  sale: Sale
  actor: { profileId: string; displayName: string }
  onClose: () => void
  onDone: () => void
}

export function RefundSaleModal({ sale, actor, onClose, onDone }: Props) {
  const [qtyByProduct, setQtyByProduct] = useState<LineRefundQtyMap>({})
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const initFullRefund = useCallback(() => {
    const next: LineRefundQtyMap = {}
    for (const line of sale.lines) {
      const max = refundableQty(line, sale)
      if (max > 0) next[line.productId] = max
    }
    setQtyByProduct(next)
  }, [sale])

  const preview = useMemo(
    () => computeRefundFromLineQty(sale, qtyByProduct),
    [sale, qtyByProduct],
  )

  const netAfter = preview.ok
    ? Math.max(0, saleNetTTC(sale) - preview.amountTTC)
    : saleNetTTC(sale)

  const submit = useCallback(async () => {
    const r = reason.trim()
    if (r.length < 3) {
      window.alert('Indiquez un motif (au moins 3 caractères).')
      return
    }
    const computed = computeRefundFromLineQty(sale, qtyByProduct)
    if (!computed.ok) {
      window.alert(computed.message)
      return
    }
    if (
      !window.confirm(
        `Confirmer le remboursement de ${formatFCFA(computed.amountTTC)} ?\n\nMotif : ${r}`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await applySaleRefund({
        saleId: sale.id,
        lineQty: qtyByProduct,
        reason: r,
        actor: {
          profileId: actor.profileId,
          displayName: actor.displayName,
        },
      })
      onDone()
      onClose()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [actor, onClose, onDone, qtyByProduct, reason, sale])

  if (saleFullyRefunded(sale)) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 id="refund-title" className="font-semibold text-slate-900">
            Remboursement
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cette vente est entièrement remboursée.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="refund-title" className="text-sm font-semibold text-slate-900">
            Remboursement (partiel ou total)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Ticket {sale.id.slice(0, 8).toUpperCase()} · Net actuel{' '}
            {formatFCFA(saleNetTTC(sale))} / {formatFCFA(sale.totalTTC)} TTC
          </p>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={initFullRefund}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              Tout rembourser (quantités max)
            </button>
            <button
              type="button"
              onClick={() => setQtyByProduct({})}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Réinitialiser les quantités
            </button>
          </div>

          <ul className="space-y-3 text-sm">
            {sale.lines.map((line) => {
              const max = refundableQty(line, sale)
              const q = Math.floor(qtyByProduct[line.productId] ?? 0)
              const previewLine =
                q > 0
                  ? lineRefundAmountTTC(line, q, sale.discountPct)
                  : 0
              return (
                <li
                  key={line.productId}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {line.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      vendu {line.qty} · max à rembourser {max}
                    </span>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    Qté à rembourser
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={qtyByProduct[line.productId] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setQtyByProduct((prev) => ({
                          ...prev,
                          [line.productId]:
                            v === '' ? 0 : Math.min(max, Math.max(0, Number.parseInt(v, 10) || 0)),
                        }))
                      }}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono-nums"
                    />
                    {previewLine > 0 ? (
                      <span className="font-mono-nums text-slate-700">
                        → {formatFCFA(previewLine)}
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>

          <label className="block text-xs font-medium text-slate-700">
            Motif (obligatoire, audit)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ex. produit défectueux, erreur de caisse, demande client…"
            />
          </label>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">
              Montant du remboursement :{' '}
              <span className="font-mono-nums font-bold text-slate-900">
                {preview.ok ? formatFCFA(preview.amountTTC) : '—'}
              </span>
            </p>
            {preview.ok ? (
              <p className="mt-1 text-xs text-slate-500">
                CA net ticket après opération : {formatFCFA(netAfter)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-800">{preview.message}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={busy || !preview.ok}
              onClick={() => void submit()}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Enregistrement…' : 'Valider le remboursement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
