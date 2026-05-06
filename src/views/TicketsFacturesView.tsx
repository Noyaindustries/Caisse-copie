import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import type {
  SaleLine,
  TicketInvoice,
  TicketInvoiceKind,
  TicketInvoiceStatus,
} from '../db/types'
import { DEFAULT_VAT_RATE_PCT, formatFCFA, totalsFromLinesTTC } from '../lib/money'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'

type Props = {
  activeStoreId: string
  activeStoreLabel: string
  actor: { id: string; displayName: string }
}

type DraftLine = {
  name: string
  qty: string
  unitPriceTTC: string
  vatRatePct: string
}

function statusTone(
  s: TicketInvoiceStatus,
): 'neutral' | 'warning' | 'success' | 'danger' {
  if (s === 'draft') return 'neutral'
  if (s === 'issued') return 'warning'
  if (s === 'paid') return 'success'
  return 'danger'
}

function statusLabel(s: TicketInvoiceStatus): string {
  if (s === 'draft') return 'Brouillon'
  if (s === 'issued') return 'Emise'
  if (s === 'paid') return 'Reglee'
  return 'Annulee'
}

function kindLabel(k: TicketInvoiceKind): string {
  return k === 'ticket' ? 'Ticket' : 'Facture'
}

function nextReference(kind: TicketInvoiceKind): string {
  const prefix = kind === 'ticket' ? 'TIC' : 'FAC'
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`
}

export function TicketsFacturesView({
  activeStoreId,
  activeStoreLabel,
  actor,
}: Props) {
  const toast = useToast()
  const rows =
    useLiveQuery(
      () => db.ticketInvoices.where('storeId').equals(activeStoreId).reverse().sortBy('createdAt'),
      [activeStoreId],
      [],
    ) ?? []

  const [kind, setKind] = useState<TicketInvoiceKind>('ticket')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | TicketInvoiceStatus>('all')
  const [lines, setLines] = useState<DraftLine[]>([
    { name: '', qty: '1', unitPriceTTC: '', vatRatePct: String(DEFAULT_VAT_RATE_PCT) },
  ])

  const normalizedLines = useMemo(() => {
    return lines
      .map((l) => {
        const qty = Number.parseInt(l.qty.trim(), 10)
        const price = Number.parseInt(l.unitPriceTTC.trim(), 10)
        const vat = Number.parseInt(l.vatRatePct.trim(), 10)
        return {
          name: l.name.trim(),
          qty: Number.isFinite(qty) ? qty : 0,
          unitPriceTTC: Number.isFinite(price) ? price : 0,
          vatRatePct: Number.isFinite(vat) ? vat : DEFAULT_VAT_RATE_PCT,
        }
      })
      .filter((l) => l.name && l.qty > 0 && l.unitPriceTTC > 0)
  }, [lines])

  const totals = useMemo(() => {
    return totalsFromLinesTTC(normalizedLines, 0)
  }, [normalizedLines])

  const visibleRows = useMemo(() => {
    if (filterStatus === 'all') return rows
    return rows.filter((r) => r.status === filterStatus)
  }, [rows, filterStatus])

  const kpis = useMemo(() => {
    const issued = rows.filter((r) => r.status === 'issued')
    const paid = rows.filter((r) => r.status === 'paid')
    return {
      issuedCount: issued.length,
      unpaidAmount: issued.reduce((s, r) => s + r.totalTTC, 0),
      paidAmount: paid.reduce((s, r) => s + r.totalTTC, 0),
    }
  }, [rows])

  const saveDraft = async () => {
    if (normalizedLines.length === 0) {
      toast.error('Aucune ligne', 'Ajoutez au moins un article valide.')
      return
    }
    const now = Date.now()
    const saleLines: SaleLine[] = normalizedLines.map((l, idx) => ({
      productId: `manual-${idx}`,
      name: l.name,
      qty: l.qty,
      unitPriceTTC: l.unitPriceTTC,
      vatRatePct: l.vatRatePct,
    }))
    const payload: TicketInvoice = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      reference: nextReference(kind),
      kind,
      status: 'draft',
      storeId: activeStoreId,
      storeName: activeStoreLabel,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
      dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).getTime() : undefined,
      currency: 'XOF',
      lines: saleLines,
      subtotalHT: totals.subtotalHT,
      tva: totals.tva,
      totalTTC: totals.totalTTC,
      createdByProfileId: actor.id,
      createdByDisplayName: actor.displayName,
    }
    await db.ticketInvoices.add(payload)
    setCustomerName('')
    setCustomerPhone('')
    setDueAt('')
    setNotes('')
    setLines([{ name: '', qty: '1', unitPriceTTC: '', vatRatePct: String(DEFAULT_VAT_RATE_PCT) }])
    toast.success(`${kindLabel(kind)} enregistre`, payload.reference)
  }

  const updateStatus = async (row: TicketInvoice, status: TicketInvoiceStatus) => {
    const patch: Partial<TicketInvoice> = { status, updatedAt: Date.now() }
    if (status === 'issued') patch.issuedAt = Date.now()
    if (status === 'paid') patch.paidAt = Date.now()
    await db.ticketInvoices.update(row.id, patch)
  }

  return (
    <div className="space-y-4 pb-6 sm:space-y-5">
      <PageHeader
        eyebrow="Facturation"
        title="Gestion des tickets et factures"
        subtitle="Creation, emission, suivi des paiements et historique."
      />

      <div className="grid gap-2.5 sm:grid-cols-3">
        <Kpi label="Documents emis" value={String(kpis.issuedCount)} tone="amber" />
        <Kpi label="Montant a encaisser" value={formatFCFA(kpis.unpaidAmount)} tone="rose" />
        <Kpi label="Montant regle" value={formatFCFA(kpis.paidAmount)} tone="accent" />
      </div>

      <Card>
        <CardContent className="grid gap-2.5 md:grid-cols-3">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as TicketInvoiceKind)}>
              <option value="ticket">Ticket</option>
              <option value="facture">Facture</option>
            </Select>
          </Field>
          <Field label="Client">
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nom client" />
          </Field>
          <Field label="Telephone">
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." />
          </Field>
          <Field label="Echeance (optionnel)">
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          <Field label="Note" className="md:col-span-2">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, details..." />
          </Field>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 md:col-span-3 md:grid-cols-12">
              <Input className="md:col-span-5" value={line.name} onChange={(e) => setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))} placeholder="Article/service" />
              <Input className="md:col-span-2" inputMode="numeric" value={line.qty} onChange={(e) => setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: e.target.value } : r)))} placeholder="Qte" />
              <Input className="md:col-span-3" inputMode="numeric" value={line.unitPriceTTC} onChange={(e) => setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, unitPriceTTC: e.target.value } : r)))} placeholder="Prix TTC" />
              <div className="flex items-stretch gap-2 md:col-span-2">
                <Input className="min-w-0 flex-1" inputMode="numeric" value={line.vatRatePct} onChange={(e) => setLines((prev) => prev.map((r, i) => (i === idx ? { ...r, vatRatePct: e.target.value } : r)))} placeholder="TVA %" />
                <Button variant="ghost" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} disabled={lines.length <= 1}>
                  -
                </Button>
              </div>
            </div>
          ))}
          <div className="md:col-span-3 flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" onClick={() => setLines((prev) => [...prev, { name: '', qty: '1', unitPriceTTC: '', vatRatePct: String(DEFAULT_VAT_RATE_PCT) }])}>
              Ajouter ligne
            </Button>
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-600">
              Total: <strong className="font-mono-nums text-zinc-900">{formatFCFA(totals.totalTTC)}</strong>
            </span>
            <Button variant="accent" className="w-full sm:w-auto" onClick={() => void saveDraft()}>
              Enregistrer brouillon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Historique</h3>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | TicketInvoiceStatus)}
              className="w-full sm:w-[200px]"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="issued">Emise</option>
              <option value="paid">Reglee</option>
              <option value="cancelled">Annulee</option>
            </Select>
          </div>
          {visibleRows.length === 0 ? (
            <EmptyState title="Aucun document" description="Creez votre premier ticket ou facture." variant="flat" />
          ) : (
            <Table minWidth={980}>
              <THead>
                <Tr hover={false}>
                  <Th>Reference</Th>
                  <Th>Type</Th>
                  <Th>Client</Th>
                  <Th align="right">Montant TTC</Th>
                  <Th>Statut</Th>
                  <Th>Date</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {visibleRows.map((row) => (
                  <Tr key={row.id}>
                    <Td mono>{row.reference}</Td>
                    <Td>{kindLabel(row.kind)}</Td>
                    <Td>{row.customerName ?? 'Client comptoir'}</Td>
                    <Td align="right" mono>{formatFCFA(row.totalTTC)}</Td>
                    <Td><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></Td>
                    <Td mono>{new Date(row.createdAt).toLocaleDateString('fr-FR')}</Td>
                    <Td align="right">
                      <div className="grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
                        {row.status === 'draft' ? (
                          <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={() => void updateStatus(row, 'issued')}>Emettre</Button>
                        ) : null}
                        {row.status !== 'paid' && row.status !== 'cancelled' ? (
                          <Button size="sm" className="w-full sm:w-auto" variant="accent" onClick={() => void updateStatus(row, 'paid')}>Reglee</Button>
                        ) : null}
                        {row.status !== 'cancelled' ? (
                          <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={() => void updateStatus(row, 'cancelled')}>Annuler</Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

