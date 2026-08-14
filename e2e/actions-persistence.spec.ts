import { test, expect } from '@playwright/test'
import {
  fillLabeledInput,
  injectOrgSession,
  loginAsOwner,
  openModule,
  registerBusinessOrg,
  waitForPosReady,
  type E2eOrg,
} from './helpers/auth'

test.describe('Actions & persistance', () => {
  test.describe.configure({ timeout: 180_000 })
  let org: E2eOrg

  test.beforeEach(async ({ page, request }) => {
    org = await registerBusinessOrg(request)
    await injectOrgSession(page, org)
    await loginAsOwner(page, org)
  })

  test('crée un article, le conserve après reload, puis encaisse', async ({
    page,
  }) => {
    const productName = `Article E2E ${Date.now().toString().slice(-6)}`
    const price = '1500'
    const stock = '10'

    await openModule(page, 'Catalogue', 'Catalogue')
    await page.getByRole('button', { name: 'Nouvel article' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Nouveau produit' })).toBeVisible()

    await dialog.getByPlaceholder('Ex. Bissap maison').fill(productName)
    await fillLabeledInput(dialog, 'Prix TTC (FCFA)', price)
    await fillLabeledInput(dialog, 'Stock initial', stock)
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(dialog).toBeHidden({ timeout: 30_000 })
    await expect(page.getByText(productName).first()).toBeVisible({
      timeout: 30_000,
    })

    await page.reload()
    await waitForPosReady(page)
    await openModule(page, 'Catalogue', 'Catalogue')
    await expect(page.getByText(productName).first()).toBeVisible({
      timeout: 30_000,
    })

    await openModule(page, 'Caisse', 'Caisse')
    await page.getByRole('button', { name: new RegExp(productName) }).click()
    await expect(page.getByRole('button', { name: /Encaisser/ })).toBeEnabled()
    await page.getByRole('button', { name: /Encaisser/ }).click()

    const receipt = page.getByRole('dialog')
    await expect(
      receipt.getByRole('heading', { name: /Reçu/i }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(receipt.getByText(productName).first()).toBeVisible()
    await receipt.locator('button').filter({ hasText: /^Fermer$/ }).click()
    await expect(receipt).toBeHidden()

    await openModule(page, 'Rapport journalier', 'Rapport journalier')
    await expect(page.getByRole('heading', { name: 'Journal de caisse' })).toBeVisible()
    await expect(page.getByText('Total ventes (TTC)')).toBeVisible()
    await expect(page.getByText('1 500 FCFA').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Ventes\s*1/ })).toBeVisible()

    await openModule(page, 'Catalogue', 'Catalogue')
    await expect(page.getByText(productName).first()).toBeVisible()
  })

  test('enregistre un pointage et le retrouve après reload', async ({
    page,
  }) => {
    await openModule(page, 'Pointage', /Pointage|Arrivées/)
    await page.getByRole('button', { name: /^Arrivée$/ }).first().click()

    await expect(
      page.getByText(/Arrivée enregistrée|Sur site depuis/i).first(),
    ).toBeVisible({ timeout: 30_000 })

    await page.reload()
    await waitForPosReady(page)
    await openModule(page, 'Pointage', /Pointage|Arrivées/)
    await expect(page.getByText(/Sur site depuis|Présence ouverte/i).first()).toBeVisible()
  })

  test('module Personnel liste le profil propriétaire', async ({ page }) => {
    await openModule(page, 'Personnel', /Personnel/)
    await expect(page.getByText(org.name).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/Administrateur|Admin/i).first()).toBeVisible()
  })
})
