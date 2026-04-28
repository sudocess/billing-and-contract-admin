import crypto from 'crypto'

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function makeJwt(): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    JSON.stringify({
      iss: process.env.DOCUSIGN_INTEGRATION_KEY,
      sub: process.env.DOCUSIGN_USER_ID,
      aud: process.env.DOCUSIGN_AUTH_SERVER,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    }),
  )

  const privateKey = (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = base64url(sign.sign(privateKey))

  return `${header}.${payload}.${signature}`
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const jwt = makeJwt()
  const res = await fetch(`https://${process.env.DOCUSIGN_AUTH_SERVER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    if (text.includes('consent_required')) throw new Error('consent_required')
    throw new Error(`DocuSign auth failed: ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return cachedToken.token
}

export async function sendEnvelopeForSignature({
  contractCode,
  clientName,
  clientEmail,
  pdfBuffer,
}: {
  contractCode: string
  clientName: string
  clientEmail: string
  pdfBuffer: Buffer
}): Promise<string> {
  const token = await getAccessToken()
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID
  const baseUrl = process.env.DOCUSIGN_BASE_URL

  const envelope = {
    emailSubject: `Please sign your service agreement — ${contractCode}`,
    emailBlurb: `Hi ${clientName.split(' ')[0]}, please review and sign your service agreement from Engaging UX Design.`,
    documents: [
      {
        documentBase64: pdfBuffer.toString('base64'),
        name: `Service Agreement ${contractCode}.pdf`,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: clientEmail,
          name: clientName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                anchorString: 'CLIENT SIGNATURE',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '20',
              },
            ],
            dateSignedTabs: [
              {
                anchorString: 'DATE SIGNED',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '20',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',
  }

  const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  })

  if (!res.ok) {
    const text = await res.text()
    if (text.includes('consent_required')) throw new Error('consent_required')
    throw new Error(`DocuSign API error: ${text}`)
  }

  const data = await res.json()
  if (!data.envelopeId) throw new Error('DocuSign did not return an envelope ID')
  return data.envelopeId
}
