const WEBHOOK_URL    = process.env.SMS_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET

function shouldNotify(category?: string, subCategory?: string): boolean {
  if (category === 'PRODUCT'  && subCategory === 'BP') return true
  if (category === 'ASSEMBLY' && (subCategory === 'BM' || subCategory === 'PC')) return true
  if (category === 'COMPONENT' && subCategory === 'EL') return true
  return false
}

export function notifyErpWebhook(event: 'upsert' | 'delete', item: any) {
  if (!WEBHOOK_URL) return
  if (event === 'upsert' && !shouldNotify(item.category, item.subCategory)) return

  fetch(`${WEBHOOK_URL}/api/webhook/erp-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WEBHOOK_SECRET ? { Authorization: `Bearer ${WEBHOOK_SECRET}` } : {}),
    },
    body: JSON.stringify({ event, item }),
  }).catch(() => {})
}
