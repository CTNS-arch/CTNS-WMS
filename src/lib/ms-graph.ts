const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function getAppToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID!
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  )
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
  const json = await res.json()
  if (!json.access_token) throw new Error('No access_token in response')
  return json.access_token
}

export type MsUser = {
  id: string
  displayName: string | null
  mail: string | null
  userPrincipalName: string
  accountEnabled: boolean
}

export async function listActiveOrgUsers(): Promise<MsUser[]> {
  const token = await getAppToken()
  const users: MsUser[] = []

  let url: string | null =
    `${GRAPH_BASE}/users?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=999`

  while (url) {
    const pageRes: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!pageRes.ok) {
      const body = await pageRes.text()
      throw new Error(`Graph API ${pageRes.status}: ${body}`)
    }
    const pageJson: { value?: MsUser[]; '@odata.nextLink'?: string } = await pageRes.json()
    users.push(...(pageJson.value ?? []))
    url = pageJson['@odata.nextLink'] ?? null
  }

  return users.filter(u => u.accountEnabled === true)
}
