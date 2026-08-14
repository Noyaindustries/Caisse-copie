import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

export type E2eOrg = {
  name: string
  email: string
  password: string
  pin: string
  organizationId: string
  licenseKey: string
  sessionToken?: string
  storeCode: string | null
  storeSlug?: string | null
  storefrontKey?: string | null
  planId: string
  plan: unknown
  status: string
  usable: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeEnabled: boolean
  mobileMoneyEnabled: boolean
  billingPhone: string | null
  smsRemindersEnabled: boolean
}

const OWNER_PIN = '1234'
const OWNER_PASSWORD = 'TestPass123'

export async function registerBusinessOrg(
  request: APIRequestContext,
): Promise<E2eOrg> {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
  const name = `E2E Shop ${stamp.slice(-8)}`
  const email = `e2e.${stamp}@gmail.com`
  const res = await request.post('/api/billing/register', {
    data: {
      name,
      email,
      password: OWNER_PASSWORD,
      planId: 'business',
    },
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok()) {
    throw new Error(
      `Inscription e2e échouée (${res.status()}): ${JSON.stringify(body)}`,
    )
  }
  return {
    name,
    email,
    password: OWNER_PASSWORD,
    pin: OWNER_PIN,
    organizationId: String(body.organizationId),
    licenseKey: String(body.licenseKey),
    sessionToken:
      typeof body.sessionToken === 'string' ? body.sessionToken : undefined,
    storeCode: (body.storeCode as string | null) ?? null,
    storeSlug: (body.storeSlug as string | null) ?? null,
    storefrontKey: (body.storefrontKey as string | null) ?? null,
    planId: String(body.planId ?? 'business'),
    plan: body.plan,
    status: String(body.status ?? 'trialing'),
    usable: Boolean(body.usable),
    trialEndsAt: (body.trialEndsAt as string | null) ?? null,
    currentPeriodEnd: (body.currentPeriodEnd as string | null) ?? null,
    stripeEnabled: Boolean(body.stripeEnabled),
    mobileMoneyEnabled: Boolean(body.mobileMoneyEnabled),
    billingPhone: (body.billingPhone as string | null) ?? null,
    smsRemindersEnabled: body.smsRemindersEnabled !== false,
  }
}

export async function injectOrgSession(page: Page, org: E2eOrg): Promise<void> {
  await page.addInitScript((payload) => {
    const creds = {
      licenseKey: payload.licenseKey,
      sessionToken: payload.sessionToken,
      organizationId: payload.organizationId,
      name: payload.name,
      storeCode: payload.storeCode,
      storeSlug: payload.storeSlug,
      storefrontKey: payload.storefrontKey,
    }
    const snap = {
      organizationId: payload.organizationId,
      name: payload.name,
      email: payload.email,
      licenseKey: payload.licenseKey,
      sessionToken: payload.sessionToken,
      storeCode: payload.storeCode,
      storeSlug: payload.storeSlug,
      storefrontKey: payload.storefrontKey,
      planId: payload.planId,
      plan: payload.plan,
      status: payload.status,
      usable: payload.usable,
      trialEndsAt: payload.trialEndsAt,
      currentPeriodEnd: payload.currentPeriodEnd,
      stripeEnabled: payload.stripeEnabled,
      mobileMoneyEnabled: payload.mobileMoneyEnabled,
      billingPhone: payload.billingPhone,
      smsRemindersEnabled: payload.smsRemindersEnabled,
      cachedAt: Date.now(),
    }
    localStorage.setItem('caisseci-org-credentials-v1', JSON.stringify(creds))
    localStorage.setItem(
      'caisseci-subscription-snapshot-v1',
      JSON.stringify(snap),
    )
    if (payload.sessionToken) {
      localStorage.setItem('caisseci-session-token-v1', payload.sessionToken)
    }
  }, org)
}

export async function loginAsOwner(page: Page, org: E2eOrg): Promise<void> {
  await page.goto('/staff', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible({
    timeout: 60_000,
  })

  const profile = page.getByRole('button', { name: new RegExp(org.name, 'i') })
  await expect(profile).toBeVisible({ timeout: 60_000 })
  await profile.click()

  await page.getByPlaceholder('••••').fill(org.pin)
  await page
    .getByRole('button', { name: /Ouvrir l[’']espace gestion/i })
    .click()

  await waitForPosReady(page)
  await expect(page.getByRole('heading', { name: 'Caisse' })).toBeVisible({
    timeout: 60_000,
  })
}

export async function openModule(
  page: Page,
  label: string,
  heading: string | RegExp = label,
): Promise<void> {
  const nav = page.locator('nav').filter({ has: page.locator('.sidebar-nav-item') })
  await nav.getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
    timeout: 30_000,
  })
}

export async function fillLabeledInput(
  root: Page | Locator,
  label: string | RegExp,
  value: string,
): Promise<void> {
  const field = root
    .locator('div.block')
    .filter({ hasText: label })
    .locator('input, textarea, select')
    .first()
  await field.fill(value)
}

export async function waitForPosReady(page: Page): Promise<void> {
  const retry = page.getByRole('button', { name: 'Réessayer' })
  const ready = page.locator('header h1, h1').filter({
    hasText: /Caisse|Catalogue|Pointage|Personnel|Stocks/,
  })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loading = page.getByText('Chargement de la caisse…')
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 90_000 })
    }
    if (await retry.isVisible().catch(() => false)) {
      await retry.click()
      await expect(retry)
        .toBeHidden({ timeout: 15_000 })
        .catch(() => undefined)
      continue
    }
    if (await ready.first().isVisible().catch(() => false)) {
      return
    }
    await expect
      .poll(async () => ready.first().isVisible().catch(() => false), {
        timeout: 5_000,
      })
      .toBeTruthy()
      .catch(() => undefined)
  }
  await expect(ready.first()).toBeVisible({ timeout: 60_000 })
}
