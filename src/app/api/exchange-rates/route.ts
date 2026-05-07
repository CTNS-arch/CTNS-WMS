import { NextResponse } from 'next/server'

// 1 USD 기준 환율 → KRW 변환율 계산
// toKRW[currency] = 1 {currency} 당 원화
export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 }, // 1시간 캐시
    })
    if (!res.ok) throw new Error('환율 API 응답 오류')
    const data = await res.json()
    const rates = data.rates as Record<string, number>

    const krw = rates.KRW ?? 1300
    const toKRW: Record<string, number> = {
      KRW: 1,
      USD: krw,
      EUR: krw / (rates.EUR ?? 1),
      CNY: krw / (rates.CNY ?? 1),
      JPY: krw / (rates.JPY ?? 1),
      GBP: krw / (rates.GBP ?? 1),
    }

    return NextResponse.json({
      success: true,
      toKRW,
      updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
    })
  } catch {
    // 폴백: 고정 환율 (API 불가 시)
    return NextResponse.json({
      success: true,
      toKRW: { KRW: 1, USD: 1350, EUR: 1470, CNY: 186, JPY: 9.1, GBP: 1710 },
      updatedAt: null,
      fallback: true,
    })
  }
}
