'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// ── 타입 ────────────────────────────────────────────────────
type CostRow = { _key: string; type: '공급금액' | '부대비용'; supplyAmount: string; taxAmount: string; memo: string }

interface PurchaseFile {
  id: string; fileName: string; fileUrl: string
  fileType: string | null; fileSize: number | null; uploadedAt: string
}

interface BuyerItem {
  id: string; lineNo: number; itemId: string | null
  bomNo: string | null; spec: string | null; quantity: number; unit: string
  currency: string | null; supplyAmount: number | null; taxAmount: number | null
  // 발주
  domestic: string; supplierName: string; orderMethod: string; orderNo: string
  buyerCurrency: string; exchangeRate: string
  additionalCost: string; buyerSupplyAmount: string; buyerTaxAmount: string
  krwAmount: string; unitPrice: string
  // 물류
  plannedShipDate: string; actualShipDate: string
  shippingMethod: string; trackingNo: string; blNo: string
  boxCount: string; boxUnitQty: string; receiveQty: string
  portArrivalDate: string; loadingDate: string
  estimatedArrivalDate: string; actualReceiptDate: string
  // 정산
  paymentMethod: string
  payBankName: string; payAccountNumber: string; payAccountHolder: string
  remittanceDate: string; paymentDate: string; buyerMemo: string
}

interface Props {
  open: boolean; request: any
  onClose: () => void; onSaved: (updated: any) => void
}

// ── 상수 ────────────────────────────────────────────────────
type Tab = 'order' | 'logistics' | 'payment'
const TABS: { id: Tab; label: string }[] = [
  { id: 'order',     label: '발주 정보' },
  { id: 'logistics', label: '물류 정보' },
  { id: 'payment',   label: '정산 정보' },
]
const STATUS_LABEL: Record<string, string> = {
  PENDING: '요청', APPROVED: '검토중', ORDERED: '주문완료', RECEIVED: '입고완료', REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-[#fffae0] text-[#f59e26] border-[#f59e26]',
  APPROVED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ORDERED:  'bg-blue-100  text-blue-700  border-blue-200',
  RECEIVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100   text-red-700   border-red-200',
}
const NEXT_STATUS: Record<string, string[]> = {
  PENDING:  ['APPROVED', 'REJECTED'],
  APPROVED: ['ORDERED', 'PENDING', 'REJECTED'],
  ORDERED:  ['RECEIVED', 'PENDING', 'REJECTED'],
  RECEIVED: ['PENDING'],
  REJECTED: ['PENDING'],
}
const NEXT_STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  ORDERED:  'bg-blue-600  hover:bg-blue-700  text-white',
  RECEIVED: 'bg-green-600 hover:bg-green-700 text-white',
  REJECTED: 'bg-red-500   hover:bg-red-600   text-white',
  PENDING:  'bg-gray-600  hover:bg-gray-700  text-white',
}
const FILE_TYPES   = ['견적서', '발주서', '인보이스', '기타']
const DOMESTIC_OPT = ['국내', '해외']
const ORDER_OPT    = ['이메일', '전화', '온라인', '방문']
const SHIP_OPT     = ['해운', '항공', '업체직배송 (해외)', '업체직배송 (국내)', '국내택배', '국내화물', '퀵/당일']
const CURRENCY_OPT = ['KRW', 'USD', 'CNY']
const PAYMENT_OPT  = ['계좌이체', '카드', '현금', '어음']

function toDate(d: string | null | undefined) { return d?.slice(0, 10) ?? '' }

