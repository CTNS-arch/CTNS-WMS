'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CAT_LABEL: Record<string, string> = { PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재' }
const CAT_COLOR: Record<string, string> = {
  PRODUCT: 'bg-blue-100 text-blue-700',
  ASSEMBLY: 'bg-purple-100 text-purple-700',
  COMPONENT: 'bg-emerald-100 text-emerald-700',
}
const CURRENCIES = ['KRW', 'USD', 'EUR', 'CNY', 'JPY', 'GBP']
const CUR_SYMBOL: Record<string, string> = {
  KRW: '₩', USD: '$', EUR: '€', CNY: '¥', JPY: '¥', GBP: '£',
}
const CUR_COLOR: Record<string, string> = {
  KRW: 'bg-blue-50 text-blue-700 border-blue-200',
  USD: 'bg-green-50 text-green-700 border-green-200',
  EUR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CNY: 'bg-red-50 text-red-700 border-red-200',
  JPY: 'bg-orange-50 text-orange-700 border-orange-200',
  GBP: 'bg-violet-50 text-violet-700 border-violet-200',
}

type CostEntry = {
  id: string; currency: string; unitPrice: number; supplier?: string | null; note?: string | null
  createdAt: string
}
type ItemWithCosts = {
  id: string; itemCode: string; itemName: string; unit: string
  category: string; subCategory: string | null; costs: CostEntry[]
}

const LIMIT = 20

