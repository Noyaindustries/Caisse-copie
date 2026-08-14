import { test, expect } from '@playwright/test'
import {
  injectOrgSession,
  loginAsOwner,
  openModule,
  registerBusinessOrg,
} from './helpers/auth'

const MODULES: Array<{ nav: string; heading: string | RegExp }> = [
  { nav: 'Caisse', heading: 'Caisse' },
  { nav: 'Tableau de bord', heading: 'Tableau de bord' },
  { nav: 'Catalogue', heading: 'Catalogue' },
  { nav: 'Stocks', heading: 'Stocks' },
  { nav: 'Comptabilité', heading: 'Comptabilité' },
  { nav: 'Gestion RH', heading: 'Gestion RH' },
  { nav: 'CRM clients', heading: 'CRM clients' },
  { nav: 'Gestion des tables', heading: 'Gestion des tables' },
  { nav: 'Promotions', heading: 'Promotions' },
  { nav: 'Programme de fidélité', heading: 'Programme de fidélité' },
  { nav: 'Cuisine', heading: 'Cuisine' },
  { nav: 'Tickets & factures', heading: 'Tickets & factures' },
  { nav: 'Commandes en ligne', heading: 'Commandes en ligne' },
  { nav: 'Multi-magasins', heading: 'Multi-magasins' },
  { nav: 'Rapport journalier', heading: 'Rapport journalier' },
  { nav: 'Personnel', heading: /Personnel/ },
  { nav: 'Pointage', heading: 'Pointage' },
  { nav: 'Analytique', heading: 'Analytique' },
  { nav: 'Intégrations', heading: 'Intégrations' },
  { nav: 'Paramètres', heading: 'Paramètres' },
  { nav: 'Abonnement', heading: 'Abonnement' },
]

test.describe('Modules POS (plan business)', () => {
  test('ouvre tous les modules de la sidebar', async ({ page, request }) => {
    const org = await registerBusinessOrg(request)
    await injectOrgSession(page, org)
    await loginAsOwner(page, org)

    for (const mod of MODULES) {
      await openModule(page, mod.nav, mod.heading)
    }
  })
})
