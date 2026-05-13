'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getOptions } from '@/lib/select-options'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import BuyerDialog from '@/components/purchases/BuyerDialog'
import MiscPurchaseDialog from '@/components/purchases/MiscPurchaseDialog'
import MiscBuyerDialog from '@/components/purchases/MiscBuyerDialog'
import MiscReceiveDialog from '@/components/purchases/MiscReceiveDialog'
import MiscReceiveViewDialog from '@/components/purchases/MiscReceiveViewDialog'
import ItemFormDialog from '@/components/items/ItemFormDialog'

// ── 상수 ──────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  PENDING: '요청', APPROVED: '검토중', ORDERED: '주문완료', RECEIVED: '입고완료', REJECTED: '반려',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700 border border-amber-200',
  APPROVED: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  ORDERED:  'bg-blue-100 text-blue-700 border border-blue-200',
  RECEIVED: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-red-100 text-red-500 border border-red-200',
}
const STATUS_STRIPE: Record<string, string> = {
  PENDING:  'bg-amber-400',
  APPROVED: 'bg-indigo-500',
  ORDERED:  'bg-blue-500',
  RECEIVED: 'bg-emerald-500',
  REJECTED: 'bg-red-400',
}
const DOMESTIC_CHIP: Record<string, string> = {
  '국내': 'bg-teal-100 text-teal-700 border border-teal-200',
  '해외': 'bg-sky-100 text-sky-700 border border-sky-200',
}

const STATUS_ROW: Record<string, string> = {
  PENDING:  '',
  APPROVED: 'bg-indigo-50/30',
  ORDERED:  'bg-blue-50/20',
  RECEIVED: 'bg-emerald-50/20',
  REJECTED: 'bg-red-50/10',
}
const FILTER_PILLS_MISC: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '요청' },
  { value: 'ORDERED', label: '주문완료' },
  { value: 'RECEIVED', label: '입고완료' },
  { value: 'REJECTED', label: '반려' },
]
const FILTER_PILLS_DEPT: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '요청' },
  { value: 'APPROVED', label: '검토중' },
  { value: 'ORDERED', label: '주문완료' },
  { value: 'RECEIVED', label: '입고완료' },
  { value: 'REJECTED', label: '반려' },
]
const DEPT_TABS = [
  { value: '생산구매팀', label: '생산구매팀' },
  { value: '연구소', label: '연구소' },
  { value: '연구비', label: '연구비' },
]
const DEPT_OPTIONS       = ['생산구매팀', '연구소']
const CURRENCY_OPTIONS   = ['KRW', 'USD', 'CNY']
const DELIVERY_LOCATIONS = ['창원', '부산']
const ITEM_CAT_LABEL: Record<string, string> = {
  PRODUCT: '완제품', ASSEMBLY: '반제품', COMPONENT: '자재',
}
const SUB_CAT_LABEL: Record<string, string> = {
  BP: '배터리팩', BM: 'BMS', PC: 'PCM',
  CL: '셀', EL: '전장/전기부품', ME: '기구/외장부품',
  CD: '도전재', PK: '포장자재', FS: '체결부품',
  SM: '부자재/소모품', RM: '일반자재', OT: '샘플/기타',
  PO: 'Soft pack', CAS: 'Case', PRA: 'Power Relay Assembly',
  DST: 'Distribution Board', SWB: 'Switch Box', DRV: 'Driver',
  CMB: 'Communication Board', JTB: 'Junction Box', HRN: 'Harness',
}

type Approver = { order: number; role: string; name: string; userId?: string }

type ApprovalDefaults = { reviewerId: string; reviewerName: string; approverId: string; approverName: string }
type AllApprovalDefaults = { prod: ApprovalDefaults; lab: ApprovalDefaults; etc: ApprovalDefaults }
const emptyApprovalDefaults = (): ApprovalDefaults => ({ reviewerId: '', reviewerName: '', approverId: '', approverName: '' })
function approvalKey(dept: string) {
  if (dept === '연구소') return 'erp-approval-lab'
  if (dept === '연구비')  return 'erp-approval-etc'
  return 'erp-approval-prod'
}
function loadApprovalDefaultsByDept(dept: string): ApprovalDefaults {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(approvalKey(dept)) : null
    if (raw) return JSON.parse(raw)
  } catch {}
  return emptyApprovalDefaults()
}
function saveApprovalDefaultsByDept(dept: string, d: ApprovalDefaults) {
  try { localStorage.setItem(approvalKey(dept), JSON.stringify(d)) } catch {}
}

function makeApprovalLine(drafterName: string, dept: string, defaults?: ApprovalDefaults): Approver[] {
  const d = defaults ?? loadApprovalDefaultsByDept(dept)
  return [
    { order: 1, role: '기안자', name: drafterName },
    { order: 2, role: '검토자', name: d.reviewerName, userId: d.reviewerId || undefined },
    { order: 3, role: '승인자', name: d.approverName, userId: d.approverId || undefined },
  ]
}

const LIMIT = 20
const DEFAULT_ROWS = 8

type ItemRow = {
  _key: string
  domestic: string
  workCode: string; itemId: string
  category: string; midCategory: string; subCategory: string
  bomNo: string; spec: string
  quantity: string; unit: string; currency: string
  additionalCost: string; supplyAmount: string; taxAmount: string; purchaseReason: string
  requestedDeliveryDate: string; supplier: string; deliveryLocation: string
}

let _keyN = 0
const newKey = () => `r${++_keyN}`
const emptyRow = (): ItemRow => ({
  _key: newKey(),
  domestic: '',
  workCode: '', itemId: '', category: '', midCategory: '', subCategory: '',
  bomNo: '', spec: '', quantity: '', unit: 'EA', currency: 'KRW',
  additionalCost: '', supplyAmount: '', taxAmount: '', purchaseReason: '',
  requestedDeliveryDate: '', supplier: '', deliveryLocation: '',
})
const initRows = () => Array.from({ length: DEFAULT_ROWS }, emptyRow)

type FormState = {
  requesterName: string; department: string; memo: string
  items: ItemRow[]; approvalLine: Approver[]
}
const emptyForm = (drafterName = '', dept = '생산구매팀'): FormState => ({
  requesterName: drafterName, department: dept, memo: '',
  items: initRows(), approvalLine: makeApprovalLine(drafterName, dept),
})

function fmtMoney(v: number | null | undefined) {
  if (v == null) return ''
  return v.toLocaleString('ko-KR')
}
const THIRD_OPT_KEY: Record<string, string> = {
  EL: 'elComponentType', ME: 'meComponentType',
  CD: 'cdComponentType', PK: 'pkComponentType',
  FS: 'fsComponentType', SM: 'smComponentType',
  RM: 'rmComponentType', OT: 'otComponentType',
}
function getThirdCatLabel(item: any): string {
  const sub = item.subCategory as string | undefined
  if (!sub) return ''
  if (['BP', 'PO', 'CL'].includes(sub)) {
    if (!item.chemistryType) return ''
    return getOptions('chemistryType').find(o => o.value === item.chemistryType)?.label ?? item.chemistryType
  }
  const key = THIRD_OPT_KEY[sub]
  if (!key || !item.formFactor) return item.formFactor ?? ''
  return getOptions(key).find(o => o.value === item.formFactor)?.label ?? item.formFactor
}

