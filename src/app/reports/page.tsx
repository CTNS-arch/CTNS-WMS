'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR_HEX: Record<string, string> = { PRODUCT: '#3b82f6', ASSEMBLY: '#a855f7', COMPONENT: '#10b981' }
const CAT_BADGE: Record<string, string> = {
  PRODUCT: 'bg-blue-100 text-blue-700',
  ASSEMBLY: 'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const TX_LABEL: Record<string, string> = { IN: '입고', OUT: '출고', ADJUST: '조정', TRANSFER: '이관' }
const TX_COLOR: Record<string, string> = {
  IN: 'text-emerald-600 bg-emerald-50',
  OUT: 'text-red-600 bg-red-50',
  ADJUST: 'text-blue-600 bg-blue-50',
  TRANSFER: 'text-purple-600 bg-purple-50',
}
const DEPT_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'PRODUCTION', label: '생산구매팀' },
  { value: 'LAB', label: '연구소' },
]

type MonthData = { key: string; label: string; in: number; out: number; adjust: number }
type TopItem = { itemCode: string; itemName: string; unit: string; quantity: number; category: string }
type RecentTx = {
  id: string; type: string; quantity: number; createdAt: string
  item: { itemCode: string; itemName: string; unit: string }
  fromDept?: string | null; toDept?: string | null
}
type ReportData = {
  summary: { totalIn: number; totalOut: number; totalStock: number; itemCount: number; totalCost: number }
  byCat: Record<string, number>
  topItems: TopItem[]
  monthly: MonthData[]
  recentTx: RecentTx[]
}

function fmtKRW(v: number): string {
  if (v >= 1_0000_0000) return `₩${(v / 1_0000_0000).toFixed(1)}억`
  if (v >= 1_0000) return `₩${Math.round(v / 1_0000).toLocaleString()}만`
  return `₩${v.toLocaleString()}`
}

/* ── 막대 차트 (CSS) ── */
function BarChart({ data }: { data: MonthData[] }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.in, d.out)), 1)
  const H = 140

  return (
    <div className="select-none">
      <div className="flex items-end gap-1.5 pb-1" style={{ height: H + 24 }}>
        {data.map(d => (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: H + 24 }}>
            <div className="flex-1 flex items-end gap-0.5 w-full">
              <div className="flex-1 bg-emerald-400 rounded-t-sm transition-all duration-500 min-h-[1px]"
                style={{ height: `${(d.in / maxVal) * H}px` }}
                title={`입고: ${d.in.toLocaleString()}`} />
              <div className="flex-1 bg-red-400 rounded-t-sm transition-all duration-500 min-h-[1px]"
                style={{ height: `${(d.out / maxVal) * H}px` }}
                title={`출고: ${d.out.toLocaleString()}`} />
            </div>
            <span className="text-[9px] text-gray-400 leading-none">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <span className="text-[10px] text-gray-500">입고</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span className="text-[10px] text-gray-500">출고</span>
        </div>
      </div>
    </div>
  )
}

