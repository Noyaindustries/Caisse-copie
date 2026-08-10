import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import type { CrmInteractionKind } from '../db/types'
import { downloadTextFile, toCsvSemicolon } from '../lib/analyticsExport'
import { formatFCFA } from '../lib/money'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Field, Input, Select } from '../ui/Input'
import { Kpi } from '../ui/Kpi'
import { PageHeader } from '../ui/PageHeader'
import { Table, TBody, Td, Th, THead, Tr } from '../ui/Table'
import { MobileDataCard, ResponsiveData } from '../ui/ResponsiveData'
import { useToast } from '../ui/Toast'
import { saleNetTTC } from '../lib/refundMath'

type Props = {
  actor: { id: string; displayName: string }
}

export function CrmView({ actor }: Props) {
  const toast = useToast()
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [kind, setKind] = useState<CrmInteractionKind>('call')
  const [note, setNote] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [now] = useState(Date.now)

  const customers = useLiveQuery(() => db.loyaltyCustomers.orderBy('updatedAt').reverse().toArray(), [], []) ?? []
  const interactions = useLiveQuery(() => db.crmInteractions.orderBy('createdAt').reverse().limit(400).toArray(), [], []) ?? []
  const sales = useLiveQuery(() => db.sales.toArray(), [], []) ?? []

  const crmRows = useMemo(() => {
    return customers
      .map((c) => {
        const customerSales = sales.filter((s) => s.loyaltyCustomerId === c.id || s.loyaltyCustomerPhone === c.phone)
        const totalSpent = customerSales.reduce((sum, s) => sum + saleNetTTC(s), 0)
        const lastSaleAt = customerSales.reduce((m, s) => Math.max(m, s.createdAt), 0)
        const lastInteractionAt = interactions
          .filter((i) => i.customerId === c.id)
          .reduce((m, i) => Math.max(m, i.createdAt), 0)
        return {
          id: c.id,
          name: c.displayName || 'Client',
          phone: c.phone,
          points: c.points,
          visits: c.visitCount,
          totalSpent,
          lastSaleAt,
          lastInteractionAt,
        }
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
  }, [customers, sales, interactions])

  const overdueFollowups = useMemo(() => {
    return interactions.filter((i) => i.nextActionAt != null && i.nextActionAt < now).length
  }, [interactions, now])

  const addInteraction = async (): Promise<void> => {
    const customer = customers.find((c) => c.id === selectedCustomerId)
    if (!customer) {
      toast.error('Sélectionnez un client')
      return
    }
    if (!note.trim()) {
      toast.error('Ajoutez une note')
      return
    }
    await db.crmInteractions.add({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      customerId: customer.id,
      customerPhone: customer.phone,
      customerName: customer.displayName,
      kind,
      note: note.trim(),
      nextActionAt: nextActionDate ? new Date(`${nextActionDate}T08:00:00`).getTime() : undefined,
      actorProfileId: actor.id,
      actorDisplayName: actor.displayName,
    })
    const { scheduleWorkspaceOpsPush } = await import('../lib/workspaceOpsCloud')
    scheduleWorkspaceOpsPush()
    setNote('')
    setNextActionDate('')
    toast.success('Interaction CRM enregistrée')
  }

  const exportCrmCsv = (): void => {
    const rows: string[][] = [
      ['CRM clients'],
      ['Client', 'Téléphone', 'Visites', 'Points', 'CA net'],
      ...crmRows.map((r) => [r.name, r.phone, String(r.visits), String(r.points), String(r.totalSpent)]),
      [],
      ['Date', 'Client', 'Canal', 'Note', 'Prochaine action', 'Agent'],
      ...interactions.map((i) => [
        new Date(i.createdAt).toLocaleString('fr-FR'),
        i.customerName ?? i.customerPhone,
        i.kind,
        i.note,
        i.nextActionAt ? new Date(i.nextActionAt).toLocaleDateString('fr-FR') : '',
        i.actorDisplayName ?? '',
      ]),
    ]
    downloadTextFile('crm-clients.csv', toCsvSemicolon(rows))
    toast.success('Export CRM généré')
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Relation client"
        title="CRM clients"
        subtitle="Segmentation clients, interactions commerciales et plan de relance"
        actions={
          <Button variant="secondary" className="w-full sm:w-auto" onClick={exportCrmCsv}>
            Export CRM
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Clients fidélité" value={String(customers.length)} tone="accent" />
        <Kpi label="Interactions CRM" value={String(interactions.length)} tone="neutral" />
        <Kpi label="Relances en retard" value={String(overdueFollowups)} tone="amber" />
      </div>

      <Card className="bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
        <CardContent className="grid gap-2 md:grid-cols-2">
          <Field label="Client">
            <Select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">Sélectionner</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.displayName || 'Client')} · {c.phone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Canal">
            <Select value={kind} onChange={(e) => setKind(e.target.value as CrmInteractionKind)}>
              <option value="call">Appel</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="visit">Visite</option>
              <option value="note">Note interne</option>
            </Select>
          </Field>
          <Field label="Prochaine action">
            <Input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
          </Field>
          <Field label="Note" className="md:col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: client intéressé par lot boisson, rappel vendredi..." />
          </Field>
          <div className="md:col-span-2">
            <Button variant="accent" fullWidth className="sm:w-auto" onClick={() => void addInteraction()}>
              Ajouter interaction
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(246,250,255,0.94))]">
        <CardContent>
          {crmRows.length === 0 ? (
            <EmptyState title="Aucun client CRM" description="Les clients du programme fidélité apparaîtront ici." variant="flat" />
          ) : (
            <ResponsiveData
              table={
                <Table minWidth={900}>
                  <THead>
                    <Tr hover={false}>
                      <Th sticky>Client</Th>
                      <Th>Téléphone</Th>
                      <Th align="right" hideBelow="lg">
                        Visites
                      </Th>
                      <Th align="right" hideBelow="lg">
                        Points
                      </Th>
                      <Th align="right">CA net</Th>
                      <Th hideBelow="xl">Dernier achat</Th>
                      <Th hideBelow="xl">Dernière interaction</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {crmRows.map((r) => (
                      <Tr key={r.id}>
                        <Td sticky>{r.name}</Td>
                        <Td mono>{r.phone}</Td>
                        <Td align="right" mono hideBelow="lg">
                          {r.visits}
                        </Td>
                        <Td align="right" mono hideBelow="lg">
                          {r.points}
                        </Td>
                        <Td align="right" mono className="font-semibold">
                          {formatFCFA(r.totalSpent)}
                        </Td>
                        <Td hideBelow="xl">
                          {r.lastSaleAt
                            ? new Date(r.lastSaleAt).toLocaleDateString('fr-FR')
                            : '—'}
                        </Td>
                        <Td hideBelow="xl">
                          {r.lastInteractionAt
                            ? new Date(r.lastInteractionAt).toLocaleDateString('fr-FR')
                            : '—'}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              }
              cards={
                <ul className="grid gap-2">
                  {crmRows.map((r) => (
                    <MobileDataCard
                      key={r.id}
                      title={r.name}
                      meta={
                        <span className="font-mono-nums">{r.phone}</span>
                      }
                      body={
                        <div className="grid grid-cols-2 gap-1.5">
                          <span>Visites : {r.visits}</span>
                          <span>Points : {r.points}</span>
                          <span className="col-span-2 font-semibold text-ink">
                            CA net : {formatFCFA(r.totalSpent)}
                          </span>
                          <span className="col-span-2 text-[11px]">
                            Dernier achat :{' '}
                            {r.lastSaleAt
                              ? new Date(r.lastSaleAt).toLocaleDateString('fr-FR')
                              : '—'}
                          </span>
                          <span className="col-span-2 text-[11px]">
                            Dernière interaction :{' '}
                            {r.lastInteractionAt
                              ? new Date(r.lastInteractionAt).toLocaleDateString(
                                  'fr-FR',
                                )
                              : '—'}
                          </span>
                        </div>
                      }
                    />
                  ))}
                </ul>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