export default function CostPage() {
  const [items, setItems] = useState<ItemWithCosts[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [toKRW, setToKRW] = useState<Record<string, number>>({
    KRW: 1, USD: 1350, EUR: 1470, CNY: 186, JPY: 9.1, GBP: 1710,
  })
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null)
  const [rateFallback, setRateFallback] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)

  // 선택된 품목 (우측 패널)
  const [selectedItem, setSelectedItem] = useState<ItemWithCosts | null>(null)
  // 추가 폼
  const [addCurrency, setAddCurrency] = useState('USD')
  const [addPrice, setAddPrice] = useState('')
  const [addSupplier, setAddSupplier] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  // 수정
  const [editId, setEditId] = useState<string | null>(null)
  const [editCurrency, setEditCurrency] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editSupplier, setEditSupplier] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  /* ── 환율 조회 ── */
  const fetchRates = async () => {
    setRateLoading(true)
    try {
      const res = await fetch('/api/exchange-rates')
      const json = await res.json()
      if (json.success) {
        setToKRW(json.toKRW)
        setRateUpdatedAt(json.updatedAt)
        setRateFallback(!!json.fallback)
      }
    } catch {} finally { setRateLoading(false) }
  }

  useEffect(() => { fetchRates() }, [])

  /* ── 품목+원가 조회 ── */
  const fetchItems = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (q.trim()) params.set('search', q.trim())
      const res = await fetch(`/api/cost?${params}`)
      const json = await res.json()
      if (json.success) {
        setItems(json.data.items)
        setTotal(json.data.total)
        setPage(json.data.page)
        // 선택된 품목이 있으면 갱신
        if (selectedItem) {
          const updated = json.data.items.find((i: ItemWithCosts) => i.id === selectedItem.id)
          if (updated) setSelectedItem(updated)
        }
      }
    } finally { setLoading(false) }
  }, [selectedItem?.id])

  useEffect(() => { fetchItems(page, search) }, [page, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); setSearch(searchInput); setPage(1)
  }

  const krwPrice = (entry: CostEntry) =>
    Math.round(entry.unitPrice * (toKRW[entry.currency] ?? 1))

  /* ── 추가 ── */
  const handleAdd = async () => {
    if (!selectedItem) return
    if (!addPrice || Number(addPrice) < 0) { toast.error('단가를 입력하세요.'); return }
    setAddSaving(true)
    try {
      const res = await fetch('/api/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id, currency: addCurrency,
          unitPrice: Number(addPrice), supplier: addSupplier, note: addNote,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('원가가 등록되었습니다.')
        setAddPrice(''); setAddSupplier(''); setAddNote('')
        fetchItems(page, search)
      } else toast.error(json.message)
    } finally { setAddSaving(false) }
  }

  /* ── 수정 저장 ── */
  const handleEditSave = async () => {
    if (!editId || !selectedItem) return
    if (!editPrice || Number(editPrice) < 0) { toast.error('단가를 입력하세요.'); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/cost/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: editCurrency, unitPrice: Number(editPrice), supplier: editSupplier, note: editNote }),
      })
      const json = await res.json()
      if (json.success) { toast.success('수정되었습니다.'); setEditId(null); fetchItems(page, search) }
      else toast.error(json.message)
    } finally { setEditSaving(false) }
  }

  /* ── 삭제 ── */
  const handleDelete = async (costId: string) => {
    if (!confirm('이 원가 항목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/cost/${costId}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('삭제되었습니다.'); fetchItems(page, search) }
    else toast.error(json.message)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 좌측: 품목 목록 ── */}
      <div className="w-[420px] shrink-0 flex flex-col border-r overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b bg-white shrink-0">
          <h1 className="text-sm font-semibold text-gray-800">원가 관리</h1>
        </div>

        {/* 환율 배너 */}
        <div className="px-4 py-2 bg-gray-50 border-b shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">현재 환율 (→ 원화)</span>
            <button onClick={fetchRates} disabled={rateLoading}
              className="text-[10px] text-blue-500 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1">
              {rateLoading ? '갱신 중...' : '↻ 갱신'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['USD', 'EUR', 'CNY', 'JPY', 'GBP'] as const).map(cur => (
              <span key={cur} className={`text-[10px] px-2 py-0.5 rounded border font-mono font-medium ${CUR_COLOR[cur]}`}>
                1 {cur} = ₩{toKRW[cur]?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            ))}
          </div>
          {rateUpdatedAt && (
            <p className="text-[9px] text-gray-400 mt-1">
              {rateFallback ? '⚠ 고정 환율 (API 연결 불가)' : `갱신: ${new Date(rateUpdatedAt).toLocaleString('ko-KR')}`}
            </p>
          )}
        </div>

        {/* 검색 */}
        <div className="px-4 py-2 border-b bg-white shrink-0">
          <form onSubmit={handleSearch} className="flex gap-1.5">
            <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="품번 또는 품명 검색" className="h-8 text-xs flex-1" />
            <Button type="submit" variant="outline" size="sm" className="h-8 text-xs px-3">검색</Button>
          </form>
        </div>

        {/* 품목 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">품목이 없습니다.</div>
          ) : items.map(it => {
            const isSelected = selectedItem?.id === it.id
            const hasCosts = it.costs.length > 0
            return (
              <div key={it.id}
                onClick={() => { setSelectedItem(it); setEditId(null); setAddPrice(''); setAddSupplier(''); setAddNote('') }}
                className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${CAT_COLOR[it.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CAT_LABEL[it.category]?.[0]}
                      </span>
                      <span className="text-xs font-mono font-semibold text-gray-800 truncate">{it.itemCode}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{it.itemName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {hasCosts ? (
                      <div className="flex flex-col items-end gap-0.5">
                        {it.costs.slice(0, 2).map(c => (
                          <span key={c.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium ${CUR_COLOR[c.currency] ?? ''}`}>
                            {CUR_SYMBOL[c.currency]}{Number(c.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        ))}
                        {it.costs.length > 2 && (
                          <span className="text-[10px] text-gray-400">+{it.costs.length - 2}건</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic">미등록</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 페이지네이션 */}
        <div className="px-4 py-2 border-t bg-white shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-500">총 {total}건</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}>이전</Button>
            <span className="text-xs text-gray-600 px-1">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}>다음</Button>
          </div>
        </div>
      </div>

      {/* ── 우측: 원가 관리 패널 ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <svg className="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">품목을 선택하세요</p>
              <p className="text-xs text-gray-400 mt-1">좌측 목록에서 품목을 클릭하면 원가를 관리할 수 있습니다</p>
            </div>
          </div>
        ) : (
          <>
            {/* 우측 헤더 */}
            <div className="px-6 py-4 bg-white border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[selectedItem.category] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CAT_LABEL[selectedItem.category] ?? selectedItem.category}
                </span>
                <span className="font-mono font-semibold text-gray-900 text-sm">{selectedItem.itemCode}</span>
                <span className="text-gray-400">—</span>
                <span className="text-sm text-gray-700">{selectedItem.itemName}</span>
                <span className="ml-auto text-xs text-gray-400">단위: {selectedItem.unit}</span>
              </div>
            </div>

            {/* 원가 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">등록된 원가</h3>

              {selectedItem.costs.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-xs">등록된 원가 정보가 없습니다.</p>
                  <p className="text-xs mt-1">아래 폼에서 원가를 추가하세요.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedItem.costs.map(c => (
                    <div key={c.id}
                      className={`rounded-xl border bg-white p-4 transition-all ${editId === c.id ? 'ring-2 ring-blue-300 border-blue-300' : 'hover:border-gray-300'}`}
                    >
                      {editId === c.id ? (
                        /* 수정 폼 */
                        <div className="flex flex-col gap-3">
                          <div className="flex gap-2 flex-wrap">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-gray-500 font-medium">통화</label>
                              <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)}
                                className="h-8 text-xs border rounded-md px-2 bg-white">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] text-gray-500 font-medium">단가</label>
                              <Input type="number" min="0" step="any" value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="h-8 text-xs text-right" placeholder="0" />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] text-gray-500 font-medium">공급업체</label>
                              <Input value={editSupplier} onChange={e => setEditSupplier(e.target.value)}
                                className="h-8 text-xs" placeholder="선택" />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] text-gray-500 font-medium">비고</label>
                              <Input value={editNote} onChange={e => setEditNote(e.target.value)}
                                className="h-8 text-xs" placeholder="선택" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {editPrice && (
                              <span className="text-xs text-gray-500">
                                ₩ {Math.round(Number(editPrice) * (toKRW[editCurrency] ?? 1)).toLocaleString()} (현재 환율 기준)
                              </span>
                            )}
                            <div className="ml-auto flex gap-1">
                              <Button size="sm" className="h-7 text-xs px-3" onClick={handleEditSave} disabled={editSaving}>저장</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditId(null)}>취소</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* 조회 */
                        <div className="flex items-center gap-4">
                          <div className={`flex flex-col items-center justify-center w-16 h-12 rounded-lg border text-xs font-semibold font-mono ${CUR_COLOR[c.currency] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                            <span className="text-lg leading-none">{CUR_SYMBOL[c.currency]}</span>
                            <span className="text-[9px] mt-0.5">{c.currency}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-gray-900 tabular-nums">
                                {Number(c.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                              </span>
                              <span className="text-xs text-gray-500">{c.currency} / {selectedItem.unit}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs font-semibold text-blue-600">
                                ≈ ₩{krwPrice(c).toLocaleString()}
                              </span>
                              {c.supplier && <span className="text-xs text-gray-400">{c.supplier}</span>}
                              {c.note && <span className="text-xs text-gray-400 italic">{c.note}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                              onClick={() => {
                                setEditId(c.id); setEditCurrency(c.currency)
                                setEditPrice(String(c.unitPrice)); setEditSupplier(c.supplier ?? ''); setEditNote(c.note ?? '')
                              }}>수정</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2"
                              onClick={() => handleDelete(c.id)}>삭제</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 원가 추가 폼 */}
            <div className="px-6 py-4 bg-white border-t shrink-0">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">원가 추가</h3>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500">통화</label>
                  <select value={addCurrency} onChange={e => setAddCurrency(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-white">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-32">
                  <label className="text-[10px] text-gray-500">단가 <span className="text-red-400">*</span></label>
                  <Input type="number" min="0" step="any" value={addPrice}
                    onChange={e => setAddPrice(e.target.value)}
                    placeholder="0" className="h-8 text-xs text-right" />
                </div>
                {addPrice && Number(addPrice) > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500">원화 환산</label>
                    <div className="h-8 flex items-center px-3 text-xs font-semibold text-blue-600 bg-blue-50 rounded-md border border-blue-200">
                      ₩{Math.round(Number(addPrice) * (toKRW[addCurrency] ?? 1)).toLocaleString()}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="text-[10px] text-gray-500">공급업체</label>
                  <Input value={addSupplier} onChange={e => setAddSupplier(e.target.value)}
                    placeholder="선택" className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="text-[10px] text-gray-500">비고</label>
                  <Input value={addNote} onChange={e => setAddNote(e.target.value)}
                    placeholder="선택" className="h-8 text-xs" />
                </div>
                <Button size="sm" className="h-8 text-xs px-5 shrink-0"
                  onClick={handleAdd} disabled={addSaving}>
                  {addSaving ? '추가 중...' : '추가'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
