/**
 * Backfill storeSlug pour toutes les organisations, puis (optionnel) index unique.
 * Usage : npx tsx server/scripts/backfill-store-slugs.ts
 */
import 'dotenv/config'
import { prisma } from '../lib/prisma.js'
import { backfillMissingStoreSlugs } from '../lib/storeSlug.js'

async function main() {
  const n = await backfillMissingStoreSlugs()
  console.log(`OK — ${n} organisation(s) mises à jour avec un slug boutique.`)

  const sample = await prisma.organization.findMany({
    select: { name: true, storeCode: true, storeSlug: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })
  for (const org of sample) {
    console.log(`  ${org.storeSlug}  ←  ${org.name} (${org.storeCode ?? '—'})`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