function hasBuyerData(req: any): boolean {
  return req.items?.some((it: any) => it.orderNo || it.domestic || it.actualReceiptDate || it.orderMethod)
}

function getDrafter(req: any): string {
  try {
    const line: Approver[] = JSON.parse(req.approvalLine ?? '[]')
    return line.find(l => l.role === '기안자')?.name || req.requesterName || ''
  } catch {
    return req.requesterName || ''
  }
}

type UserItem = { id: string; name: string | null; email: string }

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function PurchasesPage() {
  const { data: session } = useSession()
  const sessionName = session?.user?.name ?? ''
  const isProdStock = session?.user?.roles?.includes('PROD_STOCK') ?? false
  const isLabStock  = session?.user?.roles?.includes('LAB_STOCK')  ?? false
  const isOwn = (req: any) => req.requester?.email === session?.user?.email

  const [requests,      setRequests]      = useState<any[]>([])
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(1)
  const [loading,       setLoading]       = useState(false)
  const [filterStatus,  setFilterStatus]  = useState('')
  const [deptTab,       setDeptTab]       = useState('생산구매팀')
  // 현재 탭 기준 관리자 여부
  const isAdmin = deptTab === '생산구매팀' ? isProdStock : isLabStock
  const [search,        setSearch]        = useState('')
  const [searchInput,   setSearchInput]   = useState('')
  const [statusCounts,  setStatusCounts]  = useState<Record<string, number>>({})

  const [formOpen,        setFormOpen]        = useState(false)
  const [formReadOnly,    setFormReadOnly]    = useState(false)
  const [editReq,         setEditReq]         = useState<any | null>(null)
  const [form,            setForm]            = useState<FormState>(emptyForm())
  const [approvalEditing, setApprovalEditing] = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [deleteId,        setDeleteId]        = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState(false)

  const [buyerOpen,    setBuyerOpen]    = useState(false)
  const [buyerRequest, setBuyerRequest] = useState<any | null>(null)

  const [miscOpen,           setMiscOpen]           = useState(false)
  const [miscReadOnly,       setMiscReadOnly]       = useState(false)
  const [miscEditReq,        setMiscEditReq]        = useState<any | null>(null)
  const [miscBuyerOpen,      setMiscBuyerOpen]      = useState(false)
  const [miscBuyerRequest,   setMiscBuyerRequest]   = useState<any | null>(null)
  const [miscReceiveOpen,     setMiscReceiveOpen]     = useState(false)
  const [miscReceiveRequest,  setMiscReceiveRequest]  = useState<any | null>(null)
  const [miscReceiveViewOpen, setMiscReceiveViewOpen] = useState(false)
  const [miscReceiveViewReq,  setMiscReceiveViewReq]  = useState<any | null>(null)

  const [nextSerial,      setNextSerial]      = useState<number | null>(null)
  const [tooltipInfo,     setTooltipInfo]     = useState<{ x: number; y: number; text: string } | null>(null)
  const [itemDetailOpen,  setItemDetailOpen]  = useState(false)
  const [itemDetailItem,  setItemDetailItem]  = useState<any | null>(null)

  const [users,          setUsers]          = useState<UserItem[]>([])
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [settingsDraft,  setSettingsDraft]  = useState<AllApprovalDefaults>({ prod: emptyApprovalDefaults(), lab: emptyApprovalDefaults(), etc: emptyApprovalDefaults() })
  const [settingsDeptTab, setSettingsDeptTab] = useState<'prod' | 'lab' | 'etc'>('prod')

  const bomRefs      = useRef<Record<string, HTMLInputElement | null>>({})
  const supplierRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const bomTimer     = useRef<any>(null)
  const supplierTimer = useRef<any>(null)
  const searchTimer  = useRef<any>(null)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const [itemDropdown, setItemDropdown] = useState<{
    key: string; results: any[]
    pos: { top: number; left: number; width: number }
  } | null>(null)

  const [supplierDropdown, setSupplierDropdown] = useState<{
    key: string; results: any[]; query: string
    pos: { top: number; left: number; width: number }
  } | null>(null)

  // ── 데이터 로드 ─────────────────────────────────────────
  const fetchRequests = useCallback(async (p: number, status: string, q: string, dept: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (dept) params.set('department', dept)
      if (q.trim()) params.set('search', q.trim())
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res  = await fetch(`/api/purchases?${params}`)
      const json = await res.json()
      if (json.success) {
        setRequests(json.data.requests)
        setTotal(json.data.total)
        setPage(json.data.page)
        if (json.data.statusCounts) setStatusCounts(json.data.statusCounts)
      } else toast.error('데이터를 불러오지 못했습니다.')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRequests(page, filterStatus, search, deptTab) }, [fetchRequests, page, filterStatus, search, deptTab])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(j => { if (j.success) setUsers(j.data) }).catch(() => {})
  }, [])

  // ── 다이얼로그 열기 ────────────────────────────────────
  async function fetchNextSerial(dept: string) {
    try {
      const res = await fetch(`/api/purchases/next-serial?dept=${encodeURIComponent(dept)}`)
      const json = await res.json()
      if (json.success) setNextSerial(json.data.nextSerial)
    } catch {}
  }

  function openCreate() {
    const dept = deptTab || '생산구매팀'
    setEditReq(null)
    setNextSerial(null)
    setForm(emptyForm(sessionName, dept))
    setApprovalEditing(false)
    setFormOpen(true)
    fetchNextSerial(dept)
  }

  function openEdit(req: any, readOnly = false) {
    setEditReq(req)
    setFormReadOnly(readOnly)
    const loaded: ItemRow[] = req.items?.length > 0
      ? req.items.map((it: any) => ({
          _key: newKey(),
          domestic: it.domestic ?? '',
          workCode: it.workCode ?? '', itemId: it.itemId ?? '',
          category: it.category ?? '', midCategory: it.midCategory ?? '',
          subCategory: it.subCategory ?? '', bomNo: it.bomNo ?? '',
          spec: it.spec ?? '', quantity: String(it.quantity), unit: it.unit ?? 'EA',
          currency: it.currency ?? 'KRW',
          additionalCost: it.additionalCost != null ? String(it.additionalCost) : '',
          supplyAmount: it.supplyAmount != null ? String(it.supplyAmount) : '',
          taxAmount: it.taxAmount != null ? String(it.taxAmount) : '',
          purchaseReason: it.purchaseReason ?? '',
          requestedDeliveryDate: it.requestedDeliveryDate ? it.requestedDeliveryDate.slice(0, 10) : '',
          supplier: it.supplier ?? '', deliveryLocation: it.deliveryLocation ?? '',
        }))
      : []
    while (loaded.length < DEFAULT_ROWS) loaded.push(emptyRow())
    let loadedApproval: Approver[]
    try { loadedApproval = req.approvalLine ? JSON.parse(req.approvalLine) : makeApprovalLine(sessionName, req.department ?? '생산구매팀') }
    catch { loadedApproval = makeApprovalLine(sessionName, req.department ?? '생산구매팀') }
    setForm({
      requesterName: req.requesterName || sessionName,
      department: req.department ?? '생산구매팀', memo: req.memo ?? '',
      items: loaded, approvalLine: loadedApproval,
    })
    setApprovalEditing(false); setFormOpen(true)
  }

  function openBuyer(req: any) { setBuyerRequest(req); setBuyerOpen(true) }

  async function openItemDetail(itemId: string) {
    try {
      const res  = await fetch(`/api/items/${itemId}`)
      const json = await res.json()
      if (json.success) { setItemDetailItem(json.data); setItemDetailOpen(true) }
    } catch {}
  }

  // ── 폼 업데이트 ─────────────────────────────────────────
  const updItem = (key: string, field: keyof ItemRow, val: string) =>
    setForm(f => ({ ...f, items: f.items.map(r => r._key === key ? { ...r, [field]: val } : r) }))
  const clearRow = (key: string) =>
    setForm(f => ({ ...f, items: f.items.map(r => r._key === key ? emptyRow() : r) }))
  const removeRow = (key: string) =>
    setForm(f => ({ ...f, items: f.items.filter(r => r._key !== key) }))
  const addRows = (n: number) =>
    setForm(f => ({ ...f, items: [...f.items, ...Array.from({ length: n }, emptyRow)] }))

  // ── 품목 검색 ────────────────────────────────────────────
  async function fetchBomItems(query: string, key: string) {
    const el = bomRefs.current[key]
    if (!el) return
    try {
      const url = query.trim()
        ? `/api/items?search=${encodeURIComponent(query)}&limit=10`
        : `/api/items?limit=10&sortBy=createdAt&sortOrder=desc`
      const res  = await fetch(url)
      const json = await res.json()
      if (json.success && json.data.items.length > 0) {
        const r = el.getBoundingClientRect()
        setItemDropdown({ key, results: json.data.items, pos: { top: r.bottom + 2, left: r.left, width: r.width } })
      } else {
        setItemDropdown(d => d?.key === key ? null : d)
      }
    } catch { setItemDropdown(null) }
  }

  function handleBomInput(key: string, val: string) {
    updItem(key, 'bomNo', val)
    clearTimeout(bomTimer.current)
    bomTimer.current = setTimeout(() => fetchBomItems(val, key), 200)
  }

  async function fetchSuppliers(query: string, key: string) {
    const el = supplierRefs.current[key]
    if (!el) return
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (query.trim()) params.set('search', query.trim())
      const res  = await fetch(`/api/suppliers?${params}`)
      const json = await res.json()
      const r    = el.getBoundingClientRect()
      setSupplierDropdown({
        key,
        results: json.success ? (json.data.suppliers ?? []) : [],
        query: query.trim(),
        pos: { top: r.bottom + 2, left: r.left, width: r.width },
      })
    } catch { setSupplierDropdown(null) }
  }

  function handleSupplierInput(key: string, val: string) {
    updItem(key, 'supplier', val)
    clearTimeout(supplierTimer.current)
    supplierTimer.current = setTimeout(() => fetchSuppliers(val, key), 150)
  }

  function selectSupplier(name: string) {
    if (!supplierDropdown) return
    updItem(supplierDropdown.key, 'supplier', name)
    setSupplierDropdown(null)
  }

  async function createAndSelectSupplier(name: string) {
    if (!supplierDropdown) return
    const key = supplierDropdown.key
    try {
      const res  = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name }),
      })
      const json = await res.json()
      if (json.success) {
        updItem(key, 'supplier', json.data.companyName)
        setSupplierDropdown(null)
        toast.success(`공급처 '${name}'이 등록되었습니다.`)
      } else {
        toast.error(json.message ?? '공급처 생성에 실패했습니다.')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
  }

  function selectBomItem(item: any) {
    if (!itemDropdown) return
    const key = itemDropdown.key
    setForm(f => ({
      ...f,
      items: f.items.map(r => r._key !== key ? r : {
        ...r, itemId: item.id, bomNo: item.itemCode,
        spec: item.itemName || r.spec, unit: item.unit || r.unit,
        category: ITEM_CAT_LABEL[item.category] || r.category,
        midCategory: item.subCategory ? (SUB_CAT_LABEL[item.subCategory] ?? item.subCategory) : r.midCategory,
        subCategory: getThirdCatLabel(item) || r.subCategory,
      }),
    }))
    setItemDropdown(null)
  }

  // ── 저장 ────────────────────────────────────────────────
  async function handleSave() {
    const validItems = form.items.filter(it => it.domestic?.trim() && it.quantity && Number(it.quantity) > 0 && it.unit.trim())
    if (validItems.length === 0) { toast.error('구분(국내/해외) 및 수량·단위가 입력된 품목이 1개 이상 필요합니다.'); return }
    setSaving(true)
    const itemsPayload = form.items.map(it => ({
      domestic: it.domestic || null,
      workCode: it.workCode, itemId: it.itemId,
      category: it.category, midCategory: it.midCategory, subCategory: it.subCategory,
      bomNo: it.bomNo, spec: it.spec,
      quantity: it.quantity, unit: it.unit, currency: it.currency,
      additionalCost: it.additionalCost ? Number(it.additionalCost) : null,
      supplyAmount: it.supplyAmount ? Number(it.supplyAmount) : null,
      taxAmount:    it.taxAmount    ? Number(it.taxAmount)    : null,
      purchaseReason: it.purchaseReason,
      requestedDeliveryDate: it.requestedDeliveryDate || null,
      supplier: it.supplier, deliveryLocation: it.deliveryLocation,
    }))
    try {
      if (editReq) {
        const res = await fetch(`/api/purchases/${editReq.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.requesterName || '구매요청',
            requesterName: form.requesterName,
            department: form.department,
            memo: form.memo,
            approvalLine: form.approvalLine,
            items: itemsPayload,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('수정되었습니다.')
          setFormOpen(false)
          fetchRequests(page, filterStatus, search, deptTab)
        } else toast.error(json.message ?? '저장에 실패했습니다.')
      } else {
        const res = await fetch('/api/purchases/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterName: form.requesterName,
            department: form.department,
            memo: form.memo,
            approvalLine: form.approvalLine,
            items: itemsPayload,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success(`${json.data.length}건이 등록되었습니다.`)
          setFormOpen(false)
          setPage(1)
          fetchRequests(1, filterStatus, search, deptTab)
        } else toast.error(json.message ?? '저장에 실패했습니다.')
      }
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res  = await fetch(`/api/purchases/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('삭제되었습니다.')
        setDeleteId(null)
        fetchRequests(requests.length === 1 && page > 1 ? page - 1 : page, filterStatus, search, deptTab)
      } else toast.error(json.message ?? '삭제 실패')
    } catch { toast.error('서버 오류가 발생했습니다.') }
    finally { setDeleting(false) }
  }

  // ── 폼 집계 ─────────────────────────────────────────────
  const formTotals = (() => {
    const rows = form.items.filter(it => it.quantity && Number(it.quantity) > 0)
    const additional = rows.reduce((s, it) => s + (it.additionalCost ? Number(it.additionalCost) : 0), 0)
    const supply     = rows.reduce((s, it) => s + (it.supplyAmount   ? Number(it.supplyAmount)   : 0), 0)
    const tax        = rows.reduce((s, it) => s + (it.taxAmount      ? Number(it.taxAmount)      : 0), 0)
    return { count: rows.length, additional, supply, tax, total: additional + supply + tax }
  })()

  // ── 스타일 상수 ─────────────────────────────────────────
  const cell = 'h-7 w-full rounded border-0 bg-transparent px-1.5 text-xs focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
  const sel  = 'h-7 w-full rounded border border-gray-200 bg-white px-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed'
  const thL  = 'px-2 py-2 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap border-b border-r last:border-r-0 bg-gray-50/80'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-900">구매 요청</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">요청자가 구매를 의뢰하고 구매담당자가 처리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {(isProdStock || isLabStock) && (
            <button
              onClick={() => {
                setSettingsDraft({
                  prod: loadApprovalDefaultsByDept('생산구매팀'),
                  lab: loadApprovalDefaultsByDept('연구소'),
                  etc: loadApprovalDefaultsByDept('연구비'),
                })
                setSettingsDeptTab('prod')
                setSettingsOpen(true)
              }}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="기본 결재라인 설정"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <a
            href="https://www.bizplay.co.kr/main_0003_01.act"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            비즈플레이
          </a>
          {deptTab === '연구비' ? (
            <Button onClick={() => { setMiscEditReq(null); setMiscOpen(true) }} size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              일괄 구매 요청
            </Button>
          ) : (
            <Button onClick={openCreate} size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              + 구매 요청
            </Button>
          )}
        </div>
      </div>

      {/* ── 부서 탭 ──────────────────────────────────────── */}
      <div className="bg-white border-b shrink-0 flex">
        {DEPT_TABS.map(tab => (
          <button key={tab.value}
            onClick={() => { setDeptTab(tab.value); setPage(1); setFilterStatus('') }}
            className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
              deptTab === tab.value
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 필터 바 ──────────────────────────────────────── */}
      <div className="px-4 pt-2.5 pb-2 border-b bg-white flex flex-col gap-2 shrink-0">
        <div className="flex gap-1.5">
          {(deptTab === '연구비' ? FILTER_PILLS_MISC : FILTER_PILLS_DEPT).map(pill => {
            const cnt = pill.value ? (statusCounts[pill.value] ?? 0) : Object.values(statusCounts).reduce((s, n) => s + n, 0)
            const active = filterStatus === pill.value
            return (
              <button key={pill.value}
                onClick={() => { setFilterStatus(pill.value); setPage(1) }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  active
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {pill.label}
                {cnt > 0 && (
                  <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-gray-300' : 'text-gray-400'}`}>
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            value={searchInput}
            onChange={e => {
              setSearchInput(e.target.value)
              clearTimeout(searchTimer.current)
              searchTimer.current = setTimeout(() => { setSearch(e.target.value); setPage(1) }, 300)
            }}
            placeholder="코드·품목명 검색"
            className="h-8 text-xs pl-8 w-full"
          />
        </div>
      </div>

      {/* ── 목록 테이블 ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {deptTab === '연구비' ? (
          /* 연구비 테이블 */
          <table className="text-xs w-full border-collapse" style={{ minWidth: 960 }}>
            <colgroup>
              <col style={{ width: 3 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 110 }} />
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead className="bg-white sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="w-1 p-0" />
                {['상태', '구매요청코드', '요청자', '프로젝트코드', '요청제목', '공급처', '배송지', '총금액', '사용카드', '관리'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-3 py-16 text-center text-gray-400 text-xs">불러오는 중...</td></tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-16 text-center">
                    <div className="text-gray-300 text-2xl mb-2">📋</div>
                    <div className="text-gray-400 text-xs">연구비 구매 요청 내역이 없습니다.</div>
                  </td>
                </tr>
              ) : requests.map((req: any) => {
                const drafter = getDrafter(req)
                const rowCls = `border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${STATUS_ROW[req.status] ?? ''}`
                return (
                  <tr key={req.id} className={rowCls}>
                    <td className={`w-1 p-0 ${STATUS_STRIPE[req.status] ?? 'bg-gray-200'}`} />
                    <td className="px-3 py-2 align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[req.status] ?? ''}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {req.documentNo || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {drafter || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {req.miscWorkCode || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-0 truncate">
                      {req.title || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {req.miscSupplier || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {req.miscDeliveryLoc || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums text-gray-700 font-medium whitespace-nowrap">
                      {req.miscTotalAmount != null ? fmtMoney(req.miscTotalAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {req.cardUsed || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        {/* 구매 요청자 전용 버튼 */}
                        {isOwn(req) && (
                          req.status === 'PENDING' ? (
                            <button
                              onClick={() => { setMiscReadOnly(false); setMiscEditReq(req); setMiscOpen(true) }}
                              className="h-7 px-2.5 rounded text-xs font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
                            >
                              수정
                            </button>
                          ) : (
                            <button
                              onClick={() => { setMiscReadOnly(true); setMiscEditReq(req); setMiscOpen(true) }}
                              className="h-7 px-2.5 rounded text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors whitespace-nowrap"
                            >
                              보기
                            </button>
                          )
                        )}
                        {isOwn(req) && (
                          <button
                            onClick={() => { setMiscReceiveRequest(req); setMiscReceiveOpen(true) }}
                            className="h-7 px-2.5 rounded text-xs font-medium border border-green-200 text-green-600 bg-green-50 hover:bg-green-100 transition-colors whitespace-nowrap"
                          >
                            입고 처리
                          </button>
                        )}
                        {/* 관리자 전용 버튼 */}
                        {isAdmin && (
                          <button
                            onClick={() => { setMiscBuyerRequest(req); setMiscBuyerOpen(true) }}
                            className="h-7 px-2.5 rounded text-xs font-medium border border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors whitespace-nowrap"
                          >
                            구매 처리
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => { setMiscReceiveViewReq(req); setMiscReceiveViewOpen(true) }}
                            className="h-7 px-2.5 rounded text-xs font-medium border border-teal-200 text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors whitespace-nowrap"
                          >
                            입고 확인
                          </button>
                        )}
                        {(isAdmin || isOwn(req)) && req.status === 'PENDING' && (
                          <button
                            onClick={() => setDeleteId(req.id)}
                            className="h-7 px-2.5 rounded text-xs font-medium border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* 일반 테이블 (생산구매팀 / 연구소) */
          <table className="text-xs w-full border-collapse" style={{ minWidth: 1360 }}>
            <colgroup>
              <col style={{ width: 3 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 175 }} />
            </colgroup>
            <thead className="bg-white sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="w-1 p-0" />
                {['상태', '구분', '구매요청코드', '요청자', '배송지', '품목코드', '품목명', '수량', '총액', '공급처', '입고희망일', '구매사유', '관리'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="px-3 py-16 text-center text-gray-400 text-xs">불러오는 중...</td></tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-16 text-center">
                    <div className="text-gray-300 text-2xl mb-2">📋</div>
                    <div className="text-gray-400 text-xs">구매 요청 내역이 없습니다.</div>
                  </td>
                </tr>
              ) : (() => {
                const flatRows: { req: any; item: any; isFirst: boolean; groupSize: number; groupIdx: number }[] = []
                let gIdx = 0
                for (const req of requests) {
                  const items: any[] = req.items?.length > 0 ? req.items : [null]
                  items.forEach((item: any, i: number) => {
                    flatRows.push({ req, item, isFirst: i === 0, groupSize: items.length, groupIdx: gIdx })
                  })
                  gIdx++
                }
                return flatRows.map(({ req, item, isFirst, groupSize, groupIdx }) => {
                  const drafter = getDrafter(req)
                  const itemTotal = item
                    ? (Number(item.additionalCost) || 0) + (Number(item.supplyAmount) || 0) + (Number(item.taxAmount) || 0)
                    : null
                  const rowCls = `border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${STATUS_ROW[req.status] ?? ''} ${isFirst && groupIdx > 0 ? 'border-t-2 border-t-gray-200' : ''}`
                  return (
                    <tr key={`${req.id}-${item?.id ?? 'empty'}`} className={rowCls}>
                      {isFirst && (
                        <td rowSpan={groupSize} className={`w-1 p-0 ${STATUS_STRIPE[req.status] ?? 'bg-gray-200'}`} />
                      )}
                      {isFirst && (
                        <td rowSpan={groupSize} className="px-3 py-2 align-middle">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[req.status] ?? ''}`}>
                            {STATUS_LABEL[req.status] ?? req.status}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        {item?.domestic
                          ? <span className="text-xs text-gray-600">{item.domestic}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      {isFirst && (
                        <td rowSpan={groupSize} className="px-3 py-2 align-middle whitespace-nowrap">
                          <span className="text-xs text-gray-600">
                            {req.documentNo || <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                      )}
                      {isFirst && (
                        <td rowSpan={groupSize} className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs align-middle">
                          {drafter || <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                        {item?.deliveryLocation || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {item?.bomNo
                          ? <span className="font-mono text-gray-700 text-xs">{item.bomNo}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700 text-xs max-w-[140px] truncate">
                        {item?.spec || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs tabular-nums text-gray-700">
                        {item ? `${Number(item.quantity).toLocaleString()} ${item.unit || ''}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs tabular-nums text-gray-700 font-medium">
                        {itemTotal && itemTotal > 0
                          ? fmtMoney(itemTotal)
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                        {item?.supplier || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                        {item?.requestedDeliveryDate
                          ? item.requestedDeliveryDate.slice(0, 10)
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-[130px] truncate">
                        {item?.purchaseReason || <span className="text-gray-300">—</span>}
                      </td>
                      {isFirst && (
                        <td rowSpan={groupSize} className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-1">
                            {(isAdmin || isOwn(req)) && (
                              req.status === 'PENDING' ? (
                                <button
                                  onClick={() => openEdit(req, false)}
                                  className="h-7 px-2.5 rounded text-xs font-medium border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
                                >
                                  수정
                                </button>
                              ) : (
                                <button
                                  onClick={() => openEdit(req, true)}
                                  className="h-7 px-2.5 rounded text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors whitespace-nowrap"
                                >
                                  보기
                                </button>
                              )
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => openBuyer(req)}
                                className="h-7 px-2.5 rounded text-xs font-medium border border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors whitespace-nowrap"
                              >
                                구매 처리
                              </button>
                            )}
                            {isAdmin && req.status === 'PENDING' && (
                              <button
                                onClick={() => setDeleteId(req.id)}
                                className="h-7 px-2.5 rounded text-xs font-medium border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 페이지네이션 ─────────────────────────────────── */}
      <div className="px-4 py-2 border-t bg-white shrink-0 flex items-center justify-between">
        <span className="text-xs text-gray-400">총 {total.toLocaleString()}건</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-xs text-gray-500 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      </div>

      {/* ── 요청자 등록/수정 다이얼로그 ─────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setFormOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '96vw', maxWidth: 1820, height: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b shrink-0"
              style={{ background: 'linear-gradient(to right, #eff6ff, #f8fafc)' }}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${formReadOnly ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                  <span>{formReadOnly ? '👁' : '✏️'}</span> 요청자
                </span>
                <h2 className="text-sm font-bold text-gray-900">
                  {formReadOnly ? '구매 요청 조회' : editReq ? '구매 요청 수정' : '구매 요청 등록'}
                </h2>
                {editReq && (
                  <>
                    <span className="font-mono text-xs font-semibold text-gray-500">{editReq.documentNo}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[editReq.status] ?? ''}`}>
                      {STATUS_LABEL[editReq.status] ?? editReq.status}
                    </span>
                  </>
                )}
              </div>
              <button onClick={() => setFormOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg font-light">×</button>
            </div>

            <div className={`flex-1 overflow-auto flex flex-col gap-0 min-h-0 ${formReadOnly ? 'pointer-events-none select-none opacity-70' : ''}`}>

              {/* 기본 정보 섹션 */}
              <div className="px-6 py-4 border-b bg-gray-50/50 shrink-0">
                <div className="flex gap-4 flex-wrap items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">요청 부서</label>
                    <select
                      value={form.department}
                      onChange={e => {
                        const dept = e.target.value
                        setForm(f => ({
                          ...f,
                          department: dept,
                          approvalLine: makeApprovalLine(
                            f.approvalLine.find(a => a.role === '기안자')?.name || sessionName,
                            dept,
                          ),
                        }))
                        if (!editReq) { setNextSerial(null); fetchNextSerial(dept) }
                      }}
                      className="h-8 w-36 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">요청일</label>
                    <div className="h-8 flex items-center px-2.5 rounded-lg border border-gray-100 text-xs text-gray-400 bg-gray-100 w-28">
                      {new Date().toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  {/* 결재라인 */}
                  <div className="flex flex-col gap-1 ml-4 pl-4 border-l border-gray-200">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">결재 라인</label>
                    <div className="flex items-center gap-1.5">
                      {form.approvalLine.map((approver, i) => (
                        <React.Fragment key={approver.order}>
                          {i > 0 && <span className="text-gray-300 text-xs select-none">→</span>}
                          <div className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white min-w-[80px]">
                            <span className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">{approver.role}</span>
                            {approver.order === 1 ? (
                              <span className="font-medium text-xs text-gray-700">{approver.name || <span className="text-gray-300 italic">미설정</span>}</span>
                            ) : (
                              <select
                                value={approver.userId ?? ''}
                                onChange={e => {
                                  const selected = users.find(u => u.id === e.target.value)
                                  setForm(f => ({
                                    ...f,
                                    approvalLine: f.approvalLine.map((a, ai) =>
                                      ai === i ? { ...a, userId: selected?.id, name: selected?.name ?? '' } : a
                                    ),
                                  }))
                                }}
                                className="text-[11px] font-medium text-gray-700 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-blue-400 py-0 px-0 w-full text-center cursor-pointer"
                              >
                                <option value="">미설정</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 품목 테이블 */}
              <div className="flex flex-col flex-1 min-h-0 px-6 py-3 gap-2">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-700">품목 목록</label>
                    <span className="text-[11px] text-gray-400">
                      {editReq ? '(수량·단위 입력된 행만 저장됩니다)' : '(수량·단위 입력된 행마다 코드가 자동 부여됩니다)'}
                    </span>
                  </div>
                  {!editReq && (
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(5)}>+ 5행</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => addRows(10)}>+ 10행</Button>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-xl overflow-auto flex-1 bg-white">
                  <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', minWidth: 2040 }}>
                    <colgroup>
                      <col style={{ width: 36 }} />
                      <col style={{ width: 72 }} />
                      <col style={{ width: 92 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 60 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {[
                          { label: 'NO', req: false },
                          { label: '구분', req: true },
                          { label: '구매요청코드', req: false },
                          { label: '프로젝트코드', req: true },
                          { label: '품목코드', req: true },
                          { label: '대분류', req: true },
                          { label: '중분류', req: true },
                          { label: '소분류', req: true },
                          { label: '품목명', req: true },
                          { label: '단위', req: true },
                          { label: '수량', req: true },
                          { label: '통화', req: true },
                          { label: '부대비용', req: true, tooltip: '배송비·수수료 등 부가 비용' },
                          { label: '공급가액', req: true },
                          { label: '세액', req: true },
                          { label: '총액', req: false },
                          { label: '공급처', req: true },
                          { label: '입고장소', req: true },
                          { label: '입고희망일', req: true },
                          { label: '구매사유', req: true },
                          { label: '', req: false },
                        ].map((h, i) => (
                          <th key={i} className={thL}>
                            <span className="inline-flex items-center gap-0.5">
                              {h.label}
                              {h.req && <span className="text-red-400">*</span>}
                              {h.tooltip && (
                                <span
                                  className="ml-0.5 inline-flex items-center cursor-help"
                                  onMouseEnter={e => {
                                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                    setTooltipInfo({ x: r.left + r.width / 2, y: r.top, text: h.tooltip! })
                                  }}
                                  onMouseLeave={() => setTooltipInfo(null)}
                                >
                                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const todayStr = new Date().toISOString().split('T')[0]
                        const codeYY = String(new Date().getFullYear()).slice(-2)
                        const validKeys = !editReq
                          ? form.items
                              .filter(it => it.quantity && Number(it.quantity) > 0 && it.unit.trim())
                              .map(it => it._key)
                          : []
                        return form.items.map((row, idx) => {
                        const filled = !!(row.quantity || row.workCode || row.spec || row.bomNo)
                        const isDomesticSelected = !!row.domestic
                        const isItemSelected = !!row.itemId
                        const isGrayedRow = !!editReq && idx > 0
                        const dimCls = (!isGrayedRow && isItemSelected) ? ' text-gray-900' : ' text-gray-400'
                        const rowTotal = (Number(row.additionalCost) || 0) + (Number(row.supplyAmount) || 0) + (Number(row.taxAmount) || 0)
                        const codeIdx = validKeys.indexOf(row._key)
                        const codePreview = editReq
                          ? (editReq.documentNo || null)
                          : (codeIdx >= 0 && nextSerial !== null)
                            ? form.department === '연구소'
                              ? `L${codeYY}-P${String(nextSerial + codeIdx).padStart(3, '0')}`
                              : `P${codeYY}-${String(nextSerial + codeIdx).padStart(4, '0')}`
                            : null
                        const rowBg = !isDomesticSelected ? 'bg-gray-50/60' : filled ? 'bg-blue-50/30' : 'bg-white'
                        return (
                          <tr key={row._key} className={`border-b last:border-0 ${rowBg}`}>
                            <td className="px-1.5 py-0.5 text-center text-gray-400 border-r text-[11px]">{idx + 1}</td>
                            <td className="px-0.5 py-0.5 border-r">
                              <select value={row.domestic} onChange={e => updItem(row._key, 'domestic', e.target.value)} className={sel}>
                                <option value="">—</option>
                                <option value="국내">국내</option>
                                <option value="해외">해외</option>
                              </select>
                            </td>
                            <td className="px-1.5 py-0.5 text-center border-r">
                              {codePreview
                                ? <span className={`font-mono text-xs ${isGrayedRow ? 'text-gray-400' : 'text-gray-800'}`}>{codePreview}</span>
                                : <span className="text-gray-300 text-[11px]">—</span>}
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input value={row.workCode} onChange={e => updItem(row._key, 'workCode', e.target.value)}
                                placeholder="B26-1234"
                                disabled={!isDomesticSelected}
                                className={cell + (row.workCode ? ' text-gray-900' : ' text-gray-400') + (isDomesticSelected && !row.workCode ? ' placeholder:text-red-500' : '')} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input
                                ref={el => { bomRefs.current[row._key] = el }}
                                value={row.bomNo}
                                onChange={e => handleBomInput(row._key, e.target.value)}
                                onFocus={() => isDomesticSelected && fetchBomItems(row.bomNo, row._key)}
                                onBlur={() => setTimeout(() => setItemDropdown(d => d?.key === row._key ? null : d), 200)}
                                placeholder="품번 검색"
                                disabled={!isDomesticSelected}
                                className={cell + ' font-mono' + dimCls + (isDomesticSelected && !isItemSelected ? ' placeholder:text-red-500' : '')}
                              />
                            </td>
                            <td className="px-1.5 py-0.5 border-r">
                              <input value={row.category} onChange={e => updItem(row._key, 'category', e.target.value)}
                                disabled={!isDomesticSelected}
                                className={cell + dimCls} placeholder="—" />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input value={row.midCategory} onChange={e => updItem(row._key, 'midCategory', e.target.value)}
                                disabled={!isDomesticSelected}
                                className={cell + dimCls} placeholder="—" />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input value={row.subCategory} onChange={e => updItem(row._key, 'subCategory', e.target.value)}
                                disabled={!isDomesticSelected}
                                className={cell + dimCls} placeholder="—" />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              {row.itemId ? (
                                <button
                                  type="button"
                                  onClick={() => openItemDetail(row.itemId)}
                                  disabled={!isDomesticSelected}
                                  className={cell + ' text-left text-blue-600 underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'}
                                >
                                  {row.spec || '—'}
                                </button>
                              ) : (
                                <input value={row.spec} onChange={e => updItem(row._key, 'spec', e.target.value)}
                                  disabled={!isDomesticSelected}
                                  placeholder="품목명 입력" className={cell + dimCls} />
                              )}
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input value={row.unit} onChange={e => updItem(row._key, 'unit', e.target.value)}
                                disabled={!isDomesticSelected}
                                placeholder="EA" className={cell + ' text-center' + dimCls} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input type="number" min={0} value={row.quantity}
                                onChange={e => updItem(row._key, 'quantity', e.target.value)}
                                disabled={!isDomesticSelected}
                                placeholder="0" className={cell + ' text-right' + dimCls} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <select value={row.currency} onChange={e => updItem(row._key, 'currency', e.target.value)}
                                disabled={!isDomesticSelected} className={sel + dimCls}>
                                {CURRENCY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input type="number" min={0} value={row.additionalCost}
                                onChange={e => updItem(row._key, 'additionalCost', e.target.value)}
                                disabled={!isDomesticSelected}
                                placeholder="0" className={cell + ' text-right' + dimCls} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input type="number" min={0} value={row.supplyAmount}
                                onChange={e => {
                                  const val = e.target.value
                                  const tax = val && Number(val) > 0 ? String(Math.round(Number(val) * 0.1)) : ''
                                  setForm(f => ({
                                    ...f,
                                    items: f.items.map(r => r._key === row._key ? { ...r, supplyAmount: val, taxAmount: tax } : r),
                                  }))
                                }}
                                disabled={!isDomesticSelected}
                                placeholder="0" className={cell + ' text-right' + dimCls} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input type="number" min={0} value={row.taxAmount}
                                onChange={e => updItem(row._key, 'taxAmount', e.target.value)}
                                disabled={!isDomesticSelected}
                                placeholder="0" className={cell + ' text-right' + dimCls} />
                            </td>
                            <td className="px-1.5 py-0.5 border-r text-right tabular-nums text-[11px] font-medium text-gray-600">
                              {rowTotal > 0 ? fmtMoney(rowTotal) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input
                                ref={el => { supplierRefs.current[row._key] = el }}
                                value={row.supplier}
                                onChange={e => handleSupplierInput(row._key, e.target.value)}
                                onFocus={() => isDomesticSelected && fetchSuppliers(row.supplier, row._key)}
                                onBlur={() => setTimeout(() => setSupplierDropdown(d => d?.key === row._key ? null : d), 200)}
                                placeholder="공급처 검색"
                                disabled={!isDomesticSelected}
                                className={cell + dimCls}
                              />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <select value={row.deliveryLocation}
                                onChange={e => updItem(row._key, 'deliveryLocation', e.target.value)}
                                disabled={!isDomesticSelected} className={sel + dimCls}>
                                <option value="">—</option>
                                {DELIVERY_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                              </select>
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input type="date" value={row.requestedDeliveryDate}
                                min={todayStr}
                                onChange={e => updItem(row._key, 'requestedDeliveryDate', e.target.value)}
                                disabled={!isDomesticSelected}
                                className={cell + dimCls} />
                            </td>
                            <td className="px-0.5 py-0.5 border-r">
                              <input value={row.purchaseReason} onChange={e => updItem(row._key, 'purchaseReason', e.target.value)}
                                disabled={!isDomesticSelected}
                                placeholder="구매 사유" className={cell + dimCls} />
                            </td>
                            <td className="py-0.5 text-center">
                              {filled ? (
                                <button onClick={() => form.items.length > 1 ? removeRow(row._key) : clearRow(row._key)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 mx-auto transition-colors">
                                  ×
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })
                      })()}
                    </tbody>
                    {formTotals.count > 0 && (
                      <tfoot>
                        <tr className="bg-blue-50/60 border-t-2 border-blue-100">
                          <td colSpan={11} className="px-3 py-1.5 text-right text-[11px] font-semibold text-blue-700">
                            합계 ({formTotals.count}건)
                          </td>
                          <td className="px-2 py-1.5 text-right text-[11px] font-bold text-blue-800 tabular-nums border-r">
                            {fmtMoney(formTotals.additional)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[11px] font-bold text-blue-800 tabular-nums border-r">
                            {fmtMoney(formTotals.supply)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[11px] font-bold text-blue-800 tabular-nums border-r">
                            {fmtMoney(formTotals.tax)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[11px] font-bold text-blue-900 tabular-nums border-r">
                            {fmtMoney(formTotals.total)}
                          </td>
                          <td colSpan={5} className="px-2 py-1.5 text-[11px] text-blue-500" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* 비고 */}
              <div className="px-6 pb-4 shrink-0">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">비고</label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  placeholder="비고 사항을 입력하세요"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-3.5 border-t bg-gray-50/70 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>품목 <span className="font-semibold text-gray-600">{formTotals.count}</span>건 입력됨</span>
                {formTotals.supply > 0 && (
                  <span>공급금액 합계 <span className="font-semibold text-gray-600 tabular-nums">{fmtMoney(formTotals.supply)}</span>원</span>
                )}
              </div>
              <div className="flex gap-2">
                {formReadOnly ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs px-5"
                    onClick={() => setFormOpen(false)}>닫기</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs px-5"
                      onClick={() => setFormOpen(false)} disabled={saving}>취소</Button>
                    <Button size="sm" className="h-8 text-xs px-6 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                      {saving ? '저장 중...' : '저장'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 품목 검색 드롭다운 ────────────────────────────── */}
      {itemDropdown && (
        <div
          style={{
            position: 'fixed',
            top: itemDropdown.pos.top,
            left: itemDropdown.pos.left,
            minWidth: Math.max(itemDropdown.pos.width, 480),
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">품목 선택</span>
            <span className="text-xs text-gray-400">{itemDropdown.results.length}건</span>
          </div>
          <div className="grid grid-cols-[1fr_1.4fr_60px_70px_60px] px-3 py-1 bg-gray-50 border-b text-[11px] text-gray-400 font-medium">
            <span>품번</span><span>품명</span><span>대분류</span><span>중분류</span><span>단위</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {itemDropdown.results.map(item => (
              <button
                key={item.id}
                onMouseDown={e => { e.preventDefault(); selectBomItem(item) }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 grid grid-cols-[1fr_1.4fr_60px_70px_60px] gap-x-2 items-center border-b last:border-0 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-gray-800 truncate">{item.itemCode}</span>
                <span className="text-xs text-gray-700 truncate">{item.itemName}</span>
                <span className="text-xs text-gray-500">{ITEM_CAT_LABEL[item.category] ?? item.category}</span>
                <span className="text-xs text-gray-500">{item.subCategory ? (SUB_CAT_LABEL[item.subCategory] ?? item.subCategory) : '-'}</span>
                <span className="text-xs text-gray-400">{item.unit}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 공급처 검색 드롭다운 ────────────────────────── */}
      {supplierDropdown && (
        <div
          style={{
            position: 'fixed',
            top: supplierDropdown.pos.top,
            left: supplierDropdown.pos.left,
            minWidth: Math.max(supplierDropdown.pos.width, 320),
            zIndex: 99999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">공급처 선택</span>
            <span className="text-xs text-gray-400">{supplierDropdown.results.length}건</span>
          </div>
          {supplierDropdown.results.length > 0 && (
            <div className="max-h-52 overflow-y-auto">
              {supplierDropdown.results.map((s: any) => (
                <button
                  key={s.id}
                  onMouseDown={e => { e.preventDefault(); selectSupplier(s.companyName) }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-3 border-b last:border-0 transition-colors"
                >
                  <span className="font-mono text-[11px] text-gray-400 w-20 shrink-0">{s.supplierCode}</span>
                  <span className="text-xs font-medium text-gray-800 truncate">{s.companyName}</span>
                </button>
              ))}
            </div>
          )}
          {supplierDropdown.query && (
            <button
              onMouseDown={e => { e.preventDefault(); createAndSelectSupplier(supplierDropdown.query) }}
              className="w-full text-left px-3 py-2.5 hover:bg-green-50 flex items-center gap-2 text-xs text-green-700 font-medium border-t transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              &quot;{supplierDropdown.query}&quot; 신규 등록
            </button>
          )}
        </div>
      )}

      {/* ── 구매 처리 다이얼로그 ─────────────────────────── */}
      <BuyerDialog
        open={buyerOpen}
        request={buyerRequest}
        onClose={() => { setBuyerOpen(false); setBuyerRequest(null) }}
        onSaved={updated => {
          setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
          setBuyerRequest(updated)
        }}
      />

      {/* ── 기타 구매 요청 등록/수정 다이얼로그 ─────────── */}
      <MiscPurchaseDialog
        open={miscOpen}
        editReq={miscEditReq}
        readOnly={miscReadOnly}
        onClose={() => { setMiscOpen(false); setMiscEditReq(null); setMiscReadOnly(false) }}
        onSaved={saved => {
          setRequests(prev => {
            const exists = prev.some(r => r.id === saved.id)
            return exists ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev]
          })
          setMiscOpen(false)
          setMiscEditReq(null)
        }}
        users={users}
        sessionName={sessionName}
      />

      {/* ── 연구비 구매 처리 다이얼로그 ─────────────────── */}
      <MiscBuyerDialog
        open={miscBuyerOpen}
        request={miscBuyerRequest}
        onClose={() => { setMiscBuyerOpen(false); setMiscBuyerRequest(null) }}
        onSaved={updated => {
          setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
          setMiscBuyerRequest(updated)
          setMiscBuyerOpen(false)
        }}
      />

      {/* ── 연구비 입고 처리 다이얼로그 (요청자) ──────────── */}
      <MiscReceiveDialog
        open={miscReceiveOpen}
        request={miscReceiveRequest}
        onClose={() => { setMiscReceiveOpen(false); setMiscReceiveRequest(null) }}
        onSaved={updated => {
          setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
          setMiscReceiveOpen(false)
          setMiscReceiveRequest(null)
        }}
      />

      {/* ── 연구비 입고 확인 다이얼로그 (관리자) ──────────── */}
      <MiscReceiveViewDialog
        open={miscReceiveViewOpen}
        request={miscReceiveViewReq}
        onClose={() => { setMiscReceiveViewOpen(false); setMiscReceiveViewReq(null) }}
      />

      {/* ── 품목 상세 다이얼로그 ─────────────────────────── */}
      <ItemFormDialog
        open={itemDetailOpen}
        item={itemDetailItem}
        viewOnly
        onClose={() => { setItemDetailOpen(false); setItemDetailItem(null) }}
        onSaved={() => {}}
      />

      {/* ── 부대비용 툴팁 포털 ──────────────────────────── */}
      {tooltipInfo && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipInfo.y - 8,
            left: tooltipInfo.x,
            transform: 'translate(-50%, -100%)',
            zIndex: 999999,
            pointerEvents: 'none',
          }}
          className="whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white shadow-lg"
        >
          {tooltipInfo.text}
        </div>,
        document.body
      )}

      {/* ── 삭제 확인 ────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">구매 요청 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600">
              구매 요청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs" disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-xs bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 기본 결재라인 설정 모달 (PROD_STOCK 전용) ─── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">기본 결재라인 설정</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">부서별로 새 구매 요청 생성 시 자동 적용됩니다</p>
              </div>
              <button onClick={() => setSettingsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg">×</button>
            </div>

            {/* 부서 탭 */}
            <div className="flex border-b">
              {([['prod', '생산구매팀'], ['lab', '연구소'], ['etc', '연구비']] as const).map(([key, label]) => (
                <button key={key}
                  onClick={() => setSettingsDeptTab(key)}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    settingsDeptTab === key
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">기본 검토자</label>
                <select
                  value={settingsDraft[settingsDeptTab].reviewerId}
                  onChange={e => {
                    const u = users.find(u => u.id === e.target.value)
                    setSettingsDraft(d => ({
                      ...d,
                      [settingsDeptTab]: { ...d[settingsDeptTab], reviewerId: e.target.value, reviewerName: u?.name ?? '' },
                    }))
                  }}
                  className="h-9 rounded-lg border border-gray-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">선택 안 함</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">기본 승인자</label>
                <select
                  value={settingsDraft[settingsDeptTab].approverId}
                  onChange={e => {
                    const u = users.find(u => u.id === e.target.value)
                    setSettingsDraft(d => ({
                      ...d,
                      [settingsDeptTab]: { ...d[settingsDeptTab], approverId: e.target.value, approverName: u?.name ?? '' },
                    }))
                  }}
                  className="h-9 rounded-lg border border-gray-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">선택 안 함</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                </select>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs px-4"
                onClick={() => setSettingsOpen(false)}>취소</Button>
              <Button size="sm" className="h-8 text-xs px-5 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  saveApprovalDefaultsByDept('생산구매팀', settingsDraft.prod)
                  saveApprovalDefaultsByDept('연구소', settingsDraft.lab)
                  saveApprovalDefaultsByDept('연구비', settingsDraft.etc)
                  setSettingsOpen(false)
                  toast.success('기본 결재라인이 저장되었습니다.')
                }}>
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
