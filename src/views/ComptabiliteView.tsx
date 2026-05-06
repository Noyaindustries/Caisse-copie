import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Sale } from '../db/types'
import { downloadTextFile, toCsvSemicolon } from '../lib/analyticsExport'
import { formatFCFA } from '../lib/money'
import { salePaymentAmounts } from '../lib/paymentDisplay'
import { saleNetTTC } from '../lib/refundMath'
import { saleLocalYmd } from '../lib/salesStats'
import { isComptaModuleDemoOn } from '../lib/integrationsConfig'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader, SectionHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { useToast } from '../ui/Toast'
import { IconDownload, IconSpreadsheet } from '../ui/icons'

type Props = {
  canManageCompta: boolean
}

function localYmdNow(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthStartYmdNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function startMsFromYmd(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function endMsFromYmd(ymd: string): number | null {
  const start = startMsFromYmd(ymd)
  if (start == null) return null
  return start + 24 * 60 * 60 * 1000 - 1
}

export function ComptabiliteView({ canManageCompta }: Props) {
  const toast = useToast()
  const [fromYmd, setFromYmd] = useState(() => monthStartYmdNow())
  const [toYmd, setToYmd] = useState(() => localYmdNow())
  const [storeFilter, setStoreFilter] = useState<string>('all')

  const stores = useLiveQuery(() => db.stores.orderBy('sortOrder').toArray(), [], []) ?? []
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? []
  const comptaEnabled = isComptaModuleDemoOn()

  const filteredSales = useMemo(() => {
    const fromMs = startMsFromYmd(fromYmd)
    const toMs = endMsFromYmd(toYmd)
    if (fromMs == null || toMs == null || fromMs > toMs) return [] as Sale[]
    return sales.filter((s) => {
      if (s.createdAt < fromMs || s.createdAt > toMs) return false
      if (storeFilter === 'all') return true
      return s.storeId === storeFilter
    })
  }, [sales, fromYmd, toYmd, storeFilter])

  const metrics = useMemo(() => {
    let netTTC = 0
    let grossTTC = 0
    let tva = 0
    let ht = 0
    let cash = 0
    let bank = 0
    for (const s of filteredSales) {
      const net = saleNetTTC(s)
      if (net <= 0) continue
      const ratio = s.totalTTC > 0 ? net / s.totalTTC : 0
      netTTC += net
      grossTTC += s.totalTTC
      tva += Math.round(s.tva * ratio)
      ht += Math.round(s.subtotalHT * ratio)
      const p = salePaymentAmounts(s)
      cash += Math.round(p.cash * ratio)
      bank += Math.round((p.card + p.mobile) * ratio)
    }
    const refundsTTC = Math.max(0, grossTTC - netTTC)
    return {
      tickets: filteredSales.length,
      netTTC,
      ht,
      tva,
      cash,
      bank,
      refundsTTC,
    }
  }, [filteredSales])

  const dailyRows = useMemo(() => {
    const map = new Map<
      string,
      { ymd: string; tickets: number; ht: number; tva: number; ttc: number }
    >()
    for (const s of filteredSales) {
      const ymd = saleLocalYmd(s.createdAt)
      const net = saleNetTTC(s)
      if (net <= 0) continue
      const ratio = s.totalTTC > 0 ? net / s.totalTTC : 0
      const row = map.get(ymd) ?? { ymd, tickets: 0, ht: 0, tva: 0, ttc: 0 }
      row.tickets += 1
      row.ttc += net
      row.ht += Math.round(s.subtotalHT * ratio)
      row.tva += Math.round(s.tva * ratio)
      map.set(ymd, row)
    }
    return [...map.values()].sort((a, b) => (a.ymd < b.ymd ? 1 : -1))
  }, [filteredSales])

  const accountingEntries = useMemo(
    () => [
      { account: '57', label: 'Caisse (Débit)', amount: metrics.cash },
      { account: '512', label: 'Banque / Mobile (Débit)', amount: metrics.bank },
      { account: '707', label: 'Ventes marchandises (Crédit)', amount: metrics.ht },
      { account: '4457', label: 'TVA collectée (Crédit)', amount: metrics.tva },
    ],
    [metrics],
  )

  const exportAccountingCsv = useCallback(() => {
    const rows: string[][] = [
      ['Export comptable Infinitecore Système'],
      ['Période', `${fromYmd} -> ${toYmd}`],
      ['Magasin', storeFilter === 'all' ? 'Tous' : (stores.find((s) => s.id === storeFilter)?.name ?? storeFilter)],
      [],
      ['Compte', 'Libellé', 'Sens', 'Montant FCFA'],
      ['57', 'Caisse', 'Débit', String(metrics.cash)],
      ['512', 'Banque / Mobile', 'Débit', String(metrics.bank)],
      ['707', 'Ventes marchandises', 'Crédit', String(metrics.ht)],
      ['4457', 'TVA collectée', 'Crédit', String(metrics.tva)],
      [],
      ['Date', 'Tickets', 'HT', 'TVA', 'TTC Net'],
      ...dailyRows.map((r) => [r.ymd, String(r.tickets), String(r.ht), String(r.tva), String(r.ttc)]),
    ]
    downloadTextFile(`comptabilite-${fromYmd}-${toYmd}.csv`, toCsvSemicolon(rows))
    toast.success('Export comptable généré')
  }, [fromYmd, toYmd, storeFilter, stores, metrics.cash, metrics.bank, metrics.ht, metrics.tva, dailyRows, toast])

  return (
    <div className="space-y-4 pb-6 sm:space-y-5">
      <PageHeader
        eyebrow="Finance"
        title="Comptabilité"
        subtitle="Ventilation HT/TVA, synthèse des écritures et export comptable"
        actions={
          <Button
            variant="secondary"
            iconLeft={<IconDownload />}
            onClick={exportAccountingCsv}
            className="w-full sm:w-auto"
          >
            Export comptable
          </Button>
        }
      />

      {!comptaEnabled ? (
        <Card className="rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
          <CardContent className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <IconSpreadsheet className="h-4 w-4" />
            </span>
            <div className="text-[12px] text-zinc-700">
              Module comptabilité non activé dans les intégrations. La vue reste disponible pour consultation locale.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
        <CardContent>
          <SectionHeader title="Filtres" />
          <div className="grid gap-2.5 md:grid-cols-3">
            <Field label="Du">
              <Input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} />
            </Field>
            <Field label="Au">
              <Input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} />
            </Field>
            <Field label="Magasin">
              <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                <option value="all">Tous</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="CA net TTC" value={formatFCFA(metrics.netTTC)} tone="accent" />
        <Kpi label="Base HT" value={formatFCFA(metrics.ht)} tone="neutral" />
        <Kpi label="TVA collectée" value={formatFCFA(metrics.tva)} tone="violet" />
        <Kpi label="Remboursements TTC" value={formatFCFA(metrics.refundsTTC)} tone="amber" />
      </div>

      <Card className="rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
        <CardContent>
          <SectionHeader title="Écritures comptables (synthèse)" />
          <Table minWidth={620}>
            <THead>
              <Tr hover={false}>
                <Th>Compte</Th>
                <Th>Libellé</Th>
                <Th align="right">Montant</Th>
              </Tr>
            </THead>
            <TBody>
              {accountingEntries.map((entry) => (
                <Tr key={entry.account}>
                  <Td mono>{entry.account}</Td>
                  <Td>{entry.label}</Td>
                  <Td align="right" mono className="font-semibold">
                    {formatFCFA(entry.amount)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {!canManageCompta ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              Profil lecture seule: export disponible, paramétrage comptable réservé au gérant/admin.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
        <CardContent>
          <SectionHeader
            title="Journal quotidien comptable"
            subtitle="Agrégation journalière des ventes nettes"
            actions={<Badge tone="info">{metrics.tickets} ticket(s)</Badge>}
          />
          {dailyRows.length === 0 ? (
            <EmptyState title="Aucune donnée sur la période" variant="flat" />
          ) : (
            <Table minWidth={700}>
              <THead>
                <Tr hover={false}>
                  <Th>Date</Th>
                  <Th align="right">Tickets</Th>
                  <Th align="right">HT</Th>
                  <Th align="right">TVA</Th>
                  <Th align="right">TTC net</Th>
                </Tr>
              </THead>
              <TBody>
                {dailyRows.map((r) => (
                  <Tr key={r.ymd}>
                    <Td mono>{r.ymd}</Td>
                    <Td align="right" mono>{r.tickets}</Td>
                    <Td align="right" mono>{formatFCFA(r.ht)}</Td>
                    <Td align="right" mono>{formatFCFA(r.tva)}</Td>
                    <Td align="right" mono className="font-semibold">
                      {formatFCFA(r.ttc)}
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
