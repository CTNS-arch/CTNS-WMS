'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// ── 타입 ─────────────────────────────────────────────────
interface PurchaseFile {
  id: string; fileName: string; fileUrl: string
  fileType: string | null; fileSize: number | null; uploadedAt: string
}

interface BuyerItem {
  id: string; lineNo: number
  bomNo: string | null; spec: string | null
  quantity: number; unit: string
  currency: string | null; supplyAmount: number | null; taxAmount: number | null
  domestic: string; orderMethod: string; orderNo: string
  plannedShipDate: string; actualShipDate: string
  shippingMethod: string; trackingNo: string; boxCount: string
  remittanceDate: string; paymentDate: string
  buyerCurrency: string; buyerSupplyAmount: string; buyerTaxAmount: string
  additionalCost: string; portArrivalDate: string; loadingDate: string
  estimatedArrivalDate: string; actualReceiptDate: string
  blNo: string; buyerMemo: string
  exchangeRate: string; krwAmount: string; unitPrice: string
}

interface Props {
  open: boolean; request: any
  onClose: () => void; onSaved: (updated: any) => void
}

// ── 상수 ─────────────────────────────────────────────────
type Tab = 'order' | 'logistics' | 'payment' | 'files'
const TABS: { id: Tab; label: string }[] = [
  { id: 'order',     label: '발주 정보' },
  { id: 'logistics', label: '물류 정보' },
  { id: 'payment',   label: '정산 정보' },
  { id: 'files',     label: '첨부 파일' },
]
const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토중', ORDERED: '발주', RECEIVED: '입고완료', REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ORDERED: 'bg-blue-100 text-blue-700 border-blue-200',
  RECEIVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['ORDERED', 'REJECTED'],
  ORDERED: ['RECEIVED', 'REJECTED'],
  RECEIVED: [], REJECTED: ['PENDING'],
}
const NEXT_STATUS_STYLE: Record<string, string> = {
  ORDERED:  'bg-blue-600 hover:bg-blue-700 text-white',
  RECEIVED: 'bg-green-600 hover:bg-green-700 text-white',
  REJECTED: 'bg-red-500 hover:bg-red-600 text-white',
  PENDING:  'bg-gray-600 hover:bg-gray-700 text-white',
}
const FILE_TYPES   = ['견적서', '발주서', '인보이스', '기타']
const DOMESTIC_OPT = ['국내', '해외']
const ORDER_OPT    = ['이메일', '전화', '온라인', '방문']
const SHIP_OPT     = ['해운', '항공', '업체 직배송']
const CURRENCY_OPT = ['KRW', 'USD', 'CNY']

function toDate(d: string | null | undefined) { return d?.slice(0, 10) ?? '' }

