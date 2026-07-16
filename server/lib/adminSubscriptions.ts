import type { Organization } from '@prisma/client'
import { prisma } from './prisma.js'
import { normalizeOwnerEmail } from './ownerAuth.js'
import { activateMobileMoneySubscription } from './subscriptionActivation.js'
import {
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  isSubscriptionUsable,
  type PlanId,
  type SubscriptionStatus,
} from './subscriptionPlans.js'

export type AdminOrganizationDto = {
  id: string
  name: string
  email: string
  licenseKey: string
  storeCode: string | null
  planId: PlanId
  planName: string
  status: SubscriptionStatus
  usable: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  billingProvider: string | null
  billingPhone: string | null
  stripeSubId: string | null
  smsRemindersEnabled: boolean
  createdAt: string
  updatedAt: string
}

export function serializeOrganizationForAdmin(org: Organization): AdminOrganizationDto {
  const planId = safePlanId(org.planId)
  const plan = SUBSCRIPTION_PLANS[planId]
  const status = org.status as SubscriptionStatus
  return {
    id: org.id,
    name: org.name,
    email: org.email,
    licenseKey: org.licenseKey,
    storeCode: org.storeCode,
    planId,
    planName: plan.name,
    status,
    usable: isSubscriptionUsable(status, org.currentPeriodEnd, org.trialEndsAt),
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
    billingProvider: org.billingProvider,
    billingPhone: org.billingPhone,
    stripeSubId: org.stripeSubId,
    smsRemindersEnabled: org.smsRemindersEnabled,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  }
}
import { runSubscriptionReminders } from './subscriptionReminders.js'

export type OrgRef = string

function normalizeStoreCode(input: string): string {
  const raw = input.trim().toUpperCase().replace(/\s/g, '')
  if (!raw) return ''
  if (raw.startsWith('MAG-')) return raw
  if (raw.startsWith('MAG')) return `MAG-${raw.slice(3).replace(/^-/, '')}`
  return `MAG-${raw}`
}

function safePlanId(value: string): PlanId {
  if (value === 'pro' || value === 'business') return value
  return 'starter'
}

function parsePlanId(value: string): PlanId {
  if (value === 'pro' || value === 'business') return value
  if (value === 'starter') return 'starter'
  throw new Error(`Plan invalide : ${value} (starter | pro | business)`)
}

function parseStatus(value: string): SubscriptionStatus {
  const allowed: SubscriptionStatus[] = [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'expired',
  ]
  if (allowed.includes(value as SubscriptionStatus)) {
    return value as SubscriptionStatus
  }
  throw new Error(`Statut invalide : ${value}`)
}

export async function findOrganizationByRef(ref: OrgRef): Promise<Organization | null> {
  const trimmed = ref.trim()
  if (!trimmed) return null

  const byLicense = await prisma.organization.findUnique({
    where: { licenseKey: trimmed.toUpperCase() },
  })
  if (byLicense) return byLicense

  const byEmail = await prisma.organization.findUnique({
    where: { email: normalizeOwnerEmail(trimmed) },
  })
  if (byEmail) return byEmail

  const storeCode = normalizeStoreCode(trimmed)
  if (storeCode) {
    const byStore = await prisma.organization.findUnique({
      where: { storeCode },
    })
    if (byStore) return byStore
  }

  const byId = await prisma.organization.findUnique({ where: { id: trimmed } })
  return byId
}

export async function requireOrganizationByRef(ref: OrgRef): Promise<Organization> {
  const org = await findOrganizationByRef(ref)
  if (!org) {
    throw new Error(`Organisation introuvable pour : ${ref}`)
  }
  return org
}

export type ListSubscriptionsFilter = {
  status?: SubscriptionStatus
  planId?: PlanId
  limit?: number
}

export async function listOrganizations(filter: ListSubscriptionsFilter = {}) {
  const rows = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 100,
  })

  return rows.filter((org) => {
    if (filter.status && org.status !== filter.status) return false
    if (filter.planId && org.planId !== filter.planId) return false
    return true
  })
}

