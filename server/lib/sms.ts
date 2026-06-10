export type SmsSendResult =
  | { ok: true; mode: 'demo' | 'provider' }
  | { ok: false; error: string }

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function sendSms(input: {
  to: string
  message: string
  meta?: Record<string, string | undefined>
}): Promise<SmsSendResult> {
  const to = normalizePhone(input.to)
  if (to.length < 8) {
    return { ok: false, error: 'Numéro de téléphone invalide.' }
  }

  const providerUrl = process.env.SMS_PROVIDER_URL?.trim()
  const providerToken = process.env.SMS_PROVIDER_TOKEN?.trim()

  if (!providerUrl) {
    console.info('[sms:demo]', {
      to,
      message: input.message,
      ...input.meta,
    })
    return { ok: true, mode: 'demo' }
  }

  try {
    const providerRes = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(providerToken ? { Authorization: `Bearer ${providerToken}` } : {}),
      },
      body: JSON.stringify({
        to,
        message: input.message,
        ...input.meta,
      }),
    })
    if (!providerRes.ok) {
      return { ok: false, error: `Provider SMS en erreur (${providerRes.status}).` }
    }
    return { ok: true, mode: 'provider' }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Envoi SMS impossible.',
    }
  }
}
