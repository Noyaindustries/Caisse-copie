import { test, expect } from '@playwright/test'

test.describe('Site commercial', () => {
  test('affiche la page d’accueil', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Caisse\s*CI/i)
    await expect(
      page.getByRole('button', { name: /Démarrer gratuitement|Voir les tarifs/i }).first(),
    ).toBeVisible()
  })

  test('navigue vers les tarifs', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('affiche le formulaire d’inscription', async ({ page }) => {
    await page.goto('/inscription')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('gate staff sans organisation', async ({ page }) => {
    await page.goto('/staff')
    await expect(
      page.getByRole('heading', { name: 'Connexion caisse' }),
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole('button', { name: 'Créer mon magasin' }),
    ).toBeVisible()
  })
})

test.describe('API backend', () => {
  test('health check répond', async ({ request }) => {
    const apiBase =
      process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:4000'
    const res = await request.get(`${apiBase}/health`)
    expect(res.status()).toBeLessThan(600)
    const body = (await res.json()) as { ok?: boolean; version?: string }
    expect(typeof body.version).toBe('string')
  })

  test('register crée une organisation en essai', async ({ request }) => {
    const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 6)}`
    const res = await request.post('/api/billing/register', {
      data: {
        name: `API E2E ${stamp}`,
        email: `api.e2e.${stamp}@gmail.com`,
        password: 'TestPass123',
        planId: 'starter',
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = (await res.json()) as {
      organizationId?: string
      usable?: boolean
      status?: string
      planId?: string
    }
    expect(body.organizationId).toBeTruthy()
    expect(body.usable).toBe(true)
    expect(body.status).toBe('trialing')
    expect(body.planId).toBe('starter')
  })
})