export function formatOrganizationRow(org: Organization): string {
  const planId = safePlanId(org.planId)
  const status = org.status as SubscriptionStatus
  const usable = isSubscriptionUsable(
    status,
    org.currentPeriodEnd,
    org.trialEndsAt,
  )
  const plan = SUBSCRIPTION_PLANS[planId]
  const trial = org.trialEndsAt?.toISOString().slice(0, 10) ?? '—'
  const period = org.currentPeriodEnd?.toISOString().slice(0, 10) ?? '—'
  const store = org.storeCode ?? '—'
  return [
    org.licenseKey,
    org.name.slice(0, 28).padEnd(28),
    store.padEnd(10),
    plan.name.padEnd(8),
    org.status.padEnd(10),
    usable ? 'oui' : 'non',
    trial,
    period,
    org.email,
  ].join(' | ')
}

export function printOrganizationsTable(orgs: Organization[]): void {
  const header = [
    'Licence',
    'Nom',
    'Magasin',
    'Plan',
    'Statut',
    'Actif',
    'Fin essai',
    'Fin période',
    'Email',
  ].join(' | ')
  console.log(header)
  console.log('-'.repeat(Math.min(header.length, 120)))
  for (const org of orgs) {
    console.log(formatOrganizationRow(org))
  }
  console.log(`\n${orgs.length} organisation(s)`)
}

export async function showOrganization(ref: OrgRef): Promise<Organization> {
  const org = await requireOrganizationByRef(ref)
  const planId = safePlanId(org.planId)
  const plan = SUBSCRIPTION_PLANS[planId]
  const status = org.status as SubscriptionStatus
  const usable = isSubscriptionUsable(
    status,
    org.currentPeriodEnd,
    org.trialEndsAt,
  )

  console.log('Organisation')
  console.log('  ID           ', org.id)
  console.log('  Nom          ', org.name)
  console.log('  Email        ', org.email)
  console.log('  Licence      ', org.licenseKey)
  console.log('  Code magasin ', org.storeCode ?? '—')
  console.log('  Plan         ', `${plan.name} (${planId})`)
  console.log('  Statut       ', org.status, usable ? '(utilisable)' : '(bloqué)')
  console.log('  Essai jusqu’à', org.trialEndsAt?.toISOString() ?? '—')
  console.log('  Période fin  ', org.currentPeriodEnd?.toISOString() ?? '—')
  console.log('  Paiement     ', org.billingProvider ?? '—')
  console.log('  Tél. fact.   ', org.billingPhone ?? '—')
  console.log('  Stripe sub   ', org.stripeSubId ?? '—')
  console.log('  Créé le      ', org.createdAt.toISOString())
  return org
}

export async function setOrganizationPlan(ref: OrgRef, planIdRaw: string) {
  const org = await requireOrganizationByRef(ref)
  const planId = parsePlanId(planIdRaw)
  await prisma.organization.update({
    where: { id: org.id },
    data: { planId },
  })
  console.log(`Plan mis à jour : ${org.licenseKey} → ${SUBSCRIPTION_PLANS[planId].name}`)
}

export async function setOrganizationStatus(ref: OrgRef, statusRaw: string) {
  const org = await requireOrganizationByRef(ref)
  const status = parseStatus(statusRaw)
  await prisma.organization.update({
    where: { id: org.id },
    data: { status },
  })
  console.log(`Statut mis à jour : ${org.licenseKey} → ${status}`)
}

export async function activateOrganizationSubscription(
  ref: OrgRef,
  planIdRaw: string,
  days = 30,
) {
  const org = await requireOrganizationByRef(ref)
  const planId = parsePlanId(planIdRaw)
  const currentPeriodEnd = new Date()
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + days)

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      planId,
      status: 'active',
      currentPeriodEnd,
      trialEndsAt: null,
      billingProvider: 'admin',
    },
  })
  console.log(
    `Abonnement activé : ${org.licenseKey} — ${SUBSCRIPTION_PLANS[planId].name} jusqu’au ${currentPeriodEnd.toISOString().slice(0, 10)}`,
  )
}