// ── 공통 필드 컴포넌트 ────────────────────────────────────
function Field({ label, children, cols = 1 }: {
  label: string; children: React.ReactNode; cols?: 1 | 2 | 3
}) {
  return (
    <div className={cols === 2 ? 'col-span-2' : cols === 3 ? 'col-span-3' : ''}>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = 'w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors'
const selCls = inp + ' appearance-none'
const calcCls = 'w-full h-8 px-2.5 text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-semibold text-right flex items-center justify-end'

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function BuyerDialog({ open, request, onClose, onSaved }: Props) {
  const [items,      setItems]      = useState<BuyerItem[]>([])
  const [files,      setFiles]      = useState<PurchaseFile[]>([])
  const [activeTab,  setActiveTab]  = useState<Tab>('order')
  const [saving,     setSaving]     = useState(false)
  const [dragging,   setDragging]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [fileType,   setFileType]   = useState('기타')
  const [nextStatus, setNextStatus] = useState('')
  const [fetchingRate, setFetchingRate] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const initItems = useCallback((raw: any[]) =>
    setItems(raw.map(it => ({
      id: it.id, lineNo: it.lineNo,
      bomNo: it.bomNo, spec: it.spec,
      quantity: it.quantity, unit: it.unit,
      currency: it.currency, supplyAmount: it.supplyAmount, taxAmount: it.taxAmount,
      domestic: it.domestic ?? '', orderMethod: it.orderMethod ?? '', orderNo: it.orderNo ?? '',
      plannedShipDate: toDate(it.plannedShipDate), actualShipDate: toDate(it.actualShipDate),
      shippingMethod: it.shippingMethod ?? '', trackingNo: it.trackingNo ?? '',
      boxCount: it.boxCount != null ? String(it.boxCount) : '',
      remittanceDate: toDate(it.remittanceDate), paymentDate: toDate(it.paymentDate),
      buyerCurrency: it.buyerCurrency ?? 'KRW',
      buyerSupplyAmount: it.buyerSupplyAmount != null ? String(it.buyerSupplyAmount) : (it.supplyAmount != null ? String(it.supplyAmount) : ''),
      buyerTaxAmount:    it.buyerTaxAmount    != null ? String(it.buyerTaxAmount)    : (it.taxAmount   != null ? String(it.taxAmount)    : ''),
      additionalCost:    it.additionalCost    != null ? String(it.additionalCost)    : '',
      portArrivalDate:   toDate(it.portArrivalDate), loadingDate: toDate(it.loadingDate),
      estimatedArrivalDate: toDate(it.estimatedArrivalDate),
      actualReceiptDate:    toDate(it.actualReceiptDate),
      blNo: it.blNo ?? '', buyerMemo: it.buyerMemo ?? '',
      exchangeRate: it.exchangeRate != null ? String(it.exchangeRate) : '',
      krwAmount:    it.krwAmount    != null ? String(it.krwAmount)    : '',
      unitPrice:    it.unitPrice    != null ? String(it.unitPrice)    : '',
    })))
  , [])

  useEffect(() => {
    if (!open || !request) return
    initItems(request.items ?? [])
    setFiles(request.files ?? [])
    setActiveTab('order')
    setNextStatus('')
  }, [open, request, initItems])

  // ── 필드 업데이트 + 자동 계산 ─────────────────────────
  const upd = (id: string, field: keyof BuyerItem, val: string) =>
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const next = { ...it, [field]: val }
      if (['buyerSupplyAmount','exchangeRate','additionalCost','buyerCurrency'].includes(field)) {
        const amt    = parseFloat(field === 'buyerSupplyAmount' ? val : next.buyerSupplyAmount) || 0
        const rate   = parseFloat(field === 'exchangeRate'      ? val : next.exchangeRate)      || 1
        const add    = parseFloat(field === 'additionalCost'    ? val : next.additionalCost)    || 0
        const cur    = field === 'buyerCurrency' ? val : next.buyerCurrency
        const krw    = cur === 'KRW' ? amt : amt * rate
        const total  = krw + add
        next.krwAmount = krw > 0 ? String(Math.round(krw)) : ''
        next.unitPrice = total > 0 && next.quantity > 0 ? String(Math.round(total / next.quantity)) : ''
      }
      return next
    }))

  const fetchRate = async (id: string, currency: string) => {
    if (currency === 'KRW') { upd(id, 'exchangeRate', ''); return }
    setFetchingRate(id)
    try {
      const res  = await fetch(`https://open.er-api.com/v6/latest/${currency}`)
      const json = await res.json()
      if (json.result === 'success' && json.rates?.KRW) {
        upd(id, 'exchangeRate', String(Math.round(json.rates.KRW)))
        toast.success(`1 ${currency} = ${Math.round(json.rates.KRW).toLocaleString()} KRW`)
      }
    } catch { toast.error('환율 조회 실패') }
    finally { setFetchingRate(null) }
  }

  // ── 저장 ─────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const body: any = {
        buyerItems: items.map(it => ({
          id: it.id,
          domestic: it.domestic, orderMethod: it.orderMethod, orderNo: it.orderNo,
          plannedShipDate: it.plannedShipDate || null, actualShipDate: it.actualShipDate || null,
          shippingMethod: it.shippingMethod, trackingNo: it.trackingNo,
          boxCount: it.boxCount ? Number(it.boxCount) : null,
          remittanceDate: it.remittanceDate || null, paymentDate: it.paymentDate || null,
          buyerCurrency: it.buyerCurrency || null,
          buyerSupplyAmount: it.buyerSupplyAmount ? Number(it.buyerSupplyAmount) : null,
          buyerTaxAmount:    it.buyerTaxAmount    ? Number(it.buyerTaxAmount)    : null,
          additionalCost:    it.additionalCost    ? Number(it.additionalCost)    : null,
          portArrivalDate:      it.portArrivalDate      || null,
          loadingDate:          it.loadingDate          || null,
          estimatedArrivalDate: it.estimatedArrivalDate || null,
          actualReceiptDate:    it.actualReceiptDate    || null,
          blNo: it.blNo, buyerMemo: it.buyerMemo,
          exchangeRate: it.exchangeRate ? Number(it.exchangeRate) : null,
          krwAmount:    it.krwAmount    ? Number(it.krwAmount)    : null,
          unitPrice:    it.unitPrice    ? Number(it.unitPrice)    : null,
        })),
      }
      if (nextStatus) body.status = nextStatus
      const res  = await fetch(`/api/purchases/${request.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      toast.success('저장되었습니다.')
      onSaved({ ...json.data, files })
    } catch (e: any) {
      toast.error(e.message || '저장 실패')
    } finally { setSaving(false) }
  }

  // ── 파일 업로드 ───────────────────────────────────────
  const uploadFiles = async (list: FileList | File[]) => {
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(list).forEach(f => fd.append('files', f))
      fd.append('fileType', fileType)
      const res  = await fetch(`/api/purchases/${request.id}/files`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setFiles(prev => [...prev, ...json.data])
      toast.success(`${json.data.length}개 파일 업로드됨`)
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  const deleteFile = async (fileId: string) => {
    try {
      await fetch(`/api/purchases/${request.id}/files/${fileId}`, { method: 'DELETE' })
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch { toast.error('삭제 실패') }
  }

  const changeFileType = async (fileId: string, ft: string) => {
    await fetch(`/api/purchases/${request.id}/files/${fileId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: ft }),
    })
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, fileType: ft } : f))
  }

  if (!open || !request) return null

  const transitions = NEXT_STATUS[request.status] ?? []

  // ── 탭별 콘텐츠 ──────────────────────────────────────
  const ItemCard = ({ it }: { it: BuyerItem }) => (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* 카드 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
            {it.lineNo}
          </span>
          <span className="font-mono text-xs font-semibold text-gray-700">{it.bomNo ?? '—'}</span>
          {it.spec && <span className="text-xs text-gray-500 truncate max-w-[260px]">{it.spec}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span>{it.quantity.toLocaleString()} {it.unit}</span>
          {it.supplyAmount != null && (
            <span className="font-medium text-gray-500">
              {it.currency ?? 'KRW'} {it.supplyAmount.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* 탭별 본문 */}
      {activeTab === 'order' && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="구분">
              <select value={it.domestic} onChange={e => upd(it.id, 'domestic', e.target.value)} className={selCls}>
                <option value="">—</option>
                {DOMESTIC_OPT.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="주문방식">
              <select value={it.orderMethod} onChange={e => upd(it.id, 'orderMethod', e.target.value)} className={selCls}>
                <option value="">—</option>
                {ORDER_OPT.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="주문번호">
              <input value={it.orderNo} onChange={e => upd(it.id, 'orderNo', e.target.value)} className={inp} placeholder="주문번호 입력" />
            </Field>
          </div>
          <div className="border-t border-dashed border-gray-100 pt-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="결제 통화">
                <select
                  value={it.buyerCurrency}
                  onChange={e => {
                    upd(it.id, 'buyerCurrency', e.target.value)
                    fetchRate(it.id, e.target.value)
                  }}
                  className={selCls}
                >
                  {CURRENCY_OPT.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="환율 (KRW 기준)">
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={it.exchangeRate}
                    onChange={e => upd(it.id, 'exchangeRate', e.target.value)}
                    placeholder={it.buyerCurrency === 'KRW' ? '—' : '자동조회'}
                    disabled={it.buyerCurrency === 'KRW'}
                    className={inp + ' text-right flex-1 disabled:bg-gray-50 disabled:text-gray-300'}
                  />
                  {it.buyerCurrency !== 'KRW' && (
                    <button
                      onClick={() => fetchRate(it.id, it.buyerCurrency)}
                      disabled={fetchingRate === it.id}
                      className="px-2 h-8 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-500 shrink-0 disabled:opacity-50"
                    >
                      {fetchingRate === it.id ? '...' : '조회'}
                    </button>
                  )}
                </div>
              </Field>
              <div />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="공급금액">
                <input type="number" value={it.buyerSupplyAmount} onChange={e => upd(it.id, 'buyerSupplyAmount', e.target.value)} className={inp + ' text-right'} placeholder="0" />
              </Field>
              <Field label="세액">
                <input type="number" value={it.buyerTaxAmount} onChange={e => upd(it.id, 'buyerTaxAmount', e.target.value)} className={inp + ' text-right'} placeholder="0" />
              </Field>
              <Field label="부대비용 (KRW)">
                <input type="number" value={it.additionalCost} onChange={e => upd(it.id, 'additionalCost', e.target.value)} className={inp + ' text-right'} placeholder="0" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <Field label="총액 (공급+세액+부대비용)" cols={2}>
                <div className={calcCls}>
                  {(() => {
                    const t = (Number(it.buyerSupplyAmount) || 0) + (Number(it.buyerTaxAmount) || 0) + (Number(it.additionalCost) || 0)
                    return t > 0 ? t.toLocaleString('ko-KR') + ' KRW' : '—'
                  })()}
                </div>
              </Field>
            </div>
          </div>
          {/* 계산 결과 */}
          {(it.krwAmount || it.unitPrice) && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-100">
              <Field label="원화 환산금액">
                <div className={calcCls}>
                  {it.krwAmount ? Number(it.krwAmount).toLocaleString('ko-KR') + ' KRW' : '—'}
                </div>
              </Field>
              <Field label="품목별 단가">
                <div className={calcCls}>
                  {it.unitPrice ? Number(it.unitPrice).toLocaleString('ko-KR') + ' KRW' : '—'}
                </div>
              </Field>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logistics' && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="출고 예정일">
              <input type="date" value={it.plannedShipDate} onChange={e => upd(it.id, 'plannedShipDate', e.target.value)} className={inp} />
            </Field>
            <Field label="출고일">
              <input type="date" value={it.actualShipDate} onChange={e => upd(it.id, 'actualShipDate', e.target.value)} className={inp} />
            </Field>
            <Field label="운송방법">
              <select value={it.shippingMethod} onChange={e => upd(it.id, 'shippingMethod', e.target.value)} className={selCls}>
                <option value="">—</option>
                {SHIP_OPT.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="송장번호" cols={2}>
              <input value={it.trackingNo} onChange={e => upd(it.id, 'trackingNo', e.target.value)} className={inp} placeholder="송장번호 입력" />
            </Field>
            <Field label="박스 수량">
              <input type="number" value={it.boxCount} onChange={e => upd(it.id, 'boxCount', e.target.value)} className={inp + ' text-right'} placeholder="0" />
            </Field>
          </div>
          <div className="border-t border-dashed border-gray-100 pt-3 grid grid-cols-3 gap-3">
            <Field label="도착 예정일">
              <input type="date" value={it.estimatedArrivalDate} onChange={e => upd(it.id, 'estimatedArrivalDate', e.target.value)} className={inp} />
            </Field>
            <Field label="입고일">
              <input type="date" value={it.actualReceiptDate} onChange={e => upd(it.id, 'actualReceiptDate', e.target.value)} className={inp} />
            </Field>
          </div>
          {it.domestic === '해외' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="항구 도착일">
                <input type="date" value={it.portArrivalDate} onChange={e => upd(it.id, 'portArrivalDate', e.target.value)} className={inp} />
              </Field>
              <Field label="선적일">
                <input type="date" value={it.loadingDate} onChange={e => upd(it.id, 'loadingDate', e.target.value)} className={inp} />
              </Field>
              <div />
              <Field label="BL No." cols={2}>
                <input value={it.blNo} onChange={e => upd(it.id, 'blNo', e.target.value)} className={inp} placeholder="BL 번호 입력" />
              </Field>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="송금일">
              <input type="date" value={it.remittanceDate} onChange={e => upd(it.id, 'remittanceDate', e.target.value)} className={inp} />
            </Field>
            <Field label="결제일">
              <input type="date" value={it.paymentDate} onChange={e => upd(it.id, 'paymentDate', e.target.value)} className={inp} />
            </Field>
          </div>
          <Field label="비고" cols={3}>
            <textarea
              value={it.buyerMemo}
              onChange={e => upd(it.id, 'buyerMemo', e.target.value)}
              rows={2}
              placeholder="구매자 메모"
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </Field>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 960, height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 헤더 ── */}
        <div className="px-6 py-4 border-b shrink-0 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-sm font-bold text-gray-900">구매 처리</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[request.status]}`}>
                  {STATUS_LABEL[request.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {request.documentNo && <span className="font-mono font-semibold text-gray-700">{request.documentNo}</span>}
                {request.requesterName && <span>{request.requesterName}</span>}
                <span>{new Date(request.requestDate ?? request.createdAt).toLocaleDateString('ko-KR')}</span>
                <span className="text-gray-300">|</span>
                <span>품목 {items.length}개</span>
                {files.length > 0 && (
                  <span className="text-purple-600">파일 {files.length}개</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg shrink-0">×</button>
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="flex border-b shrink-0 bg-white px-6 gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'text-purple-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-purple-600 after:rounded-t'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
              {tab.id === 'files' && files.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-semibold">
                  {files.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 탭 본문 ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab !== 'files' ? (
            <div className="p-4 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">품목이 없습니다.</div>
              ) : items.map(it => <ItemCard key={it.id} it={it} />)}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* 파일 유형 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">파일 유형</span>
                <div className="flex gap-1">
                  {FILE_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setFileType(t)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        fileType === t
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-400">선택 후 업로드</span>
              </div>

              {/* 드래그앤드롭 */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragging ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { if (e.target.files?.length) { uploadFiles(e.target.files); e.target.value = '' } }} />
                {uploading ? (
                  <p className="text-sm text-purple-600 font-medium">업로드 중...</p>
                ) : (
                  <>
                    <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, Excel, 이미지 등 모든 형식 지원</p>
                  </>
                )}
              </div>

              {/* 파일 목록 */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 group">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <select
                        value={f.fileType ?? '기타'}
                        onChange={e => changeFileType(f.id, e.target.value)}
                        className="h-6 rounded-md border border-gray-200 bg-white px-1.5 text-[11px] font-medium focus:outline-none shrink-0"
                      >
                        {FILE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-xs text-blue-600 hover:underline truncate">{f.fileName}</a>
                      {f.fileSize && (
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {f.fileSize < 1024 * 1024 ? `${Math.round(f.fileSize / 1024)} KB` : `${(f.fileSize / 1024 / 1024).toFixed(1)} MB`}
                        </span>
                      )}
                      <button onClick={() => deleteFile(f.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div className="px-6 py-4 border-t bg-white shrink-0">
          <div className="flex items-center justify-between">
            {/* 상태 전환 */}
            <div className="flex items-center gap-2">
              {transitions.length > 0 ? (
                <>
                  <span className="text-xs text-gray-400 mr-1">상태 변경</span>
                  {transitions.map(s => (
                    <button
                      key={s}
                      onClick={() => setNextStatus(prev => prev === s ? '' : s)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        nextStatus === s
                          ? NEXT_STATUS_STYLE[s] + ' ring-2 ring-offset-1 ring-current/30'
                          : 'border border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      → {STATUS_LABEL[s]}
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-gray-400">더 이상 상태를 변경할 수 없습니다</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs px-4" onClick={onClose}>닫기</Button>
              <Button
                size="sm"
                className={`h-8 text-xs px-5 ${nextStatus ? NEXT_STATUS_STYLE[nextStatus] : 'bg-gray-900 hover:bg-gray-700'}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '저장 중...' : nextStatus ? `저장 · ${STATUS_LABEL[nextStatus]}` : '저장'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
