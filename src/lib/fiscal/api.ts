import { apiUrl } from '../apiUrl'
import { parseApiResponse } from '../parseApiResponse'
import { buildOrgAuthHeaders } from '../subscription/authHeaders'

export type FiscalSettings = {
  taxId: string | null
  fiscalRegime: string
  fneEnabled: boolean
}

export async function fetchFiscalSettings(): Promise<FiscalSettings | null> {
  const res = await fetch(apiUrl('/org/fiscal/settings'), {
    headers: buildOrgAuthHeaders(),
  })
  if (res.status === 401) return null
  return parseApiResponse<FiscalSettings>(res)
}

export async function updateFiscalSettings(
  patch: Partial<Pick<FiscalSettings, 'taxId' | 'fiscalRegime' | 'fneEnabled'>>,
): Promise<FiscalSettings> {
  const res = await fetch(apiUrl('/org/fiscal/settings'), {
    method: 'PATCH',
    headers: buildOrgAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  })
  return parseApiResponse<FiscalSettings>(res)
}
