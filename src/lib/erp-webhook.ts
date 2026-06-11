const WEBHOOK_URL    = process.env.SMS_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET

export function notifyErpWebhook(event: 'upsert' | 'delete' | 'batch', item: any) {
  if (!WEBHOOK_URL) return

  fetch(`${WEBHOOK_URL}/api/webhook/erp-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WEBHOOK_SECRET ? { Authorization: `Bearer ${WEBHOOK_SECRET}` } : {}),
    },
    body: JSON.stringify({ event, item }),
  }).catch(() => {})
}
