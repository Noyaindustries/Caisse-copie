/**
 * Purge les données métier du compte « Faveur Food »,
 * en conservant l’identité de connexion (email / mot de passe / licence).
 *
 * Usage: npx tsx server/scripts/purge-faveur-food-data.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      storeCode: true,
      storeSlug: true,
      storefrontMenu: true,
      _count: {
        select: {
          storefrontOrders: true,
          staffMembers: true,
          syncBatches: true,
          sessions: true,
          auditLogs: true,
          mobilePayments: true,
          reminderLogs: true,
        },
      },
    },
  })

  const matches = orgs.filter((o) => {
    const hay = `${o.name} ${o.email} ${o.storeSlug ?? ''} ${o.storeCode ?? ''}`.toLowerCase()
    return hay.includes('faveur')
  })

  if (matches.length === 0) {
    console.log('Aucune organisation « Faveur » trouvée.')
    console.log(
      'Organisations présentes:',
      orgs.map((o) => o.name).join(' | ') || '(aucune)',
    )
    return
  }

  if (matches.length > 1) {
    console.log('Plusieurs correspondances — arrêt pour éviter une purge ambiguë:')
    for (const o of matches) {
      console.log(`- ${o.name} <${o.email}> id=${o.id}`)
    }
    return
  }

  const org = matches[0]!
  console.log(
    dryRun ? '[DRY-RUN]' : '[PURGE]',
    `${org.name} <${org.email}> id=${org.id}`,
  )
  console.log('Comptes liés:', org._count)

  if (dryRun) {
    console.log('Aucune suppression effectuée (--dry-run).')
    return
  }

  const [
    orders,
    staff,
    sessions,
    audit,
    payments,
    reminders,
    syncBatches,
  ] = await prisma.$transaction([
    prisma.storefrontOrder.deleteMany({ where: { organizationId: org.id } }),
    prisma.staffMember.deleteMany({ where: { organizationId: org.id } }),
    prisma.orgSession.deleteMany({ where: { organizationId: org.id } }),
    prisma.auditLog.deleteMany({ where: { organizationId: org.id } }),
    prisma.mobileMoneyPayment.deleteMany({ where: { organizationId: org.id } }),
    prisma.subscriptionReminderLog.deleteMany({
      where: { organizationId: org.id },
    }),
    prisma.syncBatch.deleteMany({ where: { organizationId: org.id } }),
  ])

  await prisma.orgIntegration.deleteMany({ where: { organizationId: org.id } })

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      storefrontMenu: null,
      storefrontPublishedAt: null,
      waveApiKey: null,
      waveWebhookSecret: null,
      waveSigningSecret: null,
      waveDemoMode: false,
      cinetpayApiKey: null,
      cinetpaySiteId: null,
      cinetpayDemoMode: false,
      taxId: null,
      // Conservé: name, email, passwordHash, licenseKey, storeCode, storeSlug,
      // planId, status, stripe*, trial*, billing*, smsRemindersEnabled
    },
  })

  console.log('Supprimé:', {
    storefrontOrders: orders.count,
    staffMembers: staff.count,
    sessions: sessions.count,
    auditLogs: audit.count,
    mobilePayments: payments.count,
    reminderLogs: reminders.count,
    syncBatches: syncBatches.count,
    storefrontMenu: 'cleared',
    paymentKeys: 'cleared',
  })
  console.log(
    'Conservé: email, mot de passe, licence, storeCode/slug, abonnement/plan.',
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