/* ── 도넛 차트 (SVG) ── */
function DonutChart({ byCat }: { byCat: Record<string, number> }) {
  const total = Object.values(byCat).reduce((s, v) => s + v, 0)
  if (total === 0) return <div className="flex items-center justify-center h-40 text-xs text-gray-400">데이터 없음</div>

  const r = 52, cx = 70, cy = 70, circum = 2 * Math.PI * r
  let offset = 0
  const segments = Object.entries(byCat).map(([cat, val]) => {
    const pct = val / total
    const seg = { cat, val, pct, offset, dash: `${pct * circum} ${circum}` }
    offset += pct
    return seg
  })

  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" className="shrink-0">
        {segments.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={CAT_COLOR_HEX[seg.cat] ?? '#6b7280'}
            strokeWidth={26}
            strokeDasharray={seg.dash}
            strokeDashoffset={0}
            transform={`rotate(${seg.offset * 360 - 90} ${cx} ${cy})`}
            style={{ transition: 'all 0.5s' }}
          />
        ))}
        <circle cx={cx} cy={cy} r={39} fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fontSize="13" fontWeight="700" fill="#111">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#9ca3af">총 재고</text>
      </svg>
      <div className="flex flex-col gap-2">
        {segments.map(seg => (
          <div key={seg.cat} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLOR_HEX[seg.cat] ?? '#6b7280' }} />
            <span className="text-xs text-gray-600 w-16">{CAT_LABEL[seg.cat] ?? seg.cat}</span>
            <span className="text-xs font-semibold text-gray-800 tabular-nums">{seg.val.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">({(seg.pct * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [dept, setDept] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchReport = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (d) params.set('department', d)
      const res = await fetch(`/api/reports/stock?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport(dept) }, [dept])

  const handlePrint = () => window.print()

  const deptLabel = DEPT_OPTIONS.find(o => o.value === dept)?.label ?? '전체'
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      {/* ── 프린트 전용 CSS ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col h-full overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-3 border-b bg-white shrink-0 flex items-center justify-between no-print">
          <h1 className="text-sm font-semibold text-gray-800">재고 보고서</h1>
          <Button size="sm" className="h-8 text-xs px-4 gap-1.5" onClick={handlePrint}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF 출력
          </Button>
        </div>

        {/* 부서 탭 */}
        <div className="bg-white border-b shrink-0 flex no-print">
          {DEPT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setDept(o.value)}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                dept === o.value
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >{o.label}</button>
          ))}
          <span className="ml-auto flex items-center pr-4 text-xs text-gray-400">{today} 기준</span>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          <div id="print-area" ref={printRef} className="max-w-6xl mx-auto px-6 py-5">
            {/* 프린트 헤더 (화면에서는 숨김) */}
            <div className="hidden print:block mb-6">
              <h1 className="text-xl font-bold text-gray-900">CTNS ERP — 재고 현황 보고서</h1>
              <p className="text-sm text-gray-500 mt-1">{today} 기준 · {deptLabel}</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">불러오는 중...</div>
            ) : !data ? (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">데이터를 불러올 수 없습니다.</div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* 요약 카드 4개 */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: '현재 총 재고', value: data.summary.totalStock.toLocaleString(), unit: '건', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '최근 12개월 입고', value: data.summary.totalIn.toLocaleString(), unit: '건', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: '최근 12개월 출고', value: data.summary.totalOut.toLocaleString(), unit: '건', color: 'text-red-500', bg: 'bg-red-50' },
                    { label: '재고 품목 수', value: data.summary.itemCount.toLocaleString(), unit: '종', color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: '현재 재고 원가 합계', value: fmtKRW(data.summary.totalCost ?? 0), unit: '원', color: 'text-amber-600', bg: 'bg-amber-50' },
                  ].map(card => (
                    <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
                      <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                      <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
                        {card.value}
                        <span className="text-sm font-normal ml-1 text-gray-500">{card.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* 차트 행 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 월별 입출고 막대 차트 */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="text-xs font-semibold text-gray-600 mb-4">월별 입출고 현황 (최근 12개월)</h3>
                    <BarChart data={data.monthly} />
                    {/* 월별 숫자 테이블 (간략) */}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-[10px] text-gray-500">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1 font-medium">월</th>
                            <th className="text-right py-1 font-medium text-emerald-600">입고</th>
                            <th className="text-right py-1 font-medium text-red-500">출고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.monthly.filter(m => m.in > 0 || m.out > 0).slice(-6).map(m => (
                            <tr key={m.key} className="border-b border-gray-50">
                              <td className="py-0.5">{m.key}</td>
                              <td className="text-right text-emerald-600 tabular-nums">{m.in.toLocaleString()}</td>
                              <td className="text-right text-red-500 tabular-nums">{m.out.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 분류별 재고 도넛 차트 */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="text-xs font-semibold text-gray-600 mb-4">분류별 재고 현황</h3>
                    <DonutChart byCat={data.byCat} />
                  </div>
                </div>

                {/* 하단 행 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 재고 상위 품목 */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="text-xs font-semibold text-gray-600 mb-3">재고 상위 품목 (Top 15)</h3>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-gray-50 text-gray-400 text-[10px]">
                            <th className="px-2 py-1.5 text-left w-6">#</th>
                            <th className="px-2 py-1.5 text-left">품번</th>
                            <th className="px-2 py-1.5 text-left">품명</th>
                            <th className="px-2 py-1.5 text-left w-16">분류</th>
                            <th className="px-2 py-1.5 text-right w-20">재고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topItems.map((it, i) => {
                            const maxQ = data.topItems[0]?.quantity ?? 1
                            const pct = (it.quantity / maxQ) * 100
                            return (
                              <tr key={it.itemCode} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                                <td className="px-2 py-1.5 font-mono text-gray-700 text-[10px]">{it.itemCode}</td>
                                <td className="px-2 py-1.5 text-gray-700 max-w-[120px]">
                                  <div className="truncate">{it.itemName}</div>
                                  <div className="h-1 mt-0.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: CAT_COLOR_HEX[it.category] ?? '#6b7280' }} />
                                  </div>
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${CAT_BADGE[it.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {CAT_LABEL[it.category]?.[0]}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-gray-900">
                                  {it.quantity.toLocaleString()}
                                  <span className="text-gray-400 font-normal ml-0.5">{it.unit}</span>
                                </td>
                              </tr>
                            )
                          })}
                          {data.topItems.length === 0 && (
                            <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400">데이터 없음</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 최근 거래 이력 */}
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="text-xs font-semibold text-gray-600 mb-3">최근 거래 이력</h3>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-gray-50 text-gray-400 text-[10px]">
                            <th className="px-2 py-1.5 text-left">일시</th>
                            <th className="px-2 py-1.5 text-left">품번</th>
                            <th className="px-2 py-1.5 text-left w-12">유형</th>
                            <th className="px-2 py-1.5 text-right w-20">수량</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentTx.map(tx => (
                            <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap text-[10px]">
                                {new Date(tx.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="font-mono text-[10px] text-gray-600 truncate max-w-[110px]">{tx.item.itemCode}</div>
                                <div className="text-[9px] text-gray-400 truncate max-w-[110px]">{tx.item.itemName}</div>
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TX_COLOR[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {TX_LABEL[tx.type] ?? tx.type}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-gray-900">
                                {tx.quantity.toLocaleString()}
                                <span className="text-gray-400 font-normal ml-0.5 text-[10px]">{tx.item.unit}</span>
                              </td>
                            </tr>
                          ))}
                          {data.recentTx.length === 0 && (
                            <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-400">거래 이력 없음</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