// ── UI 헬퍼 ─────────────────────────────────────────────────
function Field({ label, children, cols = 1 }: {
  label: string; children: React.ReactNode; cols?: 1 | 2 | 3
}) {
  return (
    <div className={cols === 2 ? 'col-span-2' : cols === 3 ? 'col-span-3' : ''}>
      {label && (
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

const inp     = 'w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors'

// 드롭다운 화살표 포함 select 래퍼
function Sel({ value, onChange, children, disabled = false }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={inp + ' appearance-none pr-7 disabled:bg-gray-50 disabled:text-gray-300'}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

// 섹션 헤더
function Sec({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// 쉼표 포맷 숫자 입력 (모듈 레벨 — 훅 안정성 보장)
function NumInput({ value, onChange, placeholder = '0', className = '' }: {
  value: string; onChange: (val: string) => void; placeholder?: string; className?: string
}) {
  const [focused, setFocused] = useState(false)
  const raw = value.replace(/,/g, '')
  const display = focused ? raw : (raw ? Number(raw).toLocaleString('ko-KR') : '')
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const v = e.target.value.replace(/,/g, '')
        if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v)
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function BuyerDialog({ open, request, onClose, onSaved }: Props) {
  const [items,           setItems]           = useState<BuyerItem[]>([])
  const [files,           setFiles]           = useState<PurchaseFile[]>([])
  const [costMap,         setCostMap]         = useState<Record<string, CostRow[]>>({})
  const [activeTab,       setActiveTab]       = useState<Tab>('order')
  const [saving,          setSaving]          = useState(false)
  const [dragging,        setDragging]        = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [fileType,        setFileType]        = useState('기타')
  const [nextStatus,      setNextStatus]      = useState('')
  const [fetchingRate,    setFetchingRate]    = useState<string | null>(null)
  const [loadingBankInfo, setLoadingBankInfo] = useState<string | null>(null)
  const [confirmItem,     setConfirmItem]     = useState<BuyerItem | null>(null)
  const [receiving,       setReceiving]       = useState(false)
  const [suppQuery,       setSuppQuery]       = useState<Record<string, string>>({})
  const [suppOpts,        setSuppOpts]        = useState<Record<string, any[]>>({})
  const [suppOpen,        setSuppOpen]        = useState<Record<string, boolean>>({})
  const [showSuppCreate,  setShowSuppCreate]  = useState<string | null>(null)
  const [suppForm,        setSuppForm]        = useState({ companyName: '', region: '', businessRegNo: '', bankName: '', accountNumber: '', accountHolder: '', note: '' })
  const [savingSupp,      setSavingSupp]      = useState(false)
  const fileRef    = useRef<HTMLInputElement>(null)
  const suppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initItems = useCallback((raw: any[]) =>
    setItems(raw.map(it => ({
      id: it.id, lineNo: it.lineNo, itemId: it.itemId ?? null,
      bomNo: it.bomNo, spec: it.spec, quantity: it.quantity, unit: it.unit,
      currency: it.currency, supplyAmount: it.supplyAmount, taxAmount: it.taxAmount,
      domestic:     it.domestic     ?? '',
      supplierName: it.supplier     ?? '',
      orderMethod:  it.orderMethod  ?? '',
      orderNo:      it.orderNo      ?? '',
      buyerCurrency:     it.buyerCurrency ?? 'KRW',
      exchangeRate:      it.exchangeRate      != null ? String(it.exchangeRate)      : '',
      additionalCost:    it.additionalCost    != null ? String(it.additionalCost)    : '',
      buyerSupplyAmount: it.buyerSupplyAmount != null ? String(it.buyerSupplyAmount) : (it.supplyAmount != null ? String(it.supplyAmount) : ''),
      buyerTaxAmount:    it.buyerTaxAmount    != null ? String(it.buyerTaxAmount)    : (it.taxAmount   != null ? String(it.taxAmount)    : ''),
      krwAmount: it.krwAmount != null ? String(it.krwAmount) : '',
      unitPrice: it.unitPrice != null ? String(it.unitPrice) : '',
      plannedShipDate: toDate(it.plannedShipDate), actualShipDate: toDate(it.actualShipDate),
      shippingMethod: it.shippingMethod ?? '', trackingNo: it.trackingNo ?? '', blNo: it.blNo ?? '',
      boxCount:   it.boxCount   != null ? String(it.boxCount)   : '',
      boxUnitQty: it.boxUnitQty != null ? String(it.boxUnitQty) : '',
      receiveQty: String(it.quantity),
      portArrivalDate:      toDate(it.portArrivalDate),
      loadingDate:          toDate(it.loadingDate),
      estimatedArrivalDate: toDate(it.estimatedArrivalDate),
      actualReceiptDate:    toDate(it.actualReceiptDate),
      paymentMethod:    it.paymentMethod    ?? '',
      payBankName:      it.payBankName      ?? '',
      payAccountNumber: it.payAccountNumber ?? '',
      payAccountHolder: it.payAccountHolder ?? '',
      remittanceDate: toDate(it.remittanceDate), paymentDate: toDate(it.paymentDate),
      buyerMemo: it.buyerMemo ?? '',
    })))
  , [])

  useEffect(() => {
    if (!open || !request) return
    initItems(request.items ?? [])
    setFiles(request.files ?? [])
    setActiveTab('order')
    setNextStatus('')
    const initMap: Record<string, CostRow[]> = {}
    for (const it of request.items ?? []) {
      const rows: CostRow[] = []
      if (it.buyerSupplyAmount != null || it.supplyAmount != null) {
        rows.push({
          _key: `s-${it.id}`,
          type: '공급금액',
          supplyAmount: it.buyerSupplyAmount != null ? String(it.buyerSupplyAmount) : (it.supplyAmount != null ? String(it.supplyAmount) : ''),
          taxAmount: it.buyerTaxAmount != null ? String(it.buyerTaxAmount) : (it.taxAmount != null ? String(it.taxAmount) : ''),
          memo: '',
        })
      }
      if (it.additionalCost != null && Number(it.additionalCost) > 0) {
        rows.push({ _key: `a-${it.id}`, type: '부대비용', supplyAmount: String(it.additionalCost), taxAmount: '', memo: '' })
      }
      if (rows.length === 0) {
        rows.push({ _key: `e-${it.id}`, type: '공급금액', supplyAmount: '', taxAmount: '', memo: '' })
      }
      initMap[it.id] = rows
    }
    setCostMap(initMap)
  }, [open, request, initItems])

  // ── 필드 업데이트 ──────────────────────────────────────────
  const upd = (id: string, field: keyof BuyerItem, val: string) =>
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const next = { ...it, [field]: val }
      // 원화 환산 자동계산
      if (['buyerSupplyAmount', 'exchangeRate', 'additionalCost', 'buyerCurrency'].includes(field)) {
        const amt  = parseFloat(field === 'buyerSupplyAmount' ? val : next.buyerSupplyAmount) || 0
        const rate = parseFloat(field === 'exchangeRate'      ? val : next.exchangeRate)      || 1
        const add  = parseFloat(field === 'additionalCost'    ? val : next.additionalCost)    || 0
        const cur  = field === 'buyerCurrency' ? val : next.buyerCurrency
        const krw  = cur === 'KRW' ? amt : amt * rate
        next.krwAmount = krw > 0 ? String(Math.round(krw)) : ''
        next.unitPrice = (krw + add) > 0 && next.quantity > 0
          ? String(Math.round((krw + add) / next.quantity)) : ''
      }
      // 입고수량 자동계산 (박스수량 × 박스별수량)
      if (field === 'boxCount' || field === 'boxUnitQty') {
        const boxes  = parseFloat(field === 'boxCount'   ? val : next.boxCount)   || 0
        const perBox = parseFloat(field === 'boxUnitQty' ? val : next.boxUnitQty) || 0
        if (boxes > 0 && perBox > 0) next.receiveQty = String(boxes * perBox)
      }
      return next
    }))

  // ── 환율 조회 ──────────────────────────────────────────────
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

  // ── 공급처 은행정보 불러오기 ──────────────────────────────
  const loadBankInfo = async (itemId: string, supplierName: string) => {
    if (!supplierName.trim()) { toast.error('공급처를 먼저 입력해주세요.'); return }
    setLoadingBankInfo(itemId)
    try {
      const res  = await fetch(`/api/suppliers?search=${encodeURIComponent(supplierName.trim())}&limit=1`)
      const json = await res.json()
      if (json.success && json.data.suppliers[0]) {
        const s = json.data.suppliers[0]
        setItems(prev => prev.map(it =>
          it.id !== itemId ? it : {
            ...it,
            payBankName:      s.bankName      ?? it.payBankName,
            payAccountNumber: s.accountNumber ?? it.payAccountNumber,
            payAccountHolder: s.accountHolder ?? it.payAccountHolder,
          }
        ))
        toast.success('공급처 정보를 불러왔습니다.')
      } else {
        toast.error('해당 공급처를 찾을 수 없습니다.')
      }
    } catch { toast.error('공급처 정보 조회 실패') }
    finally { setLoadingBankInfo(null) }
  }

  // ── 공급처 검색 ───────────────────────────────────────────
  const searchSuppliers = (itemId: string, query: string) => {
    setSuppQuery(prev => ({ ...prev, [itemId]: query }))
    if (suppTimerRef.current) clearTimeout(suppTimerRef.current)
    if (!query.trim()) {
      setSuppOpts(prev => ({ ...prev, [itemId]: [] }))
      setSuppOpen(prev => ({ ...prev, [itemId]: false }))
      return
    }
    suppTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/suppliers?search=${encodeURIComponent(query)}&limit=6`)
        const json = await res.json()
        if (json.success) {
          setSuppOpts(prev => ({ ...prev, [itemId]: json.data.suppliers ?? [] }))
          setSuppOpen(prev => ({ ...prev, [itemId]: true }))
        }
      } catch {}
    }, 300)
  }

  // ── 공급처 생성 ───────────────────────────────────────────
  const createSupplier = async (itemId: string) => {
    if (!suppForm.companyName.trim()) { toast.error('업체명을 입력해주세요.'); return }
    setSavingSupp(true)
    try {
      const res  = await fetch('/api/suppliers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suppForm),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      upd(itemId, 'supplierName', json.data.companyName)
      setSuppQuery(prev => { const n = { ...prev }; delete n[itemId]; return n })
      setShowSuppCreate(null)
      setSuppForm({ companyName: '', region: '', businessRegNo: '', bankName: '', accountNumber: '', accountHolder: '', note: '' })
      toast.success('공급처가 등록되었습니다.')
    } catch (e: any) { toast.error(e.message || '공급처 등록 실패') }
    finally { setSavingSupp(false) }
  }

  // ── 재고 입고 ──────────────────────────────────────────────
  const doReceive = async (it: BuyerItem) => {
    setConfirmItem(null)
    if (!it.itemId) {
      toast.error('품목이 ERP 품목과 연결되지 않아 재고 입고를 진행할 수 없습니다.')
      return
    }
    if (!it.receiveQty || Number(it.receiveQty) <= 0) {
      toast.error('총 수량을 입력해주세요.')
      return
    }
    const dept = request.department === '연구소' ? 'LAB' : 'PRODUCTION'
    const deptLabel = dept === 'LAB' ? '연구소' : '생산구매팀'
    const todayStr = new Date().toISOString().slice(0, 10)
    setReceiving(true)
    try {
      const stockRes = await fetch('/api/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: it.itemId, department: dept, type: 'IN',
          quantity: Number(it.receiveQty),
          memo: `구매요청 ${request.documentNo ?? request.id} 입고`,
          unitCost: it.unitPrice ? Number(it.unitPrice) : null,
          currency: 'KRW',
        }),
      })
      const stockJson = await stockRes.json()
      if (!stockJson.success) throw new Error(stockJson.message)

      // actualReceiptDate를 DB에 저장하기 위해 buyerItems와 함께 PATCH
      const receiptDate = it.actualReceiptDate || todayStr

      // krwAmount: 저장된 값 우선, 없으면 buyerSupplyAmount로 환산
      function resolveKrwAmount(item: BuyerItem): number | null {
        if (item.krwAmount) return Number(item.krwAmount)
        const sa  = item.buyerSupplyAmount ? Number(item.buyerSupplyAmount) : null
        if (sa == null) return null
        const cur = item.buyerCurrency || 'KRW'
        if (cur === 'KRW') return sa
        const rate = item.exchangeRate ? Number(item.exchangeRate) : null
        return rate ? Math.round(sa * rate) : null
      }

      const patchRes = await fetch(`/api/purchases/${request.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RECEIVED',
          buyerItems: items.map(item => {
            const krwAmount = resolveKrwAmount(item)
            const add       = item.additionalCost ? Number(item.additionalCost) : 0
            const unitPrice = krwAmount != null && item.quantity > 0
              ? Math.round((krwAmount + add) / item.quantity)
              : (item.unitPrice ? Number(item.unitPrice) : null)
            return {
              id: item.id,
              supplier:            item.supplierName || null,
              domestic:            item.domestic,
              orderMethod:         item.orderMethod,
              orderNo:             item.orderNo,
              plannedShipDate:     item.plannedShipDate || null,
              actualShipDate:      item.actualShipDate  || null,
              shippingMethod:      item.shippingMethod,
              trackingNo:          item.trackingNo,
              blNo:                item.blNo,
              boxCount:            item.boxCount    ? Number(item.boxCount)    : null,
              boxUnitQty:          item.boxUnitQty  ? Number(item.boxUnitQty)  : null,
              portArrivalDate:     item.portArrivalDate      || null,
              loadingDate:         item.loadingDate          || null,
              estimatedArrivalDate:item.estimatedArrivalDate || null,
              actualReceiptDate:   item.id === it.id ? receiptDate : (item.actualReceiptDate || null),
              buyerCurrency:       item.buyerCurrency     || null,
              exchangeRate:        item.exchangeRate      ? Number(item.exchangeRate)      : null,
              additionalCost:      add || null,
              buyerSupplyAmount:   item.buyerSupplyAmount ? Number(item.buyerSupplyAmount) : null,
              buyerTaxAmount:      item.buyerTaxAmount    ? Number(item.buyerTaxAmount)    : null,
              krwAmount,
              unitPrice,
              paymentMethod:       item.paymentMethod    || null,
              payBankName:         item.payBankName      || null,
              payAccountNumber:    item.payAccountNumber || null,
              payAccountHolder:    item.payAccountHolder || null,
              remittanceDate:      item.remittanceDate || null,
              paymentDate:         item.paymentDate    || null,
              buyerMemo:           item.buyerMemo,
            }
          }),
        }),
      })
      const patchJson = await patchRes.json()
      if (patchJson.success) onSaved({ ...patchJson.data, files })

      toast.success(`[${deptLabel}] 재고 입고 완료 (+${Number(it.receiveQty).toLocaleString()} ${it.unit})`)
      if (!it.actualReceiptDate)
        upd(it.id, 'actualReceiptDate', todayStr)
    } catch (e: any) { toast.error(e.message || '재고 입고 실패') }
    finally { setReceiving(false) }
  }

  // ── 저장 ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const body: any = {
        buyerItems: items.map(it => ({
          id: it.id,
          supplier:     it.supplierName || null,
          domestic:     it.domestic,
          orderMethod:  it.orderMethod, orderNo: it.orderNo,
          plannedShipDate: it.plannedShipDate || null, actualShipDate: it.actualShipDate || null,
          shippingMethod: it.shippingMethod, trackingNo: it.trackingNo, blNo: it.blNo,
          boxCount:   it.boxCount   ? Number(it.boxCount)   : null,
          boxUnitQty: it.boxUnitQty ? Number(it.boxUnitQty) : null,
          portArrivalDate:      it.portArrivalDate      || null,
          loadingDate:          it.loadingDate          || null,
          estimatedArrivalDate: it.estimatedArrivalDate || null,
          actualReceiptDate:    it.actualReceiptDate    || null,
          buyerCurrency:     it.buyerCurrency     || null,
          exchangeRate:      it.exchangeRate      ? Number(it.exchangeRate)      : null,
          additionalCost:    it.additionalCost    ? Number(it.additionalCost)    : null,
          buyerSupplyAmount: it.buyerSupplyAmount ? Number(it.buyerSupplyAmount) : null,
          buyerTaxAmount:    it.buyerTaxAmount    ? Number(it.buyerTaxAmount)    : null,
          krwAmount: it.krwAmount ? Number(it.krwAmount) : null,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
          paymentMethod:    it.paymentMethod    || null,
          payBankName:      it.payBankName      || null,
          payAccountNumber: it.payAccountNumber || null,
          payAccountHolder: it.payAccountHolder || null,
          remittanceDate: it.remittanceDate || null, paymentDate: it.paymentDate || null,
          buyerMemo: it.buyerMemo,
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
    } catch (e: any) { toast.error(e.message || '저장 실패') }
    finally { setSaving(false) }
  }

  // ── 파일 업로드 ───────────────────────────────────────────
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

  // ── 환율/금액 공통 블록 (발주·정산 공유) ─────────────────
  const AmountBlock = ({ it }: { it: BuyerItem }) => {
    const rows = costMap[it.id] ?? []
    const supplyTotal = rows.filter(r => r.type === '공급금액').reduce((s, r) => s + (parseFloat(r.supplyAmount) || 0), 0)
    const addTotal    = rows.filter(r => r.type === '부대비용').reduce((s, r) => s + (parseFloat(r.supplyAmount) || 0), 0)
    const taxTotal    = rows.reduce((s, r) => s + (parseFloat(r.taxAmount) || 0), 0)

    function applyAgg(newRows: CostRow[]) {
      const sTotal = newRows.filter(r => r.type === '공급금액').reduce((s, r) => s + (parseFloat(r.supplyAmount) || 0), 0)
      const aTotal = newRows.filter(r => r.type === '부대비용').reduce((s, r) => s + (parseFloat(r.supplyAmount) || 0), 0)
      const tTotal = newRows.reduce((s, r) => s + (parseFloat(r.taxAmount) || 0), 0)
      setItems(prev => prev.map(item => {
        if (item.id !== it.id) return item
        const rate = parseFloat(item.exchangeRate) || 1
        const krw  = item.buyerCurrency === 'KRW' ? sTotal : sTotal * rate
        return {
          ...item,
          buyerSupplyAmount: sTotal > 0 ? String(sTotal) : '',
          additionalCost:    aTotal > 0 ? String(aTotal) : '',
          buyerTaxAmount:    tTotal > 0 ? String(tTotal) : '',
          krwAmount:  (krw + aTotal) > 0 ? String(Math.round(krw)) : '',
          unitPrice:  (krw + aTotal) > 0 && item.quantity > 0 ? String(Math.round((krw + aTotal) / item.quantity)) : '',
        }
      }))
    }

    function addRow() {
      const newRows = [...rows, { _key: String(Date.now()), type: '공급금액' as const, supplyAmount: '', taxAmount: '', memo: '' }]
      setCostMap(prev => ({ ...prev, [it.id]: newRows }))
    }

    function updRow(key: string, field: keyof CostRow, val: string) {
      const newRows = rows.map(r => r._key === key ? { ...r, [field]: val } : r)
      setCostMap(prev => ({ ...prev, [it.id]: newRows }))
      applyAgg(newRows)
      // 마지막 행에 데이터 입력 시 빈 행 자동 추가
      const last = newRows[newRows.length - 1]
      if (last._key === key && (last.supplyAmount || last.taxAmount || last.memo)) {
        const withNew = [...newRows, { _key: String(Date.now()), type: '공급금액' as const, supplyAmount: '', taxAmount: '', memo: '' }]
        setCostMap(prev => ({ ...prev, [it.id]: withNew }))
      }
    }

    function delRow(key: string) {
      const newRows = rows.filter(r => r._key !== key)
      setCostMap(prev => ({ ...prev, [it.id]: newRows }))
      applyAgg(newRows)
    }

    const grandTotal = supplyTotal + addTotal + taxTotal
    const cur = it.buyerCurrency || 'KRW'

    return (
      <div className="space-y-3">
        {/* 결제 통화 + 환율 (표 위) */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="결제 통화">
            <Sel value={it.buyerCurrency} onChange={e => { upd(it.id, 'buyerCurrency', e.target.value); fetchRate(it.id, e.target.value) }}>
              {CURRENCY_OPT.map(o => <option key={o}>{o}</option>)}
            </Sel>
          </Field>
          <Field label={it.buyerCurrency !== 'KRW' ? `환율 (1 ${it.buyerCurrency} → KRW)` : '환율(KRW)'}>
            <div className="flex gap-1">
              <input type="number" value={it.exchangeRate}
                onChange={e => upd(it.id, 'exchangeRate', e.target.value)}
                placeholder={it.buyerCurrency === 'KRW' ? '—' : '자동조회'}
                disabled={it.buyerCurrency === 'KRW'}
                className={inp + ' text-right flex-1 disabled:bg-gray-50 disabled:text-gray-300'} />
              {it.buyerCurrency !== 'KRW' && (
                <button onClick={() => fetchRate(it.id, it.buyerCurrency)}
                  disabled={fetchingRate === it.id}
                  className="px-2 h-8 rounded-lg border border-[#e6e6e6] bg-[#fafafa] hover:bg-gray-100 text-xs text-[#6b7078] shrink-0 disabled:opacity-50">
                  {fetchingRate === it.id ? '…' : '조회'}
                </button>
              )}
            </div>
          </Field>
        </div>

        {/* 금액 테이블 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#e6e6e6]">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#6b7078] w-28">항목</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#6b7078] w-36">공급가액</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#6b7078] w-28">세액</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[#6b7078]">비고</th>
                <th className="px-2 py-2 w-7" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row._key} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <select value={row.type} onChange={e => updRow(row._key, 'type', e.target.value)}
                        className="h-7 w-full rounded-lg border border-[#e6e6e6] text-xs pl-2 pr-6 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none">
                        <option value="공급금액">물품금액</option>
                        <option value="부대비용">부대비용</option>
                      </select>
                      <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9ea1a3]"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput value={row.supplyAmount} onChange={v => updRow(row._key, 'supplyAmount', v)}
                      className="h-7 w-full rounded-lg border border-[#e6e6e6] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-purple-400 text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput value={row.taxAmount} onChange={v => updRow(row._key, 'taxAmount', v)}
                      className="h-7 w-full rounded-lg border border-[#e6e6e6] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-purple-400 text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.memo}
                      onChange={e => updRow(row._key, 'memo', e.target.value)}
                      className="h-7 w-full rounded-lg border border-[#e6e6e6] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="비고 입력" />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => delRow(row._key)}
                      className="w-6 h-6 rounded bg-white border border-white text-[#d1d1d1] hover:text-red-400 hover:border-red-100 text-sm flex items-center justify-center mx-auto transition-colors">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#e6e6e6] bg-[#fffaf0]">
                <td className="px-3 py-2 text-[10px] font-bold text-[#b45309]">합계</td>
                <td className="px-3 py-2 text-xs font-bold text-[#92400e] tabular-nums">
                  {supplyTotal > 0 ? supplyTotal.toLocaleString('ko-KR') : '—'}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-[#92400e] tabular-nums">
                  {taxTotal > 0 ? taxTotal.toLocaleString('ko-KR') : '—'}
                </td>
                <td className="px-3 py-2" colSpan={2}>
                  <span className="text-[10px] font-bold text-[#b45309] mr-2">총 합계</span>
                  <span className="text-xs font-bold text-[#92400e] tabular-nums">
                    {grandTotal > 0 ? grandTotal.toLocaleString('ko-KR') + ' ' + cur : '—'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  // ── 품목 카드 ─────────────────────────────────────────────
  const ItemCard = ({ it }: { it: BuyerItem }) => (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
            {it.lineNo}
          </span>
          <span className="font-mono text-xs font-semibold text-gray-700 shrink-0">{it.bomNo ?? '—'}</span>
          {it.spec && <span className="text-xs text-gray-400 truncate">{it.spec}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-medium">{it.quantity.toLocaleString()} {it.unit}</span>
        </div>
      </div>

      {/* ── 발주 정보 ── */}
      {activeTab === 'order' && (
        <div className="p-4 space-y-4">
          <div>
            <Sec label="주문" color="text-gray-500" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="구분">
                <Sel value={it.domestic} onChange={e => upd(it.id, 'domestic', e.target.value)}>
                  <option value="">선택하세요</option>
                  {DOMESTIC_OPT.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </Field>
              <Field label="공급처">
                <div className="relative">
                  <input
                    value={suppQuery[it.id] !== undefined ? suppQuery[it.id] : it.supplierName}
                    onChange={e => searchSuppliers(it.id, e.target.value)}
                    onFocus={() => {
                      const q = suppQuery[it.id] !== undefined ? suppQuery[it.id] : it.supplierName
                      if (q.trim() && (suppOpts[it.id]?.length ?? 0) > 0) {
                        setSuppOpen(prev => ({ ...prev, [it.id]: true }))
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        const q = suppQuery[it.id]
                        if (q !== undefined) {
                          upd(it.id, 'supplierName', q)
                          setSuppQuery(prev => { const n = { ...prev }; delete n[it.id]; return n })
                        }
                        setSuppOpen(prev => ({ ...prev, [it.id]: false }))
                      }, 150)
                    }}
                    className={inp}
                    placeholder="공급처 검색"
                  />
                  {suppOpen[it.id] && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {(suppOpts[it.id] ?? []).map(s => (
                        <button key={s.id} type="button"
                          onMouseDown={() => {
                            upd(it.id, 'supplierName', s.companyName)
                            setSuppQuery(prev => { const n = { ...prev }; delete n[it.id]; return n })
                            setSuppOpen(prev => ({ ...prev, [it.id]: false }))
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b last:border-0 border-gray-100">
                          <span className="font-medium">{s.companyName}</span>
                          {s.region && <span className="ml-1.5 text-[10px] text-gray-400">{s.region}</span>}
                        </button>
                      ))}
                      <button type="button"
                        onMouseDown={() => {
                          setSuppOpen(prev => ({ ...prev, [it.id]: false }))
                          setSuppForm(prev => ({ ...prev, companyName: suppQuery[it.id] ?? '' }))
                          setShowSuppCreate(it.id)
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-[#9445e5] font-medium hover:bg-purple-50 border-t border-gray-100">
                        + 새 공급처 등록
                      </button>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="주문방식">
                <Sel value={it.orderMethod} onChange={e => upd(it.id, 'orderMethod', e.target.value)}>
                  <option value="">선택하세요</option>
                  {ORDER_OPT.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </Field>
              <Field label="주문번호">
                <input value={it.orderNo} onChange={e => upd(it.id, 'orderNo', e.target.value)} className={inp} placeholder="주문번호 입력" />
              </Field>
            </div>
          </div>
          <div>
            <Sec label="금액" color="text-amber-500" />
            <AmountBlock it={it} />
          </div>
          {it.id === items[items.length - 1]?.id && (
            <div>
              <Sec label="첨부파일" color="text-[#f59e26]" />
              <div className="space-y-2.5">
                {/* 파일 유형 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-[#9ea1a3] shrink-0">파일 유형</span>
                  {FILE_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setFileType(t)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                        fileType === t
                          ? 'bg-[#9445e5] text-white border-[#9445e5]'
                          : 'border-[#e6e6e6] text-[#6b7078] hover:border-[#9445e5] hover:text-[#9445e5]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {/* 업로드 영역 */}
                <div
                  className={`border border-dashed rounded-lg py-5 text-center cursor-pointer transition-all ${
                    dragging ? 'border-[#9445e5] bg-[#faf5ff]' : 'border-[#d1d1d1] bg-[#fafafa] hover:border-[#9445e5]'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files) }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) { uploadFiles(e.target.files); e.target.value = '' } }} />
                  {uploading ? (
                    <p className="text-xs text-[#9445e5] font-medium">업로드 중...</p>
                  ) : (
                    <p className="text-xs text-[#9ea1a3]">
                      파일을 여기에 드래그하거나 <span className="text-[#9445e5] font-medium">클릭하여 업로드</span>
                    </p>
                  )}
                </div>
                {/* 파일 목록 */}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map(f => (
                      <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 group">
                        <div className="relative shrink-0">
                          <select
                            value={f.fileType ?? '기타'}
                            onChange={e => changeFileType(f.id, e.target.value)}
                            className="h-6 rounded border border-gray-200 bg-white pl-1.5 pr-5 text-[11px] font-medium focus:outline-none appearance-none"
                          >
                            {FILE_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <svg className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-xs text-blue-600 hover:underline truncate">{f.fileName}</a>
                        {f.fileSize && (
                          <span className="text-[11px] text-gray-400 shrink-0">
                            {f.fileSize < 1024 * 1024
                              ? `${Math.round(f.fileSize / 1024)} KB`
                              : `${(f.fileSize / 1024 / 1024).toFixed(1)} MB`}
                          </span>
                        )}
                        <button
                          onClick={() => deleteFile(f.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 물류 정보 ── */}
      {activeTab === 'logistics' && (
        <div className="p-4 space-y-4">
          {/* 출고 */}
          <div>
            <Sec label="출고" color="text-blue-500" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="출고 예정일">
                <input type="date" value={it.plannedShipDate} onChange={e => upd(it.id, 'plannedShipDate', e.target.value)} className={inp} />
              </Field>
              <Field label="출고일">
                <input type="date" value={it.actualShipDate} onChange={e => upd(it.id, 'actualShipDate', e.target.value)} className={inp} />
              </Field>
            </div>
          </div>

          {/* 운송 */}
          <div>
            <Sec label="운송" color="text-indigo-500" />
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-3">
                <Field label="운송방법">
                  <Sel value={it.shippingMethod} onChange={e => upd(it.id, 'shippingMethod', e.target.value)}>
                    <option value="">선택하세요</option>
                    {SHIP_OPT.map(o => <option key={o}>{o}</option>)}
                  </Sel>
                </Field>
                <Field label="송장번호">
                  <input value={it.trackingNo} onChange={e => upd(it.id, 'trackingNo', e.target.value)} className={inp} placeholder="송장번호 입력" />
                </Field>
                <Field label="BL No.">
                  <input value={it.blNo} onChange={e => upd(it.id, 'blNo', e.target.value)} className={inp} placeholder="BL 번호 입력" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="박스 수량">
                  <input type="number" value={it.boxCount} onChange={e => upd(it.id, 'boxCount', e.target.value)} className={inp + ' text-right'} placeholder="0" />
                </Field>
                <Field label="박스별 수량">
                  <input type="number" value={it.boxUnitQty} onChange={e => upd(it.id, 'boxUnitQty', e.target.value)} className={inp + ' text-right'} placeholder="0" />
                </Field>
                <Field label="총 수량">
                  <div className="flex gap-1">
                    <input
                      type="number" min="0"
                      value={it.receiveQty}
                      onChange={e => upd(it.id, 'receiveQty', e.target.value)}
                      className={inp + ' text-right flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmItem(it)}
                      disabled={!it.itemId || !it.receiveQty || Number(it.receiveQty) <= 0 || receiving}
                      className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {receiving ? '처리중…' : '입고 확정'}
                    </button>
                  </div>
                  {!it.itemId && (
                    <p className="text-[10px] text-amber-500 mt-0.5">품목 연결 필요</p>
                  )}
                </Field>
              </div>
            </div>
          </div>

          {/* 입고 */}
          <div>
            <Sec label="입고" color="text-green-600" />
            <div className="space-y-2.5">
              {it.domestic === '해외' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="항구 도착일">
                    <input type="date" value={it.portArrivalDate} onChange={e => upd(it.id, 'portArrivalDate', e.target.value)} className={inp} />
                  </Field>
                  <Field label="선적일">
                    <input type="date" value={it.loadingDate} onChange={e => upd(it.id, 'loadingDate', e.target.value)} className={inp} />
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="도착 예정일">
                  <input type="date" value={it.estimatedArrivalDate} onChange={e => upd(it.id, 'estimatedArrivalDate', e.target.value)} className={inp} />
                </Field>
                <Field label="실입고일">
                  <input type="date" value={it.actualReceiptDate} onChange={e => upd(it.id, 'actualReceiptDate', e.target.value)} className={inp} />
                </Field>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 정산 정보 ── */}
      {activeTab === 'payment' && (
        <div className="p-4 space-y-4">
          {/* 결제 방식 */}
          <div>
            <Sec label="결제 방식" color="text-purple-500" />
            <div className="grid grid-cols-1 gap-3">
              <Field label="구분">
                <Sel value={it.paymentMethod} onChange={e => upd(it.id, 'paymentMethod', e.target.value)}>
                  <option value="">선택하세요</option>
                  {PAYMENT_OPT.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </Field>
            </div>
          </div>

          {/* 금액 (공유 블록) */}
          <div>
            <Sec label="금액" color="text-amber-500" />
            <AmountBlock it={it} />
          </div>

          {/* 계좌 정보 (계좌이체 시) */}
          {it.paymentMethod === '계좌이체' && (
            <div>
              <Sec label="계좌 정보" color="text-blue-500" />
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="은행" cols={2}>
                    <div className="flex gap-1">
                      <input
                        value={it.payBankName}
                        onChange={e => upd(it.id, 'payBankName', e.target.value)}
                        className={inp + ' flex-1'}
                        placeholder="은행명"
                      />
                      <button
                        onClick={() => loadBankInfo(it.id, it.supplierName)}
                        disabled={loadingBankInfo === it.id}
                        className="px-2 h-8 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-[11px] text-gray-500 shrink-0 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loadingBankInfo === it.id ? '…' : '불러오기'}
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="계좌번호">
                    <input value={it.payAccountNumber} onChange={e => upd(it.id, 'payAccountNumber', e.target.value)} className={inp} placeholder="계좌번호" />
                  </Field>
                  <Field label="예금주">
                    <input value={it.payAccountHolder} onChange={e => upd(it.id, 'payAccountHolder', e.target.value)} className={inp} placeholder="예금주" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* 정산 일정 */}
          <div>
            <Sec label="정산 일정" color="text-gray-400" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="송금일">
                <input type="date" value={it.remittanceDate} onChange={e => upd(it.id, 'remittanceDate', e.target.value)} className={inp} />
              </Field>
              <Field label="결제일">
                <input type="date" value={it.paymentDate} onChange={e => upd(it.id, 'paymentDate', e.target.value)} className={inp} />
              </Field>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <Sec label="메모" color="text-gray-400" />
            <textarea
              value={it.buyerMemo}
              onChange={e => upd(it.id, 'buyerMemo', e.target.value)}
              rows={3}
              placeholder="구매자 메모"
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  )

  // ── 렌더 ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 960, height: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
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
                {files.length > 0 && <span className="text-purple-600">파일 {files.length}개</span>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-2xl bg-[#f5f5f5] text-[#9ea1a3] hover:text-gray-700 hover:bg-gray-200 text-lg shrink-0">×</button>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-[#e6e6e6] shrink-0 bg-white px-6">
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
            </button>
          ))}
        </div>

        {/* 탭 본문 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">품목이 없습니다.</div>
            ) : items.map(it => <ItemCard key={it.id} it={it} />)}

          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 border-t border-[#e6e6e6] bg-[#fafafa] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {transitions.length > 0 ? (
                <>
                  <span className="text-[10px] text-[#9ea1a3] mr-1">상태 변경</span>
                  {transitions.map(s => (
                    <button
                      key={s}
                      onClick={() => setNextStatus(prev => prev === s ? '' : s)}
                      className={`h-9 px-4 rounded-lg text-xs font-medium transition-all ${
                        nextStatus === s
                          ? NEXT_STATUS_STYLE[s]
                          : 'border border-[#9ea1a3] text-[#6b7078] bg-white hover:bg-gray-50'
                      }`}
                    >
                      → {STATUS_LABEL[s]}
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-[#9ea1a3]">더 이상 상태를 변경할 수 없습니다</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="h-9 px-5 rounded-lg border border-[#9ea1a3] text-xs font-medium text-[#6b7078] bg-white hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`h-9 px-5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                  nextStatus ? NEXT_STATUS_STYLE[nextStatus] : 'bg-black hover:bg-gray-800'
                }`}
              >
                {saving ? '저장 중...' : nextStatus ? `저장 · ${STATUS_LABEL[nextStatus]}` : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 공급처 등록 모달 ─────────────────────────────────── */}
      {showSuppCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowSuppCreate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">새 공급처 등록</h3>
              <button onClick={() => setShowSuppCreate(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-sm">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">업체명 <span className="text-red-400 normal-case">*</span></label>
                <input value={suppForm.companyName} onChange={e => setSuppForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className={inp} placeholder="업체명 입력" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">지역</label>
                  <input value={suppForm.region} onChange={e => setSuppForm(prev => ({ ...prev, region: e.target.value }))}
                    className={inp} placeholder="지역" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">사업자번호</label>
                  <input value={suppForm.businessRegNo} onChange={e => setSuppForm(prev => ({ ...prev, businessRegNo: e.target.value }))}
                    className={inp} placeholder="000-00-00000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">은행</label>
                  <input value={suppForm.bankName} onChange={e => setSuppForm(prev => ({ ...prev, bankName: e.target.value }))}
                    className={inp} placeholder="은행명" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">예금주</label>
                  <input value={suppForm.accountHolder} onChange={e => setSuppForm(prev => ({ ...prev, accountHolder: e.target.value }))}
                    className={inp} placeholder="예금주" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">계좌번호</label>
                <input value={suppForm.accountNumber} onChange={e => setSuppForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                  className={inp} placeholder="계좌번호" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">메모</label>
                <input value={suppForm.note} onChange={e => setSuppForm(prev => ({ ...prev, note: e.target.value }))}
                  className={inp} placeholder="메모" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowSuppCreate(null)}
                className="flex-1 h-9 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                취소
              </button>
              <button onClick={() => createSupplier(showSuppCreate)} disabled={savingSupp}
                className="flex-1 h-9 rounded-lg bg-[#9445e5] hover:bg-purple-700 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                {savingSupp ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 입고 확정 확인 모달 ──────────────────────────────── */}
      {confirmItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <h3 className="text-sm font-bold text-gray-900">입고 확정</h3>
            </div>
            <div className="mb-5 space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">품목</span>
                <span className="font-medium text-gray-800 truncate max-w-[160px]">{confirmItem.spec ?? confirmItem.bomNo ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">수량</span>
                <span className="font-semibold text-emerald-700">+{Number(confirmItem.receiveQty).toLocaleString()} {confirmItem.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">입고 부서</span>
                <span className="font-medium">{request.department === '연구소' ? '연구소' : '생산구매팀'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-5">재고를 입고 처리하고 상태를 <strong>입고완료</strong>로 변경합니다. 계속하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 h-9 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => doReceive(confirmItem)}
                className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
              >
                입고 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
