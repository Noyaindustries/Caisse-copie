import 'dotenv/config'
import { prisma } from '../lib/prisma.js'
import {
  activateOrganizationSubscription,
  extendOrganizationPeriod,
  extendOrganizationTrial,
  grantMobileMoneyActivation,
  listOrganizations,
  parseCliArgs,
  printAdminHelp,
  printOrganizationsTable,
  runAdminReminders,
  setOrganizationPlan,
  setOrganizationStatus,
  showOrganization,
} from '../lib/adminSubscriptions.js'
import type { PlanId, SubscriptionStatus } from '../lib/subscriptionPlans.js'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Nombre invalide : ${value}`)
  }
  return Math.floor(n)
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL manquant. Configurez .env avant d’utiliser cette commande.')
    process.exit(1)
  }

  const { command, positional, flags } = parseCliArgs(process.argv.slice(2))

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printAdminHelp()
      break

    case 'list': {
      const orgs = await listOrganizations({
        status: flags.status as SubscriptionStatus | undefined,
        planId: flags.plan as PlanId | undefined,
        limit: parsePositiveInt(flags.limit, 100),
      })
      printOrganizationsTable(orgs)
      break
    }

    case 'show':
      if (!positional[0]) throw new Error('Référence manquante.')
      await showOrganization(positional[0])
      break

    case 'set-plan':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : set-plan <référence> <starter|pro|business>')
      }
      await setOrganizationPlan(positional[0], positional[1])
      break

    case 'set-status':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : set-status <référence> <statut>')
      }
      await setOrganizationStatus(positional[0], positional[1])
      break

    case 'activate':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : activate <référence> <plan> [--days=30]')
      }
      await activateOrganizationSubscription(
        positional[0],
        positional[1],
        parsePositiveInt(flags.days, 30),
      )
      break

    case 'extend-trial':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : extend-trial <référence> <jours>')
      }
      await extendOrganizationTrial(
        positional[0],
        parsePositiveInt(positional[1], 0),
      )
      break

    case 'extend-period':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : extend-period <référence> <jours>')
      }
      await extendOrganizationPeriod(
        positional[0],
        parsePositiveInt(positional[1], 0),
      )
      break

    case 'grant-mm':
      if (!positional[0] || !positional[1]) {
        throw new Error('Usage : grant-mm <référence> <plan>')
      }
      await grantMobileMoneyActivation(positional[0], positional[1])
      break

    case 'remind':
      await runAdminReminders(flags.org)
      break

    default:
      console.error(`Commande inconnue : ${command}\n`)
      printAdminHelp()
      process.exit(1)
  }
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Erreur : ${message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
