type ApiErrorPayload = {
  error?: string
  message?: string
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: unknown

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(
      response.ok
        ? 'Le serveur API a renvoyé une réponse invalide.'
        : `Service API indisponible (HTTP ${response.status}).`,
    )
  }

  if (!response.ok) {
    const payload =
      typeof data === 'object' && data !== null
        ? (data as ApiErrorPayload)
        : {}
    throw new Error(
      payload.error ??
        payload.message ??
        `Erreur HTTP ${response.status}`,
    )
  }

  return data as T
}
