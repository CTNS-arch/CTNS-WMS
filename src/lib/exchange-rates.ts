export const FALLBACK_RATES: Record<string, number> = {
  KRW: 1,
  USD: 1380,
  EUR: 1500,
  JPY: 9.1,
  CNY: 190,
  GBP: 1750,
}

// 하드코딩 환율 — 폴백 전용. 실시간 환율은 fetchLiveRates() 사용.
export const EXCHANGE_RATES = FALLBACK_RATES

export function toKRW(amount: number, currency: string, rates?: Record<string, number>): number {
  const r = rates ?? FALLBACK_RATES
  const rate = r[currency?.toUpperCase()] ?? 1
  return amount * rate
}

export async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return FALLBACK_RATES
    const data = await res.json()
    const rates = data.rates as Record<string, number>
    const krw = rates.KRW ?? 1300
    return {
      KRW: 1,
      USD: krw,
      EUR: krw / (rates.EUR ?? 1),
      CNY: krw / (rates.CNY ?? 1),
      JPY: krw / (rates.JPY ?? 1),
      GBP: krw / (rates.GBP ?? 1),
    }
  } catch {
    return FALLBACK_RATES
  }
}