export async function extendOrganizationTrial(ref: OrgRef, days: number) {
  const org = await requireOrganizationByRef(ref)
  const base = org.trialEndsAt && org.trialEndsAt.getTime() > Date.now()
    ? org.trialEndsAt
    : new Date()
  const trialEndsAt = new Date(base)
  trialEndsAt.setDate(trialEndsAt.getDate() + days)

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      status: 'trialing',
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
    },
  })
  console.log(
    `Essai prolongé : ${org.licenseKey} jusqu’au ${trialEndsAt.toISOString().slice(0, 10)}`,
  )
}

export async function extendOrganizationPeriod(ref: OrgRef, days: number) {
  const org = await requireOrganizationByRef(ref)
  const base =
    org.currentPeriodEnd && org.currentPeriodEnd.getTime() > Date.now()
      ? org.currentPeriodEnd
      : new Date()
  const currentPeriodEnd = new Date(base)
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + days)

  await prisma.organization.update({
    where: { id: org.id },
    data: { currentPeriodEnd, status: 'active' },
  })
  console.log(
    `Période prolongée : ${org.licenseKey} jusqu’au ${currentPeriodEnd.toISOString().slice(0, 10)}`,
  )
}

export async function grantMobileMoneyActivation(ref: OrgRef, planIdRaw: string) {
  const org = await requireOrganizationByRef(ref)
  const planId = parsePlanId(planIdRaw)
  await activateMobileMoneySubscription(org.id, planId, 'mobile_money')
  console.log(`Activation type mobile money : ${org.licenseKey} — ${planId}`)
}

export async function runAdminReminders(organizationId?: string) {
  const result = await runSubscriptionReminders(organizationId)
  console.log(`Rappels SMS : ${result.sent} envoyé(s) sur ${result.checked} contrôle(s)`)
}

export function printAdminHelp(): void {
  console.log(`
CaisseCI — administration des abonnements

Usage:
  npm run admin:subscriptions -- <commande> [options]

Commandes:
  list [--status=active] [--plan=pro] [--limit=50]
      Liste les organisations et leur abonnement.

  show <référence>
      Détail d’une organisation (licence, email, MAG-XXX ou ID Mongo).

  set-plan <référence> <starter|pro|business>
      Change le plan sans modifier les dates.

  set-status <référence> <trialing|active|past_due|canceled|expired>
      Change le statut d’abonnement.

  activate <référence> <plan> [--days=30]
      Active manuellement (statut active + fin de période).

  extend-trial <référence> <jours>
      Prolonge l’essai gratuit (défaut essai initial : ${TRIAL_DAYS} jours à l’inscription).

  extend-period <référence> <jours>
      Prolonge la période payée en cours.

  grant-mm <référence> <plan>
      Active comme un paiement mobile money réussi (+${30} jours).

  remind [--org=<organizationId>]
      Lance les rappels SMS d’abonnement.

Exemples:
  npm run admin:subscriptions -- list --status=active
  npm run admin:subscriptions -- show CC-A1B2C3-D4E5F6-789ABC
  npm run admin:subscriptions -- activate MAG-1A2B pro --days=30
  npm run admin:subscriptions -- extend-trial client@example.com 14
`)
}

export function parseCliArgs(argv: string[]): {
  command: string
  positional: string[]
  flags: Record<string, string>
} {
  const args = argv.filter((a) => a !== '--')
  const flags: Record<string, string> = {}
  const positional: string[] = []

  for (const arg of args) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, ...rest] = arg.slice(2).split('=')
      flags[key] = rest.join('=')
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    } else {
      positional.push(arg)
    }
  }

  return {
    command: positional[0] ?? 'help',
    positional: positional.slice(1),
    flags,
  }
}
